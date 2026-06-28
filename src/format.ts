import type { Status } from "./types";

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

/// Join a root dir and a relative path (POSIX-style; fine on macOS/Linux).
export function joinPath(root: string, rel: string): string {
  if (!root) return rel;
  return `${root.replace(/\/$/, "")}/${rel}`;
}
