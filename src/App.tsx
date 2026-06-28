import { useState } from "react";
import "./App.css";
import type { CompareSession, Entry, FileDiff } from "./types";
import { scanSession, diffFile, applyHunk, copyFile } from "./api";
import { RootPicker } from "./components/RootPicker";
import { TreeView } from "./components/TreeView";
import { DiffView } from "./components/DiffView";
import { HexView } from "./components/HexView";
import { ImageView } from "./components/ImageView";

interface OpenFile {
  entry: Entry;
  diff: FileDiff;
}

function App() {
  const [roots, setRoots] = useState<string[]>(["", ""]); // 2-way; push a 3rd later
  const [session, setSession] = useState<CompareSession | null>(null);
  const [diffOnly, setDiffOnly] = useState(true);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);

  async function compare() {
    setOpenFile(null);
    setSession(await scanSession(roots));
  }

  async function openEntry(entry: Entry) {
    if (entry.kind !== "File") return;
    const diff = await diffFile(entry.rel_path, roots[0], roots[1]);
    setOpenFile({ entry, diff });
  }

  async function onCopy(hunkId: number, dir: "AtoB" | "BtoA") {
    if (!openFile) return;
    const [from, to] = dir === "AtoB" ? [roots[0], roots[1]] : [roots[1], roots[0]];
    const hunks = await applyHunk(openFile.entry.rel_path, from, to, hunkId);
    setOpenFile({ ...openFile, diff: { kind: "Text", hunks } });
  }

  async function copyWhole(dir: "AtoB" | "BtoA") {
    if (!openFile) return;
    const [from, to] = dir === "AtoB" ? [roots[0], roots[1]] : [roots[1], roots[0]];
    await copyFile(openFile.entry.rel_path, from, to);
    await compare();
  }

  return (
    <div className="app">
      <header>
        <RootPicker roots={roots} setRoots={setRoots} onCompare={compare} />
        <label className="toggle">
          <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
          differences only
        </label>
      </header>

      <div className="body">
        <aside className="sidebar">
          {session ? (
            <TreeView tree={session.tree} onOpen={openEntry} diffOnly={diffOnly} />
          ) : (
            <p className="hint">Pick two folders and Compare.</p>
          )}
        </aside>

        <main className="content">
          {openFile ? (
            <Viewer
              file={openFile}
              rootA={roots[0]}
              rootB={roots[1]}
              onCopy={onCopy}
              copyWhole={copyWhole}
            />
          ) : (
            <p className="hint">Select a file to view its diff.</p>
          )}
        </main>
      </div>
    </div>
  );
}

function Viewer({
  file,
  rootA,
  rootB,
  onCopy,
  copyWhole,
}: {
  file: OpenFile;
  rootA: string;
  rootB: string;
  onCopy: (id: number, dir: "AtoB" | "BtoA") => void;
  copyWhole: (dir: "AtoB" | "BtoA") => void;
}) {
  const { entry, diff } = file;
  return (
    <>
      <div className="filebar">
        <span>{entry.rel_path}</span>
        {entry.status.kind === "OnlyIn" && (
          <span className="wholecopy">
            <button onClick={() => copyWhole(entry.status.kind === "OnlyIn" && entry.status.root === 0 ? "AtoB" : "BtoA")}>
              copy whole file →
            </button>
          </span>
        )}
      </div>
      {diff.kind === "Text" && (
        <DiffView hunks={diff.hunks} rootA={rootA} rootB={rootB} onCopy={onCopy} />
      )}
      {diff.kind === "Binary" && (
        <HexView relPath={entry.rel_path} rootA={rootA} rootB={rootB} />
      )}
      {diff.kind === "Image" && (
        <ImageView relPath={entry.rel_path} rootA={rootA} rootB={rootB} />
      )}
      {diff.kind === "Pdf" && <p className="hint">PDF compare coming in v1.1 — files differ.</p>}
    </>
  );
}

export default App;
