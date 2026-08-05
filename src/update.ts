// Update check: compare the running version against the latest GitHub release tag.
// Every failure path here is non-fatal by design — this is an informational line in an
// About box, so a rate limit, an offline machine, or a repo with no releases yet must
// read as "couldn't check", never as an error the user has to deal with.

export const REPO_URL = "https://github.com/kalsky/sameButDifferent";
export const RELEASES_URL = `${REPO_URL}/releases`;

const LATEST_API = "https://api.github.com/repos/kalsky/sameButDifferent/releases/latest";

/** Parse "v1.2.3", "1.2.3", or "1.2.3-beta.1" into comparable numbers. null if unparseable. */
export function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * True when `latest` is strictly newer than `current`. Unparseable input on either side
 * returns false: without a trustworthy comparison, claiming an update exists is worse
 * than staying quiet. A prerelease suffix is ignored, so 1.2.3-beta ties with 1.2.3.
 */
export function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  if (!l || !c) return false;
  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}

export type UpdateCheck =
  | { state: "current" }
  | { state: "available"; version: string }
  | { state: "unknown" }; // offline, rate-limited, no releases yet — all the same to the user

/** Fetch the latest release tag. Never throws; any problem collapses to "unknown". */
export async function checkForUpdate(current: string): Promise<UpdateCheck> {
  try {
    // ponytail: 8s cap so a hanging network doesn't leave a spinner up forever.
    const res = await fetch(LATEST_API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    });
    // 404 = no releases published yet, 403 = rate limited. Neither is an error here.
    if (!res.ok) return { state: "unknown" };

    const tag = (await res.json())?.tag_name;
    if (typeof tag !== "string" || !parseVersion(tag)) return { state: "unknown" };

    return isNewer(tag, current) ? { state: "available", version: tag } : { state: "current" };
  } catch {
    return { state: "unknown" };
  }
}
