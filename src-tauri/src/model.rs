use serde::{Deserialize, Serialize};

/// A comparison of N root folders. v1 uses 2 roots; 3-way later just widens `roots`
/// and every `sides` vec — no model change needed.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CompareSession {
    pub roots: Vec<String>,
    pub tree: Vec<Entry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Entry {
    pub rel_path: String,
    pub name: String,
    pub kind: EntryKind,
    /// index == root index. None = entry missing on that side.
    pub sides: Vec<Option<SideInfo>>,
    pub status: Status,
    /// only populated for Dir entries
    pub children: Vec<Entry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SideInfo {
    pub kind: EntryKind,
    pub size: u64,
    pub mtime: i64,
    /// filled lazily by compare, only when size matches and mtime differs
    pub content_hash: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntryKind {
    File,
    Dir,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(tag = "kind", content = "root")]
pub enum Status {
    /// present & equal on all sides where present
    Same,
    /// present on >=2 sides, content differs
    Differ,
    /// present on exactly one side (carries that root index)
    OnlyIn(usize),
    /// present on some but not all sides (when n > 2)
    Partial,
    /// file vs dir mismatch across sides
    TypeConflict,
}
