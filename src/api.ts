import { invoke } from "@tauri-apps/api/core";
import type { CompareSession, FileDiff, HexPage } from "./types";

export const scanSession = (roots: string[]) =>
  invoke<CompareSession>("scan_session", { roots });

// File ops take full paths (so the folder view and direct file-pick mode share them).
export const openFile = (pathA: string, pathB: string) =>
  invoke<FileDiff>("open_file", { pathA, pathB });

export const writeText = (path: string, content: string) =>
  invoke<void>("write_text", { path, content });

export const copyFile = (fromPath: string, toPath: string) =>
  invoke<void>("copy_file", { fromPath, toPath });

export const readHex = (path: string, offset: number, len: number) =>
  invoke<HexPage>("read_hex", { path, offset, len });
