import { useEffect, useRef, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView, basicSetup } from "codemirror";
import { gutter, GutterMarker } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { ChevronUp, ChevronDown, ArrowLeft, Save } from "lucide-react";
import type { FileDiff } from "../types";
import type { MergeOpts } from "../storage";
import { openFile, writeText } from "../api";
import { themeExt } from "../themes";
import { HexView } from "./HexView";
import { ImageView } from "./ImageView";

// A change block, in character offsets on each side.
interface ChunkPos {
  fromA: number;
  toA: number;
  fromB: number;
  toB: number;
}

// State field (on editor B) holding the current chunks, fed from MergeView.chunks.
// The copy gutter reads it; updating it re-renders the gutter markers in place.
const setChunks = StateEffect.define<ChunkPos[]>();
const chunksField = StateField.define<ChunkPos[]>({
  create: () => [],
  update(val, tr) {
    for (const e of tr.effects) if (e.is(setChunks)) return e.value;
    return val;
  },
});

// Gutter marker with two buttons (→ copy left→right, ← copy right→left) at a change.
class CopyMarker extends GutterMarker {
  constructor(
    readonly chunk: ChunkPos,
    readonly onCopy: (c: ChunkPos, dir: "AtoB" | "BtoA") => void,
  ) {
    super();
  }
  eq(other: CopyMarker) {
    const a = this.chunk;
    const b = other.chunk;
    return a.fromA === b.fromA && a.toA === b.toA && a.fromB === b.fromB && a.toB === b.toB;
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-copybtns";
    const right = document.createElement("button");
    right.textContent = "→";
    right.title = "copy left → right";
    right.onclick = (e) => {
      e.stopPropagation();
      this.onCopy(this.chunk, "AtoB");
    };
    const left = document.createElement("button");
    left.textContent = "←";
    left.title = "copy right → left";
    left.onclick = (e) => {
      e.stopPropagation();
      this.onCopy(this.chunk, "BtoA");
    };
    wrap.append(right, left);
    return wrap;
  }
}

// Pick + lazily load a syntax-highlighting extension from the file's name. [] if unknown.
async function loadLanguage(path: string): Promise<Extension> {
  const name = path.split("/").pop() || "";
  const desc = LanguageDescription.matchFilename(languages, name);
  if (!desc) return [];
  try {
    return await desc.load();
  } catch {
    return [];
  }
}

