use crate::model::{Entry, EntryKind, Status};
use std::hash::Hasher;
use std::path::Path;
use twox_hash::XxHash64;

/// Walk the tree and assign a Status to every entry. Files use the cheap->expensive
/// ladder (size -> mtime -> hash); dirs roll up from their children.
///
/// `roots` is needed to resolve real file paths for hashing.
pub fn resolve_statuses(roots: &[String], tree: &mut [Entry]) {
    for entry in tree.iter_mut() {
        resolve_entry(roots, entry);
    }
}

fn resolve_entry(roots: &[String], entry: &mut Entry) {
    match entry.kind {
        EntryKind::Dir => {
            for child in entry.children.iter_mut() {
                resolve_entry(roots, child);
            }
            entry.status = dir_status(entry);
        }
        EntryKind::File => {
            entry.status = file_status(roots, entry);
        }
    }
}

/// Decide a file's status across its present sides, cheap checks first.
fn file_status(roots: &[String], entry: &mut Entry) -> Status {
    let present: Vec<usize> = entry
        .sides
        .iter()
        .enumerate()
        .filter_map(|(i, s)| s.as_ref().map(|_| i))
        .collect();

    // Mixed file/dir across present sides => type conflict.
    let mut kinds = present
        .iter()
        .map(|&i| entry.sides[i].as_ref().unwrap().kind);
    if let Some(first) = kinds.next() {
        if kinds.any(|k| k != first) {
            return Status::TypeConflict;
        }
    }

    match present.len() {
        0 => Status::Same, // shouldn't happen
        1 => Status::OnlyIn(present[0]),
        n if n < entry.sides.len() => Status::Partial,
        _ => {
            // Present on all sides. Compare pairwise against the first present side.
            let base = present[0];
            for &other in &present[1..] {
                if !sides_equal(roots, entry, base, other) {
                    return Status::Differ;
                }
            }
            Status::Same
        }
    }
}

/// Are two sides of a file equal? size -> mtime -> hash.
fn sides_equal(roots: &[String], entry: &mut Entry, a: usize, b: usize) -> bool {
    let (size_a, mtime_a) = {
        let s = entry.sides[a].as_ref().unwrap();
        (s.size, s.mtime)
    };
    let (size_b, mtime_b) = {
        let s = entry.sides[b].as_ref().unwrap();
        (s.size, s.mtime)
    };

    if size_a != size_b {
        return false; // different size => differ, no read
    }
    if mtime_a == mtime_b {
        return true; // same size + mtime => assume same, skip read
        // ponytail: mtime-equal => same skips a read. Add a "force content compare" toggle if users hit false-sames.
    }
    // same size, different mtime => hash both and compare
    let ha = ensure_hash(roots, entry, a);
    let hb = ensure_hash(roots, entry, b);
    match (ha, hb) {
        (Some(x), Some(y)) => x == y,
        _ => false, // unreadable => treat as differ
    }
}

/// Compute (and cache) the content hash for one side of a file.
fn ensure_hash(roots: &[String], entry: &mut Entry, side: usize) -> Option<u64> {
    if let Some(h) = entry.sides[side].as_ref().and_then(|s| s.content_hash) {
        return Some(h);
    }
    let path = Path::new(&roots[side]).join(&entry.rel_path);
    let bytes = std::fs::read(&path).ok()?;
    let mut hasher = XxHash64::default();
    hasher.write(&bytes);
    let h = hasher.finish();
    if let Some(s) = entry.sides[side].as_mut() {
        s.content_hash = Some(h);
    }
    Some(h)
}

/// Roll up a directory's status from its children and its own presence.
fn dir_status(entry: &Entry) -> Status {
    // If the dir itself is missing on some sides, report that.
    if !entry.sides.is_empty() {
        let present: Vec<usize> = entry
            .sides
            .iter()
            .enumerate()
            .filter_map(|(i, s)| s.as_ref().map(|_| i))
            .collect();
        // Any present side that is a File while this entry nests as a Dir => conflict.
        if present
            .iter()
            .any(|&i| entry.sides[i].as_ref().unwrap().kind == EntryKind::File)
        {
            return Status::TypeConflict;
        }
        if present.len() == 1 {
            return Status::OnlyIn(present[0]);
        }
        if !present.is_empty() && present.len() < entry.sides.len() {
            return Status::Partial;
        }
    }
    // Otherwise differ if any child is not Same.
    if entry.children.iter().any(|c| c.status != Status::Same) {
        Status::Differ
    } else {
        Status::Same
    }
}
