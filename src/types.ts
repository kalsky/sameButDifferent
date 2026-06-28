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

export type HunkTag = "Equal" | "Insert" | "Delete" | "Replace";

export interface Hunk {
  id: number;
  tag: HunkTag;
  a_start: number;
  a_lines: string[];
  b_start: number;
  b_lines: string[];
}

// diff_file result — serde tag="kind"
export type FileDiff =
  | { kind: "Text"; hunks: Hunk[] }
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
