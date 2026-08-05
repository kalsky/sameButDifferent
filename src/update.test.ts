import { describe, it, expect } from "vitest";
import { parseVersion, isNewer } from "./update";

describe("parseVersion", () => {
  it("accepts bare and v-prefixed versions", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("  v0.2.0 ")).toEqual([0, 2, 0]);
    expect(parseVersion("1.2.3-beta.1")).toEqual([1, 2, 3]);
  });

  it("returns null for junk rather than guessing", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("release-2024")).toBeNull();
  });
});

describe("isNewer", () => {
  it("compares each segment numerically, not as text", () => {
    expect(isNewer("v0.10.0", "v0.9.0")).toBe(true); // 10 > 9, though "10" < "9" as strings
    expect(isNewer("v1.0.0", "v0.99.99")).toBe(true);
    expect(isNewer("v0.2.1", "v0.2.0")).toBe(true);
  });

  it("is false for equal or older", () => {
    expect(isNewer("v0.2.0", "v0.2.0")).toBe(false);
    expect(isNewer("v0.2.0", "0.2.0")).toBe(false); // prefix mismatch is not a difference
    expect(isNewer("v0.1.0", "v0.2.0")).toBe(false);
  });

  it("stays quiet when either side is unparseable", () => {
    // The point: never claim an update exists off a tag we could not read.
    expect(isNewer("nightly", "0.2.0")).toBe(false);
    expect(isNewer("v9.9.9", "unknown")).toBe(false);
    expect(isNewer("", "")).toBe(false);
  });
});
