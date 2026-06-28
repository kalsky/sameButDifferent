import { describe, it, expect } from "vitest";
import { statusColor, statusLabel, hunksToRows } from "./format";
import type { Hunk } from "./types";

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

describe("hunksToRows", () => {
  it("aligns a replace into one row, blanks for uneven sides", () => {
    const hunks: Hunk[] = [
      { id: 0, tag: "Equal", a_start: 0, a_lines: ["one\n"], b_start: 0, b_lines: ["one\n"] },
      { id: 1, tag: "Replace", a_start: 1, a_lines: ["two\n"], b_start: 1, b_lines: ["TWO\n"] },
      { id: 2, tag: "Insert", a_start: 2, a_lines: [], b_start: 2, b_lines: ["four\n"] },
    ];
    const rows = hunksToRows(hunks);
    expect(rows[0]).toMatchObject({ tag: "Equal", a: "one\n", b: "one\n" });
    expect(rows[1]).toMatchObject({ tag: "Replace", a: "two\n", b: "TWO\n" });
    // insert: a side is blank (null)
    expect(rows[2]).toMatchObject({ tag: "Insert", a: null, b: "four\n" });
  });
});
