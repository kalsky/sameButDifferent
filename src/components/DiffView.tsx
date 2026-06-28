import { useMemo } from "react";
import type { Hunk } from "../types";
import { hunksToRows } from "../format";

interface Props {
  hunks: Hunk[];
  rootA: string;
  rootB: string;
  // copy a hunk from one side to the other; parent re-diffs and updates `hunks`
  onCopy: (hunkId: number, dir: "AtoB" | "BtoA") => void;
}

const bg: Record<string, string> = {
  Equal: "transparent",
  Insert: "rgba(63,185,80,0.15)",
  Delete: "rgba(248,81,73,0.15)",
  Replace: "rgba(210,153,34,0.15)",
};

export function DiffView({ hunks, onCopy }: Props) {
  const rows = useMemo(() => hunksToRows(hunks), [hunks]);
  return (
    <div className="diff">
      {rows.map((r, i) => (
        <div className="diffrow" key={i} style={{ background: bg[r.tag] }}>
          <pre className="cell">{r.a ?? ""}</pre>
          <div className="chevrons">
            {r.tag !== "Equal" && (
              <>
                <button title="copy A → B" onClick={() => onCopy(r.hunkId, "AtoB")}>
                  ›
                </button>
                <button title="copy B → A" onClick={() => onCopy(r.hunkId, "BtoA")}>
                  ‹
                </button>
              </>
            )}
          </div>
          <pre className="cell">{r.b ?? ""}</pre>
        </div>
      ))}
    </div>
  );
}