interface Props {
  pathA: string;
  pathB: string;
  title: string;
  theme: string;
  mergeOpts: MergeOpts;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function FileView({ pathA, pathB, title, theme, mergeOpts, onBack, onDirtyChange }: Props) {
  const [kind, setKind] = useState<FileDiff["kind"] | null>(null);
  const [dirtyA, setDirtyA] = useState(false);
  const [dirtyB, setDirtyB] = useState(false);
  const [status, setStatus] = useState("");
  const [marks, setMarks] = useState<number[]>([]); // diff positions as 0..1 ratios (minimap)
  const host = useRef<HTMLDivElement>(null);
  const merge = useRef<MergeView | null>(null);
  const offsets = useRef<number[]>([]); // chunk start offsets (side B) for next/prev
  const cursor = useRef(-1);

  useEffect(() => onDirtyChange(dirtyA || dirtyB), [dirtyA, dirtyB, onDirtyChange]);

  function refresh() {
    const mv = merge.current;
    if (!mv) return;
    const chunks: ChunkPos[] = mv.chunks.map((c) => ({
      fromA: c.fromA,
      toA: c.toA,
      fromB: c.fromB,
      toB: c.toB,
    }));
    const same = mv.a.state.doc.toString() === mv.b.state.doc.toString();
    const len = Math.max(1, mv.b.state.doc.length);
    offsets.current = chunks.map((c) => c.fromB);
    setMarks(chunks.map((c) => c.fromB / len));
    setStatus(same ? "✓ No differences" : `${chunks.length} difference block(s)`);
    if (mergeOpts.showCopy) {
      // feed chunks to the gutter (deferred so we never dispatch mid-update)
      queueMicrotask(() => merge.current?.b.dispatch({ effects: setChunks.of(chunks) }));
    }
  }

  function scrollTo(pos: number) {
    merge.current?.b.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "center" }) });
  }

  function jump(i: number) {
    if (i < 0 || i >= offsets.current.length) return;
    cursor.current = i;
    scrollTo(offsets.current[i]);
  }

  function step(dir: 1 | -1) {
    const n = offsets.current.length;
    if (n === 0) return;
    cursor.current = (cursor.current + dir + n) % n;
    scrollTo(offsets.current[cursor.current]);
  }

  // Copy one change block between buffers (in memory). MergeView re-diffs automatically.
  function copyChunk(c: ChunkPos, dir: "AtoB" | "BtoA") {
    const mv = merge.current;
    if (!mv) return;
    if (dir === "AtoB") {
      const text = mv.a.state.doc.sliceString(c.fromA, c.toA);
      mv.b.dispatch({ changes: { from: c.fromB, to: c.toB, insert: text } });
    } else {
      const text = mv.b.state.doc.sliceString(c.fromB, c.toB);
      mv.a.dispatch({ changes: { from: c.fromA, to: c.toA, insert: text } });
    }
  }

  useEffect(() => {
    let live = true;
    setKind(null);
    setDirtyA(false);
    setDirtyB(false);
    setStatus("");
    setMarks([]);
    offsets.current = [];
    cursor.current = -1;
    merge.current?.destroy();
    merge.current = null;

    openFile(pathA, pathB).then(async (fd) => {
      if (!live) return;
      setKind(fd.kind);
      if (fd.kind === "Text" && host.current) {
        const lang = await loadLanguage(pathA || pathB);
        if (!live || !host.current) return;
        const th = themeExt(theme);
        const mark = (side: "A" | "B") =>
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              (side === "A" ? setDirtyA : setDirtyB)(true);
              refresh();
            }
          });
        // Bidirectional copy gutter on editor B (sits at the center divider).
        const copyGutter = gutter({
          class: "cm-copygutter",
          markers: (view) => {
            const chunks = view.state.field(chunksField, false) || [];
            const builder = new RangeSetBuilder<GutterMarker>();
            for (const c of chunks) {
              const line = view.state.doc.lineAt(Math.min(c.fromB, view.state.doc.length));
              builder.add(line.from, line.from, new CopyMarker(c, copyChunk));
            }
            return builder.finish();
          },
        });
        const bExtra = mergeOpts.showCopy ? [copyGutter, chunksField] : [];
        merge.current = new MergeView({
          a: { doc: fd.a, extensions: [basicSetup, th, lang, mark("A")] },
          b: { doc: fd.b, extensions: [...bExtra, basicSetup, th, lang, mark("B")] },
          parent: host.current,
          highlightChanges: mergeOpts.highlightChanges,
        });
        refresh();
      }
    });

    return () => {
      live = false;
      merge.current?.destroy();
      merge.current = null;
    };
  }, [pathA, pathB, theme, mergeOpts]);

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
        <button onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <span className="filetitle">{title}</span>
        {kind === "Text" && (
          <span className="diffnav">
            <button title="previous difference" disabled={!marks.length} onClick={() => step(-1)}>
              <ChevronUp size={15} />
            </button>
            <button title="next difference" disabled={!marks.length} onClick={() => step(1)}>
              <ChevronDown size={15} />
            </button>
          </span>
        )}
      </div>

      {kind === "Text" && (
        <div className="sideheaders">
          <div className="sidehead">
            <button className={dirtyA ? "save dirty" : "save"} disabled={!dirtyA} onClick={() => save("A")}>
              <Save size={14} /> {dirtyA ? "● " : ""}Save left
            </button>
            <button title="copy left → right" onClick={() => copyAll("AtoB")}>Copy all →</button>
          </div>
          <div className="sidehead">
            <button title="copy right → left" onClick={() => copyAll("BtoA")}>← Copy all</button>
            <button className={dirtyB ? "save dirty" : "save"} disabled={!dirtyB} onClick={() => save("B")}>
              <Save size={14} /> {dirtyB ? "● " : ""}Save right
            </button>
          </div>
        </div>
      )}

      {kind === null && <p className="hint">Loading…</p>}

      <div className="mergewrap" style={{ display: kind === "Text" ? "flex" : "none" }}>
        <div ref={host} className="merge" />
        <div className="minimap" title="differences overview">
          {marks.map((r, i) => (
            <button
              key={i}
              className="tick"
              style={{ top: `calc(${(r * 100).toFixed(2)}% - 2px)` }}
              onClick={() => jump(i)}
            />
          ))}
        </div>
      </div>

      {kind === "Binary" && <HexView pathA={pathA} pathB={pathB} />}
      {kind === "Image" && <ImageView pathA={pathA} pathB={pathB} />}
      {kind === "Pdf" && <p className="hint">PDF compare coming in v1.1 — files differ.</p>}

      {kind === "Text" && <div className="statusbar">{status}</div>}
    </div>
  );
}
