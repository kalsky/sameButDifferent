import { useState } from "react";
import { Folder, File, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import type { CompareSession, Entry } from "../types";
import { statusColor, statusLabel, joinPath } from "../format";
import { copyFile } from "../api";

interface Props {
  session: CompareSession;
  onOpenFile: (rel: string) => void;
  onBack: () => void;
  onRescan: () => void;
}

type Dir = "AtoB" | "BtoA";
interface Pending {
  rel: string;
  dir: Dir;
}

export function FolderView({ session, onOpenFile, onBack, onRescan }: Props) {
  const [diffOnly, setDiffOnly] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [dontAsk, setDontAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rootA, rootB] = session.roots;

  async function doCopy(rel: string, dir: Dir) {
    setBusy(true);
    const [from, to] = dir === "AtoB" ? [rootA, rootB] : [rootB, rootA];
    try {
      await copyFile(joinPath(from, rel), joinPath(to, rel));
      onRescan();
    } finally {
      setBusy(false);
    }
  }

  function requestCopy(rel: string, dir: Dir) {
    if (dontAsk) doCopy(rel, dir);
    else setPending({ rel, dir });
  }

  return (
    <div className="folderview">
      <div className="toolbar">
        <button onClick={onBack}>← New comparison</button>
        <span className="roots">
          <span className="rootlabel">{rootA}</span>
          <span className="rootlabel">{rootB}</span>
        </span>
        <label className="toggle">
          <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
          differences only
        </label>
        <button onClick={onRescan} disabled={busy}><RefreshCw size={14} /> Rescan</button>
      </div>

      <div className="aligned">
        {session.tree.map((e) => (
          <Node
            key={e.rel_path}
            entry={e}
            depth={0}
            diffOnly={diffOnly}
            onOpenFile={onOpenFile}
            onCopy={requestCopy}
          />
        ))}
      </div>

      {pending && (
        <ConfirmModal
          pending={pending}
          dontAsk={dontAsk}
          setDontAsk={setDontAsk}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const { rel, dir } = pending;
            setPending(null);
            doCopy(rel, dir);
          }}
        />
      )}
    </div>
  );
}

function Node({
  entry,
  depth,
  diffOnly,
  onOpenFile,
  onCopy,
}: {
  entry: Entry;
  depth: number;
  diffOnly: boolean;
  onOpenFile: (rel: string) => void;
  onCopy: (rel: string, dir: Dir) => void;
}) {
  const isDir = entry.kind === "Dir";
  const [open, setOpen] = useState(entry.status.kind !== "Same");
  if (diffOnly && entry.status.kind === "Same") return null;

  const presentA = entry.sides[0] != null;
  const presentB = entry.sides[1] != null;
  const changed = entry.status.kind === "Differ";
  const canAtoB = !isDir && (changed || entry.status.kind === "OnlyIn" && presentA);
  const canBtoA = !isDir && (changed || entry.status.kind === "OnlyIn" && presentB);
  const color = statusColor(entry.status);

  return (
    <div>
      <div
        className="arow"
        onClick={() => isDir && setOpen((o) => !o)}
        onDoubleClick={() => !isDir && onOpenFile(entry.rel_path)}
      >
        <Cell depth={depth} isDir={isDir} present={presentA} open={open} name={entry.name} color={color} />
        <div className="arrows" onClick={(e) => e.stopPropagation()}>
          <span className="slot">
            {canAtoB && (
              <button title="copy → right" onClick={() => onCopy(entry.rel_path, "AtoB")}>›</button>
            )}
          </span>
          <span className="slot">
            {canBtoA && (
              <button title="copy ← left" onClick={() => onCopy(entry.rel_path, "BtoA")}>‹</button>
            )}
          </span>
        </div>
        <Cell depth={depth} isDir={isDir} present={presentB} open={open} name={entry.name} color={color} />
        <span className="abadge" style={{ color }}>{statusLabel(entry.status)}</span>
      </div>
      {isDir && open &&
        entry.children.map((c) => (
          <Node key={c.rel_path} entry={c} depth={depth + 1} diffOnly={diffOnly} onOpenFile={onOpenFile} onCopy={onCopy} />
        ))}
    </div>
  );
}

function Cell({
  depth,
  isDir,
  present,
  open,
  name,
  color,
}: {
  depth: number;
  isDir: boolean;
  present: boolean;
  open: boolean;
  name: string;
  color: string;
}) {
  return (
    <div className="acell" style={{ paddingLeft: depth * 16 + 8 }}>
      {present ? (
        <>
          <span className="twisty">
            {isDir ? open ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
          </span>
          {isDir ? <Folder size={14} color="#54aeff" /> : <File size={14} color="#8b949e" />}
          <span className="name" style={{ color }}>{name}</span>
        </>
      ) : (
        <span className="absent">—</span>
      )}
    </div>
  );
}

function ConfirmModal({
  pending,
  dontAsk,
  setDontAsk,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  dontAsk: boolean;
  setDontAsk: (b: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dirText = pending.dir === "AtoB" ? "right (overwrite/add on B)" : "left (overwrite/add on A)";
  return (
    <div className="modalbg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p>
          Copy <code>{pending.rel}</code> to the {dirText}?
        </p>
        <label className="toggle">
          <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
          Don't ask again this session
        </label>
        <div className="modalbtns">
          <button onClick={onCancel}>Cancel</button>
          <button className="compare" onClick={onConfirm}>Copy</button>
        </div>
      </div>
    </div>
  );
}
