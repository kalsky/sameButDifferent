import { useState } from "react";
import type { Entry } from "../types";
import { statusColor, statusLabel } from "../format";

interface Props {
  tree: Entry[];
  onOpen: (entry: Entry) => void;
  diffOnly: boolean;
}

export function TreeView({ tree, onOpen, diffOnly }: Props) {
  return (
    <div className="tree">
      {tree.map((e) => (
        <Node key={e.rel_path} entry={e} depth={0} onOpen={onOpen} diffOnly={diffOnly} />
      ))}
    </div>
  );
}

function Node({
  entry,
  depth,
  onOpen,
  diffOnly,
}: {
  entry: Entry;
  depth: number;
  onOpen: (e: Entry) => void;
  diffOnly: boolean;
}) {
  const isDir = entry.kind === "Dir";
  // collapse "same" subtrees by default
  const [open, setOpen] = useState(entry.status.kind !== "Same");

  if (diffOnly && entry.status.kind === "Same") return null;

  const pad = { paddingLeft: depth * 16 + 8 };

  return (
    <div>
      <div
        className="row"
        style={pad}
        onClick={() => (isDir ? setOpen((o) => !o) : onOpen(entry))}
      >
        <span className="twisty">{isDir ? (open ? "▾" : "▸") : ""}</span>
        <span>{isDir ? "📁" : "📄"}</span>
        <span className="name">{entry.name}</span>
        <span className="badge" style={{ color: statusColor(entry.status) }}>
          {statusLabel(entry.status)}
        </span>
      </div>
      {isDir && open &&
        entry.children.map((c) => (
          <Node
            key={c.rel_path}
            entry={c}
            depth={depth + 1}
            onOpen={onOpen}
            diffOnly={diffOnly}
          />
        ))}
    </div>
  );
}
