use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};
use std::path::{Path, PathBuf};

/// What `diff_file` returns. The frontend switches its view on `kind`.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind")]
pub enum FileDiff {
    Text { hunks: Vec<Hunk> },
    Binary,
    Image,
    Pdf,
}

/// A contiguous run of changes (or context) aligned across the two sides.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Hunk {
    pub id: usize,
    pub tag: HunkTag,
    /// 0-based line range on side A: [a_start, a_start + a_lines)
    pub a_start: usize,
    pub a_lines: Vec<String>,
    /// 0-based line range on side B
    pub b_start: usize,
    pub b_lines: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HunkTag {
    Equal,
    Insert,  // only on B
    Delete,  // only on A
    Replace, // both, changed
}

fn join(root: &str, rel: &str) -> PathBuf {
    Path::new(root).join(rel)
}

/// Compute the text diff between root_a/rel and root_b/rel.
pub fn diff_text(text_a: &str, text_b: &str) -> Vec<Hunk> {
    let diff = TextDiff::from_lines(text_a, text_b);
    let mut hunks: Vec<Hunk> = Vec::new();
    let mut id = 0usize;
    let mut a_idx = 0usize;
    let mut b_idx = 0usize;

    // Collapse consecutive same-tag changes into hunks. similar gives per-line changes;
    // we group Delete-runs and Insert-runs, and merge an adjacent Delete+Insert into Replace.
    let mut pending_del: Vec<String> = Vec::new();
    let mut pending_ins: Vec<String> = Vec::new();
    let mut del_start = 0usize;
    let mut ins_start = 0usize;

    let flush = |hunks: &mut Vec<Hunk>,
                 id: &mut usize,
                 del: &mut Vec<String>,
                 ins: &mut Vec<String>,
                 ds: usize,
                 is: usize| {
        if del.is_empty() && ins.is_empty() {
            return;
        }
        let tag = match (del.is_empty(), ins.is_empty()) {
            (false, false) => HunkTag::Replace,
            (false, true) => HunkTag::Delete,
            (true, false) => HunkTag::Insert,
            (true, true) => unreachable!(),
        };
        hunks.push(Hunk {
            id: *id,
            tag,
            a_start: ds,
            a_lines: std::mem::take(del),
            b_start: is,
            b_lines: std::mem::take(ins),
        });
        *id += 1;
    };

    for change in diff.iter_all_changes() {
        let value = change.value().to_string();
        match change.tag() {
            ChangeTag::Equal => {
                flush(
                    &mut hunks,
                    &mut id,
                    &mut pending_del,
                    &mut pending_ins,
                    del_start,
                    ins_start,
                );
                hunks.push(Hunk {
                    id,
                    tag: HunkTag::Equal,
                    a_start: a_idx,
                    a_lines: vec![value.clone()],
                    b_start: b_idx,
                    b_lines: vec![value],
                });
                id += 1;
                a_idx += 1;
                b_idx += 1;
            }
            ChangeTag::Delete => {
                if pending_del.is_empty() && pending_ins.is_empty() {
                    del_start = a_idx;
                    ins_start = b_idx;
                }
                pending_del.push(value);
                a_idx += 1;
            }
            ChangeTag::Insert => {
                if pending_del.is_empty() && pending_ins.is_empty() {
                    del_start = a_idx;
                    ins_start = b_idx;
                }
                pending_ins.push(value);
                b_idx += 1;
            }
        }
    }
    flush(
        &mut hunks,
        &mut id,
        &mut pending_del,
        &mut pending_ins,
        del_start,
        ins_start,
    );
    hunks
}

/// Read both files and diff them as text.
pub fn diff_file_text(root_a: &str, root_b: &str, rel: &str) -> std::io::Result<Vec<Hunk>> {
    let a = std::fs::read_to_string(join(root_a, rel))?;
    let b = std::fs::read_to_string(join(root_b, rel))?;
    Ok(diff_text(&a, &b))
}

/// Copy one hunk's content from `from_root` into `to_root`, then re-diff.
/// `hunk_id` indexes into the hunk list produced by diffing from_root vs to_root
/// in canonical (root_a, root_b) order. We always diff with a=from, b=to so the
/// hunk's `a_lines` are the source and `b_start`/`b_lines` are the target region.
pub fn apply_hunk(
    from_root: &str,
    to_root: &str,
    rel: &str,
    hunk_id: usize,
) -> std::io::Result<Vec<Hunk>> {
    let src = std::fs::read_to_string(join(from_root, rel))?;
    let dst = std::fs::read_to_string(join(to_root, rel))?;
    let hunks = diff_text(&src, &dst);
    let hunk = hunks
        .iter()
        .find(|h| h.id == hunk_id)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "hunk not found"))?;

    // Rebuild dst line list, replacing the target region [b_start, b_start+b_lines)
    // with the source lines (a_lines).
    let dst_lines: Vec<&str> = split_keep_ends(&dst);
    let mut out: Vec<String> = Vec::new();
    out.extend(dst_lines[..hunk.b_start].iter().map(|s| s.to_string()));
    out.extend(hunk.a_lines.iter().cloned());
    let resume = hunk.b_start + hunk.b_lines.len();
    out.extend(dst_lines[resume.min(dst_lines.len())..].iter().map(|s| s.to_string()));

    std::fs::write(join(to_root, rel), out.concat())?;
    // ponytail: write-then-rediff just this file; no global rescan after a copy.
    diff_file_text(from_root, to_root, rel)
}

/// Whole-file copy (only-in entries, or wholesale overwrite).
pub fn copy_file(from_root: &str, to_root: &str, rel: &str) -> std::io::Result<()> {
    let dst = join(to_root, rel);
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(join(from_root, rel), dst)?;
    Ok(())
}

/// Split text into lines while preserving their trailing newlines, so concatenation
/// round-trips the original bytes. Matches how `similar`'s line values include '\n'.
fn split_keep_ends(s: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let bytes = s.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if b == b'\n' {
            out.push(&s[start..=i]);
            start = i + 1;
        }
    }
    if start < s.len() {
        out.push(&s[start..]);
    }
    out
}
