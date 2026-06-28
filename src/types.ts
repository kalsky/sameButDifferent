// Hand-mirrored from src-tauri/src/model.rs & diff.rs & binary.rs.
// ponytail: hand-written over ts-rs codegen — surface is ~6 types.

export type EntryKind = "File" | "Dir";

// serde enum with #[serde(tag="kind", content="root")] — OnlyIn carries a root index.
export type Status =
  | { kind: "Same" }
  | { kind: "Differ" }
  | { kind: "OnlyIn"; root: number }
  | { kind: "Partial" }
  | { kind: "TypeConflict" };

export interface SideInfo {
  kind: EntryKind;
  size: number;
  mtime: number;
  content_hash: number | null;
}

export interface Entry {
  rel_path: string;
  name: string;
  kind: EntryKind;
  sides: (SideInfo | null)[];
  status: Status;
  children: Entry[];
}

export interface CompareSession {
  roots: string[];
  tree: Entry[];
}

// open_file result — serde tag="kind". Text carries both buffers; the merge editor
// (CodeMirror) does diffing + editing client-side.
export type FileDiff =
  | { kind: "Text"; a: string; b: string }
  | { kind: "Binary" }
  | { kind: "Image" }
  | { kind: "Pdf" };

export interface HexRow {
  offset: number;
  hex: string;
  ascii: string;
}

export interface HexPage {
  rows: HexRow[];
  total: number;
}
