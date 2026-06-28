use serde::{Deserialize, Serialize};

/// What `open_file` returns. The frontend switches its view on `kind`.
/// Text carries both sides' content; the editor (CodeMirror merge) does the diffing
/// and editing client-side, so there are no server-side hunks anymore.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind")]
pub enum FileDiff {
    Text { a: String, b: String },
    Binary,
    Image,
    Pdf,
}
