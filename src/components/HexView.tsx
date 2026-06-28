import { useEffect, useState } from "react";
import type { HexPage } from "../types";
import { readHex } from "../api";

interface Props {
  pathA: string;
  pathB: string;
}

const PAGE = 16 * 64; // 64 rows

export function HexView({ pathA, pathB }: Props) {
  const [a, setA] = useState<HexPage | null>(null);
  const [b, setB] = useState<HexPage | null>(null);

  useEffect(() => {
    readHex(pathA, 0, PAGE).then(setA).catch(() => setA(null));
    readHex(pathB, 0, PAGE).then(setB).catch(() => setB(null));
  }, [pathA, pathB]);

  return (
    <div className="diff">
      <pre className="cell hex">{a ? a.rows.map(fmt).join("\n") : "(missing)"}</pre>
      <pre className="cell hex">{b ? b.rows.map(fmt).join("\n") : "(missing)"}</pre>
    </div>
  );
}

function fmt(r: { offset: number; hex: string; ascii: string }) {
  return `${r.offset.toString(16).padStart(8, "0")}  ${r.hex.padEnd(47)}  ${r.ascii}`;
}
