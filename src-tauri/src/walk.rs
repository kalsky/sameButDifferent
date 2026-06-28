use crate::model::{Entry, EntryKind, SideInfo, Status};
use ignore::WalkBuilder;
use std::collections::BTreeMap;
use std::path::Path;
use std::time::UNIX_EPOCH;

/// Raw stat of one path on one side, collected during the walk. No hashing here.
#[derive(Clone)]
struct RawInfo {
    kind: EntryKind,
    size: u64,
    mtime: i64,
}

/// Walk one root, returning rel_path -> RawInfo. Respects .gitignore (ignore crate default).
fn scan_root(root: &Path) -> BTreeMap<String, RawInfo> {
    let mut map = BTreeMap::new();
    let walker = WalkBuilder::new(root).hidden(false).build();
    for result in walker {
        let dent = match result {
            Ok(d) => d,
            Err(_) => continue,
        };
        let path = dent.path();
        if path == root {
            continue;
        }
        let rel = match path.strip_prefix(root) {
            Ok(r) => r.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };
        let meta = match dent.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let kind = if meta.is_dir() {
            EntryKind::Dir
        } else {
            EntryKind::File
        };
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        map.insert(
            rel,
            RawInfo {
                kind,
                size: meta.len(),
                mtime,
            },
        );
    }
    map
}

/// Build the merged Entry tree from N roots. Statuses are left as a placeholder
/// (Same) here; `compare::resolve_statuses` fills them in afterward.
pub fn build_tree(roots: &[String]) -> Vec<Entry> {
    let maps: Vec<BTreeMap<String, RawInfo>> = roots
        .iter()
        .map(|r| scan_root(Path::new(r)))
        .collect();

    // Union of all rel_paths across all roots, sorted (BTreeMap keys already sorted).
    let mut all_paths: BTreeMap<String, ()> = BTreeMap::new();
    for m in &maps {
        for k in m.keys() {
            all_paths.insert(k.clone(), ());
        }
    }

    // Flat list of (rel_path, sides, kind). Kind = first present side's kind.
    struct FlatEntry {
        rel_path: String,
        name: String,
        kind: EntryKind,
        sides: Vec<Option<SideInfo>>,
    }
    let mut flat: Vec<FlatEntry> = Vec::new();
    for rel in all_paths.keys() {
        let mut sides: Vec<Option<SideInfo>> = Vec::with_capacity(maps.len());
        let mut kind = None;
        for m in &maps {
            match m.get(rel) {
                Some(info) => {
                    if kind.is_none() {
                        kind = Some(info.kind);
                    }
                    sides.push(Some(SideInfo {
                        kind: info.kind,
                        size: info.size,
                        mtime: info.mtime,
                        content_hash: None,
                    }));
                }
                None => sides.push(None),
            }
        }
        let name = rel.rsplit('/').next().unwrap_or(rel).to_string();
        flat.push(FlatEntry {
            rel_path: rel.clone(),
            name,
            kind: kind.unwrap_or(EntryKind::File),
            sides,
        });
    }

    nest(flat.into_iter().map(|f| Entry {
        rel_path: f.rel_path,
        name: f.name,
        kind: f.kind,
        sides: f.sides,
        status: Status::Same,
        children: Vec::new(),
    }))
}

/// Turn a flat, path-sorted list of entries into a nested tree by rel_path depth.
fn nest(entries: impl Iterator<Item = Entry>) -> Vec<Entry> {
    let mut roots: Vec<Entry> = Vec::new();
    for entry in entries {
        insert_entry(&mut roots, &entry.rel_path.clone(), entry);
    }
    roots
}

fn insert_entry(level: &mut Vec<Entry>, rel_path: &str, entry: Entry) {
    match rel_path.split_once('/') {
        None => {
            // Leaf at this level. May already exist as a synthesized dir; replace fields.
            if let Some(existing) = level.iter_mut().find(|e| e.name == entry.name) {
                existing.kind = entry.kind;
                existing.sides = entry.sides;
            } else {
                level.push(entry);
            }
        }
        Some((head, tail)) => {
            // Descend into dir `head`, creating a placeholder if missing.
            let parent = match level.iter_mut().find(|e| e.name == head) {
                Some(p) => p,
                None => {
                    level.push(Entry {
                        rel_path: rel_path[..head.len()].to_string(),
                        name: head.to_string(),
                        kind: EntryKind::Dir,
                        sides: Vec::new(),
                        status: Status::Same,
                        children: Vec::new(),
                    });
                    level.last_mut().unwrap()
                }
            };
            parent.kind = EntryKind::Dir;
            insert_entry(&mut parent.children, tail, entry);
        }
    }
}
