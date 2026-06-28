import { invoke } from "@tauri-apps/api/core";
import type { CompareSession, FileDiff, Hunk, HexPage } from "./types";

export const scanSession = (roots: string[]) =>
  invoke<CompareSession>("scan_session", { roots });

export const diffFile = (relPath: string, rootA: string, rootB: string) =>
  invoke<FileDiff>("diff_file", { relPath, rootA, rootB });

export const applyHunk = (
  relPath: string,
  fromRoot: string,
  toRoot: string,
  hunkId: number,
) => invoke<Hunk[]>("apply_hunk", { relPath, fromRoot, toRoot, hunkId });

export const copyFile = (relPath: string, fromRoot: string, toRoot: string) =>
  invoke<void>("copy_file", { relPath, fromRoot, toRoot });

export const readHex = (relPath: string, root: string, offset: number, len: number) =>
  invoke<HexPage>("read_hex", { relPath, root, offset, len });
