use crate::binary::{self, HexPage, Media};
use crate::compare;
use crate::diff::FileDiff;
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

/// Open a file pair (full paths) for the side-by-side view. A missing side reads as
/// empty (only-in files). Text carries both buffers so the UI edits in memory.
#[tauri::command]
pub fn open_file(path_a: String, path_b: String) -> Result<FileDiff, String> {
    let bytes_a = std::fs::read(&path_a).unwrap_or_default();
    let bytes_b = std::fs::read(&path_b).unwrap_or_default();
    // Classify on whichever side actually has bytes (prefer A).
    let (probe_path, probe_bytes) = if !bytes_a.is_empty() {
        (&path_a, &bytes_a)
    } else {
        (&path_b, &bytes_b)
    };
    match binary::classify(probe_path, probe_bytes) {
        Media::Text => {
            let a = String::from_utf8_lossy(&bytes_a).into_owned();
            let b = String::from_utf8_lossy(&bytes_b).into_owned();
            Ok(FileDiff::Text { a, b })
        }
        Media::Image => Ok(FileDiff::Image),
        Media::Pdf => Ok(FileDiff::Pdf),
        Media::Binary => Ok(FileDiff::Binary),
    }
}

/// Save one side's buffer to disk (explicit; edits and copies never auto-save).
#[tauri::command]
pub fn write_text(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

/// Whole-file copy in the folder view (add missing / overwrite differing).
#[tauri::command]
pub fn copy_file(from_path: String, to_path: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::copy(&from_path, &to_path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Paged hex dump for one side of a (binary) file.
#[tauri::command]
pub fn read_hex(path: String, offset: usize, len: usize) -> Result<HexPage, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let total = bytes.len();
    let end = (offset + len).min(total);
    let slice = if offset < total { &bytes[offset..end] } else { &[] };
    Ok(HexPage {
        rows: binary::hex_dump(slice, offset),
        total,
    })
}
