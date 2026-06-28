import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Settings, Folder, File, X } from "lucide-react";
import type { Recent } from "../storage";

interface Props {
  onCompareFolders: (a: string, b: string) => void;
  onCompareFiles: (a: string, b: string) => void;
  recents: Recent[];
  onPick: (r: Recent) => void;
  onRemoveRecent: (r: Recent) => void;
  onClearRecents: () => void;
  onOpenSettings: () => void;
}

type Mode = "folders" | "files";

const basename = (p: string) => p.replace(/\/$/, "").split("/").pop() || p;

// Launch screen: pick two folders or two files to compare. Array-ish so 3-way slots in later.
export function HomeView({
  onCompareFolders,
  onCompareFiles,
  recents,
  onPick,
  onRemoveRecent,
  onClearRecents,
  onOpenSettings,
}: Props) {
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
      <button className="settingsbtn" title="Settings" onClick={onOpenSettings}><Settings size={16} /></button>
      <h1>Same But Different</h1>
      <div className="modeswitch">
        <button className={mode === "folders" ? "on" : ""} onClick={() => setMode("folders")}>
          <Folder size={15} /> Compare Folders
        </button>
        <button className={mode === "files" ? "on" : ""} onClick={() => setMode("files")}>
          <File size={15} /> Compare Files
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
          <div className="recentshead">
            <h3>Recent</h3>
            <button className="link" onClick={onClearRecents}>Clear all</button>
          </div>
          {recents.map((r, i) => (
            <div key={i} className="recent">
              <button className="recopen" title={`${r.a}\n${r.b}`} onClick={() => onPick(r)}>
                <span className="recicon">
                  {r.mode === "folders" ? <Folder size={14} color="#54aeff" /> : <File size={14} color="#8b949e" />}
                </span>
                <span className="recpair">
                  {basename(r.a)} <span className="vs">↔</span> {basename(r.b)}
                </span>
              </button>
              <button className="recdel" title="Remove" onClick={() => onRemoveRecent(r)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
