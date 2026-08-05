# Developing Same But Different

**Stack:** Tauri 2 (Rust core) + React + TypeScript. Rust does the filesystem walk,
hashing, diffing, and file writes; React renders.

## Setup

```bash
npm install
npm run tauri dev      # launch the app with hot reload
```

Rust toolchain plus [Tauri's system prerequisites](https://tauri.app/start/prerequisites/).
On Linux that means the GTK/WebKit dev packages:

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## Test

```bash
cd src-tauri && cargo test    # core logic (walk, compare, diff, hex, atomic writes)
npm test                      # frontend helpers (Vitest)
```

Both run on every PR to `main` — see [`.github/workflows/pr-tests.yml`](.github/workflows/pr-tests.yml).

## Build

```bash
npm run tauri build
```

Builds for the **platform you're running on**: macOS (`.app` + `.dmg`), Windows
(`.exe` + `.msi`), or Linux (`.deb` + `.AppImage`). The release workflow
([`.github/workflows/release.yml`](.github/workflows/release.yml)) is triggered
manually and builds all three into a draft release.

Release builds are currently **unsigned** on macOS and Windows.

## Versioning

`package.json` is the single source of truth. `src-tauri/tauri.conf.json` has
`"version": "../package.json"`, so Tauri reads it from there at build time.

```bash
npm version patch    # bumps the one file that matters
```

Tag releases as `vX.Y.Z` — the in-app update check parses that format and compares it
against the running version. A tag it can't parse is treated as "no update", never as
an error.

## How it works

- **Folder match** is by name+path (`rel_path`). The model holds N roots (`sides` vec),
  so 3-way is a wider render later, not a redesign.
- **Same vs differ** is cheap→expensive: size differs → differ; size+mtime equal →
  assume same (skip read); size equal + mtime differs → hash both (xxhash) and compare.
- **Text files** diff via the `similar` crate; copy chevrons splice a hunk side-to-side
  and re-diff. **Binaries** show a hex dump; **images** and **PDFs** render side-by-side
  (PDFs visually, via the webview's own viewer — not a content diff). Text views get
  syntax highlighting, lazily loaded per language from the file name.
- **Writes are atomic** — a temp file in the destination directory, then a rename. An
  interrupted save leaves the original file intact instead of truncated.
- **What gets skipped** is two things, both in Settings: an exclude list (one name or
  glob per line — `node_modules`, `*.md`; a matching folder prunes its whole subtree),
  and a `.gitignore` toggle, on by default. Excluding happens per-root during the walk,
  so a file is skipped whether or not it exists on the other side. Note that `.gitignore`
  rules only apply inside an actual git repo, and apply per side independently.

## Layout

```
src/                  React UI
  components/         views + modals (Folder, File, Hex, Image, Pdf, Settings, About)
  update.ts           release check against the GitHub API
  storage.ts          localStorage settings + recents
src-tauri/src/
  walk.rs             filesystem walk, excludes, .gitignore
  compare.rs          status resolution (Same / Differ / OnlyIn / TypeConflict)
  commands.rs         Tauri commands, atomic writes
  binary.rs           media classification + hex dump
  tests/core.rs       integration tests (tempfile fixtures, no committed binaries)
```

## Not yet (addable without redesign)

3-way diff UI · PDF *content* diff (text extraction) · content-based move/rename
detection · bulk folder merge.
