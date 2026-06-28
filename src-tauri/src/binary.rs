use serde::{Deserialize, Serialize};
use std::path::Path;

const SNIFF_LEN: usize = 8192;

/// Git's heuristic: a NUL byte in the first 8KB means binary.
pub fn is_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(SNIFF_LEN).any(|&b| b == 0)
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Media {
    Text,
    Image,
    Pdf,
    Binary,
}

/// Classify a file by extension (images/pdf) then content sniff (text vs binary).
pub fn classify(rel: &str, bytes: &[u8]) -> Media {
    let ext = Path::new(rel)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg" => Media::Image,
        "pdf" => Media::Pdf,
        _ => {
            if is_binary(bytes) {
                Media::Binary
            } else {
                Media::Text
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct HexRow {
    pub offset: usize,
    pub hex: String,   // space-separated byte pairs, e.g. "48 65 6c 6c 6f"
    pub ascii: String, // printable bytes, '.' otherwise
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HexPage {
    pub rows: Vec<HexRow>,
    pub total: usize,
}

/// Classic 16-bytes-per-row hex dump of a byte slice, starting at `base_offset`.
pub fn hex_dump(bytes: &[u8], base_offset: usize) -> Vec<HexRow> {
    bytes
        .chunks(16)
        .enumerate()
        .map(|(i, chunk)| {
            let hex = chunk
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<Vec<_>>()
                .join(" ");
            let ascii = chunk
                .iter()
                .map(|&b| {
                    if (0x20..=0x7e).contains(&b) {
                        b as char
                    } else {
                        '.'
                    }
                })
                .collect();
            HexRow {
                offset: base_offset + i * 16,
                hex,
                ascii,
            }
        })
        .collect()
}
