// Local persistence for settings + comparison history. ponytail: localStorage, not a
// backend config file — the data is tiny, user-local, and non-critical.

const EXCLUDES_KEY = "sbd.excludes";
const RECENTS_KEY = "sbd.recents";
const THEME_KEY = "sbd.theme";
const RECENTS_MAX = 12;

export const DEFAULT_THEME = "One Dark";

export function getTheme(): string {
  return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
}

export function setTheme(name: string) {
  localStorage.setItem(THEME_KEY, name);
}

// Merge-editor display options.
export interface MergeOpts {
  highlightChanges: boolean; // char-level changed-text marks (the underline)
  showCopy: boolean; // bidirectional per-change copy buttons in the center gutter
}

const MERGE_KEY = "sbd.merge";
const DEFAULT_MERGE: MergeOpts = { highlightChanges: true, showCopy: true };

export function getMergeOpts(): MergeOpts {
  try {
    const raw = localStorage.getItem(MERGE_KEY);
    if (raw) return { ...DEFAULT_MERGE, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_MERGE;
}

export function setMergeOpts(opts: MergeOpts) {
  localStorage.setItem(MERGE_KEY, JSON.stringify(opts));
}

export const DEFAULT_EXCLUDES = [
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "target",
  "dist",
  "build",
  "__pycache__",
  ".DS_Store",
  ".idea",
  ".vscode",
];

export function getExcludes(): string[] {
  try {
    const raw = localStorage.getItem(EXCLUDES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_EXCLUDES;
}

export function setExcludes(list: string[]) {
  localStorage.setItem(EXCLUDES_KEY, JSON.stringify(list));
}

export interface Recent {
  mode: "folders" | "files";
  a: string;
  b: string;
  ts: number;
}

export function getRecents(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function addRecent(mode: Recent["mode"], a: string, b: string): Recent[] {
  const without = getRecents().filter((r) => !(r.mode === mode && r.a === a && r.b === b));
  const next = [{ mode, a, b, ts: Date.now() }, ...without].slice(0, RECENTS_MAX);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export function removeRecent(r: Recent): Recent[] {
  const next = getRecents().filter((x) => !(x.mode === r.mode && x.a === r.a && x.b === r.b));
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export function clearRecents(): Recent[] {
  localStorage.removeItem(RECENTS_KEY);
  return [];
}
