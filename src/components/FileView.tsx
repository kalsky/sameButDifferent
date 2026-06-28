import { useEffect, useRef, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView, basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import type { FileDiff } from "../types";
import { openFile, writeText } from "../api";
import { HexView } from "./HexView";
import { ImageView } from "./ImageView";

interface Props {
  pathA: string;
  pathB: string;
  title: string;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
}


export function FileView({ pathA, pathB, title, onBack, onDirtyChange }: Props) {
  const [kind, setKind] = useState<FileDiff["kind"] | null>(null);
  const [dirtyA, setDirtyA] = useState(false);
  const [dirtyB, setDirtyB] = useState(false);
  const [status, setStatus] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const merge = useRef<MergeView | null>(null);

  useEffect(() => onDirtyChange(dirtyA || dirtyB), [dirtyA, dirtyB, onDirtyChange]);

  function recomputeStatus() {
    const mv = merge.current;
    if (!mv) return;
    const same = mv.a.state.doc.toString() === mv.b.state.doc.toString();
    setStatus(same ? "✓ No differences" : `${mv.chunks.length} difference block(s)`);
  }

  useEffect(() => {
    let live = true;
    setKind(null);
    setDirtyA(false);
    setDirtyB(false);
    setStatus("");
    merge.current?.destroy();
    merge.current = null;

    openFile(pathA, pathB).then((fd) => {
      if (!live) return;
      setKind(fd.kind);
      if (fd.kind === "Text" && host.current) {
        const mark = (side: "A" | "B") =>
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              (side === "A" ? setDirtyA : setDirtyB)(true);
              recomputeStatus();
            }
          });
        merge.current = new MergeView({
          // No collapseUnchanged: always show full file content (incl. identical files).
          a: { doc: fd.a, extensions: [basicSetup, oneDark, mark("A")] },
          b: { doc: fd.b, extensions: [basicSetup, oneDark, mark("B")] },
          parent: host.current,
        });
        recomputeStatus();
      }
    });

    return () => {
      live = false;
      merge.current?.destroy();
      merge.current = null;
    };
  }, [pathA, pathB]);

  function copyAll(dir: "AtoB" | "BtoA") {
    const mv = merge.current;
    if (!mv) return;
    const [src, dst] = dir === "AtoB" ? [mv.a, mv.b] : [mv.b, mv.a];
    dst.dispatch({
      changes: { from: 0, to: dst.state.doc.length, insert: src.state.doc.toString() },
    });
  }

  async function save(side: "A" | "B") {
    const mv = merge.current;
    if (!mv) return;
    if (side === "A") {
      await writeText(pathA, mv.a.state.doc.toString());
      setDirtyA(false);
    } else {
      await writeText(pathB, mv.b.state.doc.toString());
      setDirtyB(false);
    }
  }

  return (
    <div className="fileview">
      <div className="toolbar">
        <button onClick={onBack}>← Back</button>
        <span className="filetitle">{title}</span>
      </div>

      {kind === "Text" && (
        <div className="sideheaders">
          <div className="sidehead">
            <button className={dirtyA ? "save dirty" : "save"} disabled={!dirtyA} onClick={() => save("A")}>
              {dirtyA ? "● " : ""}Save left
            </button>
            <button title="copy left → right" onClick={() => copyAll("AtoB")}>Copy all →</button>
          </div>
          <div className="sidehead">
            <button title="copy right → left" onClick={() => copyAll("BtoA")}>← Copy all</button>
            <button className={dirtyB ? "save dirty" : "save"} disabled={!dirtyB} onClick={() => save("B")}>
              {dirtyB ? "● " : ""}Save right
            </button>
          </div>
        </div>
      )}

      {kind === null && <p className="hint">Loading…</p>}
      <div ref={host} className="merge" style={{ display: kind === "Text" ? "block" : "none" }} />
      {kind === "Binary" && <HexView pathA={pathA} pathB={pathB} />}
      {kind === "Image" && <ImageView pathA={pathA} pathB={pathB} />}
      {kind === "Pdf" && <p className="hint">PDF compare coming in v1.1 — files differ.</p>}

      {kind === "Text" && <div className="statusbar">{status}</div>}
    </div>
  );
}
