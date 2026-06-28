import { useState } from "react";
import { DEFAULT_EXCLUDES, setExcludes } from "../storage";

interface Props {
  excludes: string[];
  onClose: () => void;
  onSave: (list: string[]) => void;
}

// Edit the exclude list (folder/file names skipped during folder compare).
export function SettingsModal({ excludes, onClose, onSave }: Props) {
  const [text, setText] = useState(excludes.join("\n"));

  function parse(t: string) {
    return t.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }

  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>Exclude from comparison</h3>
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
