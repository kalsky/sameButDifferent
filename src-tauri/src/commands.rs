use crate::binary::{self, HexPage, Media};
use crate::compare;
use crate::diff::{self, FileDiff};
use crate::model::CompareSession;
use crate::walk;
use std::path::Path;

/// Walk N roots, merge by rel_path, and resolve every entry's status.
#[tauri::command]
pub fn scan_session(roots: Vec<String>) -> CompareSession {
    let mut tree = walk::build_tree(&roots);
    compare::resolve_statuses(&roots, &mut tree);
    CompareSession { roots, tree }
}

/// Diff one file across two roots. Returns a text diff, or a binary/image/pdf marker.
#[tauri::command]
pub fn diff_file(rel_path: String, root_a: String, root_b: String) -> Result<FileDiff, String> {
    // Sniff side A (fall back to B if A is missing, e.g. only-in-B).
    let bytes = read_either(&root_a, &root_b, &rel_path).map_err(|e| e.to_string())?;
    match binary::classify(&rel_path, &bytes) {
        Media::Text => {
            let hunks = diff::diff_file_text(&root_a, &root_b, &rel_path)
                .map_err(|e| e.to_string())?;
            Ok(FileDiff::Text { hunks })
        }
        Media::Image => Ok(FileDiff::Image),
        Media::Pdf => Ok(FileDiff::Pdf),
        Media::Binary => Ok(FileDiff::Binary),
    }
}

/// Copy one hunk from `from_root` into `to_root`, write to disk, return the re-diff.
#[tauri::command]
pub fn apply_hunk(
    rel_path: String,
    from_root: String,
    to_root: String,
    hunk_id: usize,
) -> Result<Vec<diff::Hunk>, String> {
    diff::apply_hunk(&from_root, &to_root, &rel_path, hunk_id).map_err(|e| e.to_string())
}

/// Whole-file copy (only-in entries / wholesale overwrite).
#[tauri::command]
pub fn copy_file(rel_path: String, from_root: String, to_root: String) -> Result<(), String> {
    diff::copy_file(&from_root, &to_root, &rel_path).map_err(|e| e.to_string())
}

/// Paged hex dump for one side of a (binary) file.
#[tauri::command]
pub fn read_hex(
    rel_path: String,
    root: String,
    offset: usize,
    len: usize,
) -> Result<HexPage, String> {
    let bytes = std::fs::read(Path::new(&root).join(&rel_path)).map_err(|e| e.to_string())?;
    let total = bytes.len();
    let end = (offset + len).min(total);
    let slice = if offset < total {
        &bytes[offset..end]
    } else {
        &[]
    };
    Ok(HexPage {
        rows: binary::hex_dump(slice, offset),
        total,
    })
}

fn read_either(root_a: &str, root_b: &str, rel: &str) -> std::io::Result<Vec<u8>> {
    let pa = Path::new(root_a).join(rel);
    if pa.exists() {
        std::fs::read(pa)
    } else {
        std::fs::read(Path::new(root_b).join(rel))
    }
}
