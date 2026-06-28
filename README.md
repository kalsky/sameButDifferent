# sameButDifferent

A folder & file diff/merge tool — an Araxis Merge / Beyond Compare replacement.
Compare 2 folders (3-way later), see which files differ, open per-file side-by-side
diffs, and copy changes side-to-side.

**Stack:** Tauri 2 (Rust core) + React + TypeScript. Rust does the filesystem walk,
hashing, diffing, and file writes; React renders.

## Develop

```bash
npm install
npm run tauri dev      # launch the app
```

## Test

```bash
cd src-tauri && cargo test    # core logic (walk, compare, diff, hex)
npm test                      # frontend helpers (Vitest)
```

## Build

```bash
npm run tauri build           # produces a macOS app bundle
```

## How it works

- **Folder match** is by name+path (`rel_path`). The model holds N roots (`sides` vec),
  so 3-way is a wider render later, not a redesign.
- **Same vs differ** is cheap→expensive: size differs → differ; size+mtime equal →
  assume same (skip read); size equal + mtime differs → hash both (xxhash) and compare.
- **Text files** diff via the `similar` crate; copy chevrons splice a hunk side-to-side
  and re-diff. **Binaries** show a hex dump; **images** show side-by-side; **PDF** is
  v1.1.

## Not yet (addable without redesign)

3-way diff UI · PDF rendering · content-based move/rename detection · syntax
highlighting · `.gitignore` toggle · atomic writes · bulk folder merge.
