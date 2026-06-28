import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Recent } from "../storage";

interface Props {
  onCompareFolders: (a: string, b: string) => void;
  onCompareFiles: (a: string, b: string) => void;
  recents: Recent[];
  onPick: (r: Recent) => void;
  onOpenSettings: () => void;
}

type Mode = "folders" | "files";

const basename = (p: string) => p.replace(/\/$/, "").split("/").pop() || p;

// Launch screen: pick two folders or two files to compare. Array-ish so 3-way slots in later.
export function HomeView({ onCompareFolders, onCompareFiles, recents, onPick, onOpenSettings }: Props) {
  const [mode, setMode] = useState<Mode>("folders");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  async function pick(set: (s: string) => void) {
    const sel = await open({ directory: mode === "folders" });
    if (typeof sel === "string") set(sel);
  }

  const ready = a && b;
  const go = () => (mode === "folders" ? onCompareFolders(a, b) : onCompareFiles(a, b));

  return (
    <div className="home">
      <button className="settingsbtn" title="Settings" onClick={onOpenSettings}>⚙</button>
      <h1>Same But Different</h1>
      <div className="modeswitch">
        <button className={mode === "folders" ? "on" : ""} onClick={() => setMode("folders")}>
          📁 Compare Folders
        </button>
        <button className={mode === "files" ? "on" : ""} onClick={() => setMode("files")}>
          📄 Compare Files
        </button>
      </div>

      <div className="pickrow">
        <button className="pickbtn big" onClick={() => pick(setA)}>
          {a || `Left ${mode === "folders" ? "folder" : "file"}…`}
        </button>
        <span className="vs">vs</span>
        <button className="pickbtn big" onClick={() => pick(setB)}>
          {b || `Right ${mode === "folders" ? "folder" : "file"}…`}
        </button>
      </div>

      <button className="compare big" disabled={!ready} onClick={go}>
        Compare →
      </button>

      {recents.length > 0 && (
        <div className="recents">
          <h3>Recent</h3>
          {recents.map((r, i) => (
            <button key={i} className="recent" onClick={() => onPick(r)}>
              <span className="recicon">{r.mode === "folders" ? "📁" : "📄"}</span>
              <span className="recpair">
                {basename(r.a)} <span className="vs">↔</span> {basename(r.b)}
              </span>
              <span className="recpath">{r.a}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
