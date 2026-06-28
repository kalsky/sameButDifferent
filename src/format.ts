import type { Status, Hunk } from "./types";

export function statusColor(s: Status): string {
  switch (s.kind) {
    case "Same":
      return "#3fb950"; // green
    case "Differ":
      return "#d29922"; // orange
    case "OnlyIn":
      return s.root === 0 ? "#58a6ff" : "#bc8cff"; // blue A / purple B
    case "Partial":
      return "#bc8cff";
    case "TypeConflict":
      return "#f85149"; // red
  }
}

export function statusLabel(s: Status): string {
  switch (s.kind) {
    case "Same":
      return "same";
    case "Differ":
      return "differ";
    case "OnlyIn":
      return `only in ${String.fromCharCode(65 + s.root)}`;
    case "Partial":
      return "partial";
    case "TypeConflict":
      return "type conflict";
  }
}

export interface Row {
  tag: Hunk["tag"];
  hunkId: number;
  // null = blank (the other side has no corresponding line)
  a: string | null;
  b: string | null;
}

/// Flatten hunks into aligned side-by-side rows for rendering.
export function hunksToRows(hunks: Hunk[]): Row[] {
  const rows: Row[] = [];
  for (const h of hunks) {
    if (h.tag === "Equal") {
      rows.push({ tag: "Equal", hunkId: h.id, a: h.a_lines[0] ?? "", b: h.b_lines[0] ?? "" });
      continue;
    }
    const n = Math.max(h.a_lines.length, h.b_lines.length);
    for (let i = 0; i < n; i++) {
      rows.push({
        tag: h.tag,
        hunkId: h.id,
        a: i < h.a_lines.length ? h.a_lines[i] : null,
        b: i < h.b_lines.length ? h.b_lines[i] : null,
      });
    }
  }
  return rows;
}
