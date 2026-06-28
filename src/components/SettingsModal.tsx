import { useEffect, useRef, useState } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { DEFAULT_EXCLUDES, setExcludes, type MergeOpts } from "../storage";
import { THEME_NAMES, themeExt } from "../themes";

interface Props {
  excludes: string[];
  theme: string;
  mergeOpts: MergeOpts;
  onClose: () => void;
  onSave: (list: string[]) => void;
  onThemeChange: (name: string) => void;
  onMergeOptsChange: (o: MergeOpts) => void;
}

const SAMPLE = `// theme preview
function greet(name) {
  const msg = \`Hello, \${name}!\`;
  return msg.length > 0 ? msg : "anonymous";
}
const nums = [1, 2, 3].map((n) => n * 2);`;

// A small read-only editor that re-renders with the selected theme.
function ThemePreview({ theme }: { theme: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  useEffect(() => {
    view.current?.destroy();
    if (!ref.current) return;
    view.current = new EditorView({
      doc: SAMPLE,
      extensions: [basicSetup, javascript(), themeExt(theme), EditorView.editable.of(false)],
      parent: ref.current,
    });
    return () => view.current?.destroy();
  }, [theme]);
  return <div className="themepreview" ref={ref} />;
}

export function SettingsModal({
  excludes,
  theme,
  mergeOpts,
  onClose,
  onSave,
  onThemeChange,
  onMergeOptsChange,
}: Props) {
  const [text, setText] = useState(excludes.join("\n"));

  function parse(t: string) {
    return t.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }

  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>Editor theme</h3>
        <div className="themepick">
          <select value={theme} onChange={(e) => onThemeChange(e.target.value)}>
            {THEME_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <ThemePreview theme={theme} />

        <h3 style={{ marginTop: 20 }}>Diff view</h3>
        <label className="setrow">
          <input
            type="checkbox"
            checked={mergeOpts.highlightChanges}
            onChange={(e) => onMergeOptsChange({ ...mergeOpts, highlightChanges: e.target.checked })}
          />
          Highlight changed characters within a line
        </label>
        <label className="setrow">
          <input
            type="checkbox"
            checked={mergeOpts.showCopy}
            onChange={(e) => onMergeOptsChange({ ...mergeOpts, showCopy: e.target.checked })}
          />
          Show per-change copy buttons (← / →) in the gutter
        </label>

        <h3 style={{ marginTop: 20 }}>Exclude from comparison</h3>
        <p className="muted">
          One name per line. Any folder or file with these names is skipped (and its
          contents). .gitignore rules are also respected.
        </p>
        <textarea
          className="excludes"
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="modalbtns">
          <button onClick={() => setText(DEFAULT_EXCLUDES.join("\n"))}>Reset defaults</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>Cancel</button>
          <button
            className="compare"
            onClick={() => {
              const list = parse(text);
              setExcludes(list);
              onSave(list);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
