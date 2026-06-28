import { describe, it, expect } from "vitest";
import { statusColor, statusLabel, joinPath } from "./format";

describe("status helpers", () => {
  it("labels and colors each status", () => {
    expect(statusLabel({ kind: "Same" })).toBe("same");
    expect(statusLabel({ kind: "Differ" })).toBe("differ");
    expect(statusLabel({ kind: "OnlyIn", root: 0 })).toBe("only in A");
    expect(statusLabel({ kind: "OnlyIn", root: 1 })).toBe("only in B");
    expect(statusColor({ kind: "OnlyIn", root: 0 })).not.toBe(
      statusColor({ kind: "OnlyIn", root: 1 }),
    );
  });
});

describe("joinPath", () => {
  it("joins root and rel, trimming a trailing slash", () => {
    expect(joinPath("/a/b", "c/d.txt")).toBe("/a/b/c/d.txt");
    expect(joinPath("/a/b/", "c.txt")).toBe("/a/b/c.txt");
    expect(joinPath("", "c.txt")).toBe("c.txt");
  });
});
