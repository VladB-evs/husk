import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';

/*
 * Updates from GitHub releases. The app is signed ad hoc (no Apple Developer ID), and the standard Mac updater
 * (Squirrel.Mac, used by electron-updater) refuses such an app. So this does what install.sh does:
 *   1. ask GitHub for the latest release and compare its version with the running one,
 *   2. download HUSK-<arch>.zip and check it against the SHA256SUMS file of the same release,
 *   3. unpack it next to the installed app and check its signature,
 *   4. quit, swap HUSK.app for the new one, and open it again (a small script does this after the app has quit).
 * Steps 1 to 3 happen while the app keeps running, so a failure never breaks the installed app.
 * Nothing in this file imports electron: main.ts passes in the paths, which keeps it testable.
 */

export const REPO = 'VladB-evs/husk';
const DOWNLOAD_PREFIX = `https://github.com/${REPO}/releases/download/`;
const run = promisify(execFile);

export interface UpdateInfo {
  version: string;
  notes: string;
  zipUrl: string;
  sumsUrl: string;
}

export function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The update in a GitHub "latest release" answer, or null when the running version is the newest. */
export function findUpdate(release: any, current: string, arch: string): UpdateInfo | null {
  if (!release || release.draft || release.prerelease || !isNewer(String(release.tag_name), current)) return null;
  const assets: any[] = Array.isArray(release.assets) ? release.assets : [];
  const url = (name: string) => {
    const link = assets.find((a) => a?.name === name)?.browser_download_url;
    // Only files of this project's own releases are downloaded
    return typeof link === 'string' && link.startsWith(DOWNLOAD_PREFIX) ? link : null;
  };
  const zipUrl = url(`HUSK-${arch}.zip`);
  const sumsUrl = url('SHA256SUMS');
  if (!zipUrl || !sumsUrl) return null;
  return {
    version: String(release.tag_name).replace(/^v/, ''),
    notes: typeof release.body === 'string' ? release.body : '',
    zipUrl,
    sumsUrl,
  };
}

export async function checkForUpdate(current: string, arch: string): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'HUSK-updater' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return findUpdate(await res.json(), current, arch);
}

/** The checksum of `file` in the text that `shasum -a 256` writes ("<hash>  <file>" on each line). */
export function expectedHash(sums: string, file: string): string | null {
  for (const line of sums.split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line);
    if (m && m[2] === file) return m[1].toLowerCase();
  }
  return null;
}

/** Download the zip into `dir` and check its checksum. Returns the path of the zip. */
export async function downloadUpdate(
  info: UpdateInfo,
  dir: string,
  onProgress: (fraction: number) => void
): Promise<string> {
  const fileName = path.basename(new URL(info.zipUrl).pathname);
  const sumsRes = await fetch(info.sumsUrl);
  if (!sumsRes.ok) throw new Error(`Checksum file not found (${sumsRes.status})`);
  const want = expectedHash(await sumsRes.text(), fileName);
  if (!want) throw new Error('The release has no checksum for this download');

  const res = await fetch(info.zipUrl);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const hash = crypto.createHash('sha256');
  let received = 0;
  const tap = new Transform({
    transform(chunk, _enc, done) {
      hash.update(chunk);
      received += chunk.length;
      if (total) onProgress(Math.min(1, received / total));
      done(null, chunk);
    },
  });

  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, fileName);
  await pipeline(Readable.fromWeb(res.body as any), tap, fs.createWriteStream(zipPath));
  if (hash.digest('hex') !== want) {
    fs.rmSync(zipPath, { force: true });
    throw new Error('The download is damaged (checksum does not match)');
  }
  return zipPath;
}

/**
 * Unpack the new app next to the installed one (same folder, so the swap is one rename) and check its signature.
 * Returns the paths the swap script needs.
 */
export async function stageUpdate(zipPath: string, appPath: string): Promise<{ stage: string; newApp: string }> {
  const parent = path.dirname(appPath);
  try {
    fs.accessSync(parent, fs.constants.W_OK);
  } catch {
    throw new Error(`HUSK cannot replace itself in ${parent}. Run the install line from the README once.`);
  }
  const stage = path.join(parent, '.HUSK-update');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage);
  try {
    await run('ditto', ['-x', '-k', zipPath, stage]);
    const newApp = path.join(stage, 'HUSK.app');
    if (!fs.existsSync(newApp)) throw new Error('The download does not contain HUSK.app');
    await run('xattr', ['-cr', newApp]).catch(() => {}); // the same step as install.sh
    await run('codesign', ['--verify', '--deep', '--strict', newApp]);
    return { stage, newApp };
  } catch (err) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw err;
  }
}

// Runs after HUSK has quit: wait for the process to end, swap the app, open it. If the swap fails, the old app returns.
const SWAP_SCRIPT = `#!/bin/bash
PID="$1"; APP="$2"; NEW="$3"; STAGE="$4"
for _ in $(seq 1 100); do kill -0 "$PID" 2>/dev/null || break; sleep 0.3; done
OLD="$STAGE/previous.app"
if mv "$APP" "$OLD"; then
  if mv "$NEW" "$APP"; then rm -rf "$STAGE"; else mv "$OLD" "$APP" && rm -rf "$STAGE"; fi
else
  rm -rf "$STAGE"
fi
open "$APP"
rm -rf "$(dirname "$0")"
`;

/** Start the swap script. The caller must quit the app right after this. */
export function launchSwap(pid: number, appPath: string, newApp: string, stage: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'husk-update-'));
  const script = path.join(dir, 'swap.sh');
  fs.writeFileSync(script, SWAP_SCRIPT, { mode: 0o700 });
  spawn('/bin/bash', [script, String(pid), appPath, newApp, stage], { detached: true, stdio: 'ignore' }).unref();
}
