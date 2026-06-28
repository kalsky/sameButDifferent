import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  relPath: string;
  rootA: string;
  rootB: string;
}

// ponytail: native asset protocol; no base64 round-trip through Rust.
export function ImageView({ relPath, rootA, rootB }: Props) {
  const src = (root: string) => convertFileSrc(`${root}/${relPath}`);
  return (
    <div className="diff images">
      <img src={src(rootA)} alt="side A" />
      <img src={src(rootB)} alt="side B" />
    </div>
  );
}
