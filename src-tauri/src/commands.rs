use crate::binary::{self, HexPage, Media};
use crate::compare;
use crate::diff::FileDiff;
use crate::model::CompareSession;
use crate::walk;
use std::path::Path;

/// Walk N roots, merge by rel_path, and resolve every entry's status.
#[tauri::command]
pub fn scan_session(
    roots: Vec<String>,
    excludes: Vec<String>,
    use_gitignore: bool,
) -> CompareSession {
    let mut tree = walk::build_tree(&roots, &excludes, use_gitignore);
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

/// Write `bytes` to `dest` atomically: fill a temp file in the same directory, then
/// rename over the target. A crash or full disk leaves the original file intact rather
/// than truncated — this is a merge tool, so the file being written is one the user is
/// actively trying not to lose. Same-directory temp keeps the rename on one filesystem.
fn atomic_write(dest: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;

    let parent = dest.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let name = dest.file_name().unwrap_or_default().to_string_lossy();
    let tmp = parent.join(format!(".{name}.sbd-tmp{}", std::process::id()));

    let write = || -> std::io::Result<()> {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?; // flush to disk before the rename, or the swap can outrun the data
        Ok(())
    };
    if let Err(e) = write() {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.to_string());
    }

    if let Err(e) = std::fs::rename(&tmp, dest) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.to_string());
    }
    Ok(())
}

/// Save one side's buffer to disk (explicit; edits and copies never auto-save).
#[tauri::command]
pub fn write_text(path: String, content: String) -> Result<(), String> {
    atomic_write(Path::new(&path), content.as_bytes())
}

/// Whole-file copy in the folder view (add missing / overwrite differing).
#[tauri::command]
pub fn copy_file(from_path: String, to_path: String) -> Result<(), String> {
    let bytes = std::fs::read(&from_path).map_err(|e| e.to_string())?;
    atomic_write(Path::new(&to_path), &bytes)
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
