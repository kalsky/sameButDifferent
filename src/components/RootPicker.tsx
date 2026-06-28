import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  roots: string[];
  setRoots: (r: string[]) => void;
  onCompare: () => void;
}

// Array-driven so a 3rd root is a one-line change later.
export function RootPicker({ roots, setRoots, onCompare }: Props) {
  async function pick(i: number) {
    const dir = await open({ directory: true });
    if (typeof dir === "string") {
      const next = [...roots];
      next[i] = dir;
      setRoots(next);
    }
  }

  return (
    <div className="picker">
      {roots.map((r, i) => (
        <button key={i} className="pickbtn" onClick={() => pick(i)}>
          {r || `Pick folder ${String.fromCharCode(65 + i)}…`}
        </button>
      ))}
      <button className="compare" disabled={roots.some((r) => !r)} onClick={onCompare}>
        Compare
      </button>
    </div>
  );
}
