import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import type { CompareSession } from "./types";
import { scanSession } from "./api";
import { joinPath } from "./format";
import { HomeView } from "./components/HomeView";
import { FolderView } from "./components/FolderView";
import { FileView } from "./components/FileView";

type View = "home" | "folder" | "file";

interface OpenFile {
  pathA: string;
  pathB: string;
  title: string;
  returnTo: "home" | "folder";
}

interface Confirm {
  msg: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const basename = (p: string) => p.replace(/\/$/, "").split("/").pop() || p;

function App() {
  const [view, setView] = useState<View>("home");
  const [session, setSession] = useState<CompareSession | null>(null);
  const [file, setFile] = useState<OpenFile | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const unsavedRef = useRef(false);

  const setDirty = useCallback((d: boolean) => {
    unsavedRef.current = d;
  }, []);

  // Guard the window close: if there are unsaved edits, ask before discarding.
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested((e) => {
      if (unsavedRef.current) {
        e.preventDefault();
        setConfirm({
          msg: "You have unsaved changes. Close anyway and discard them?",
          confirmLabel: "Discard & close",
          onConfirm: () => {
            unsavedRef.current = false;
            getCurrentWindow().destroy();
          },
        });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  async function compareFolders(a: string, b: string) {
    setSession(await scanSession([a, b]));
    setView("folder");
  }

  function compareFiles(a: string, b: string) {
    setFile({ pathA: a, pathB: b, title: `${basename(a)} ↔ ${basename(b)}`, returnTo: "home" });
    setView("file");
  }

  function openFromFolder(rel: string) {
    if (!session) return;
    const [rootA, rootB] = session.roots;
    setFile({
      pathA: joinPath(rootA, rel),
      pathB: joinPath(rootB, rel),
      title: rel,
      returnTo: "folder",
    });
    setView("file");
  }

  // Leaving the file view also risks losing unsaved edits — guard it too.
  function leaveFile() {
    const go = () => {
      unsavedRef.current = false;
      setView(file?.returnTo ?? "home");
    };
    if (unsavedRef.current) {
      setConfirm({
        msg: "You have unsaved changes in this file. Leave and discard them?",
        confirmLabel: "Discard & leave",
        onConfirm: go,
      });
    } else {
      go();
    }
  }

  async function rescan() {
    if (session) setSession(await scanSession(session.roots));
  }

  const folderActive = view === "folder";

  return (
    <div className="app">
      {view === "home" && (
        <HomeView onCompareFolders={compareFolders} onCompareFiles={compareFiles} />
      )}

      {/* FolderView stays mounted while drilling into files so its filter/expansion/scroll persist. */}
      {session && (
        <div className={"viewhost" + (folderActive ? "" : " hidden")}>
          <FolderView
            session={session}
            onOpenFile={openFromFolder}
            onBack={() => setView("home")}
            onRescan={rescan}
          />
        </div>
      )}

      {view === "file" && file && (
        <div className="viewhost">
          <FileView
            pathA={file.pathA}
            pathB={file.pathB}
            title={file.title}
            onBack={leaveFile}
            onDirtyChange={setDirty}
          />
        </div>
      )}

      {confirm && (
        <div className="modalbg" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>{confirm.msg}</p>
            <div className="modalbtns">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  const fn = confirm.onConfirm;
                  setConfirm(null);
                  fn();
                }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
