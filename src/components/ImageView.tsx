import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  pathA: string;
  pathB: string;
}

// ponytail: native asset protocol; no base64 round-trip through Rust.
export function ImageView({ pathA, pathB }: Props) {
  return (
    <div className="diff images">
      <img src={convertFileSrc(pathA)} alt="side A" />
      <img src={convertFileSrc(pathB)} alt="side B" />
    </div>
  );
}
