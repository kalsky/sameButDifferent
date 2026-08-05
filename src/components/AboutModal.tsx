import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { checkForUpdate, REPO_URL, RELEASES_URL, type UpdateCheck } from "../update";

interface Props {
  onClose: () => void;
}

export function AboutModal({ onClose }: Props) {
  const [version, setVersion] = useState("");
  const [check, setCheck] = useState<UpdateCheck | "checking" | null>(null);

  // getVersion() reads tauri.conf.json, which now sources from package.json.
  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(""));
  }, []);

  async function check4Updates() {
    if (!version) return;
    setCheck("checking");
    setCheck(await checkForUpdate(version));
  }

  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal about" onClick={(e) => e.stopPropagation()}>
        <h3>Same But Different</h3>
        <p className="muted">
          A folder &amp; file diff/merge tool.
          <br />
          By Yaniv Kalsky
        </p>

        <p className="aboutver">{version ? `Version ${version}` : "Version unavailable"}</p>

        <div className="aboutcheck">
          <button onClick={check4Updates} disabled={!version || check === "checking"}>
            {check === "checking" ? "Checking…" : "Check for updates"}
          </button>
          {check && check !== "checking" && (
            <span className="muted">
              {check.state === "available" && `${check.version} is available`}
              {check.state === "current" && "You're up to date"}
              {check.state === "unknown" && "Couldn't check right now"}
            </span>
          )}
        </div>

        <div className="modalbtns">
          <button onClick={() => openUrl(REPO_URL)}>Repository</button>
          {check && check !== "checking" && check.state === "available" && (
            <button onClick={() => openUrl(RELEASES_URL)}>Download</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="compare" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
