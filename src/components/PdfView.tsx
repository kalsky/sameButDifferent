import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  pathA: string;
  pathB: string;
}

// ponytail: the webview already renders PDFs; two iframes beat bundling pdf.js.
// Visual side-by-side only — no content diff. That needs a text-extraction pass.
export function PdfView({ pathA, pathB }: Props) {
  return (
    <div className="diff pdfs">
      <iframe src={convertFileSrc(pathA)} title="side A" />
      <iframe src={convertFileSrc(pathB)} title="side B" />
    </div>
  );
}
