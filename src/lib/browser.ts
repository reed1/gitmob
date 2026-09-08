import { execFile } from 'child_process';
import type { BrowserKey } from './browser-keys';

/**
 * The Chrome the Claude extension drives, reached through the CLI that owns it —
 * `claude-in-chrome cdp`, in rlocal/bin. Same contract as every other CLI here: shell out,
 * map the JSON, let its failures reach the user.
 *
 * It is one browser for the whole desktop, not one per project, so nothing on this path takes
 * a project id.
 */

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

export interface BrowserShot {
  id: string;
  title: string;
  url: string;
  /** CSS pixels, which the JPEG is sized in too — so a tap on it needs no rescaling. */
  width: number;
  height: number;
  jpeg: Buffer;
}

/** A page can sit on a login form for a while, but no call here is slow on purpose. */
const TIMEOUT_MS = 20000;

function cdp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claude-in-chrome',
      ['cdp', ...args],
      { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

/** Every command but `tabs` and `open` acts on one tab, and defaults to the frontmost. */
function forTab(tab: string | null): string[] {
  return tab ? ['--target', tab] : [];
}

export async function listTabs(): Promise<BrowserTab[]> {
  return JSON.parse(await cdp(['tabs'])).tabs;
}

export async function captureTab(tab: string | null): Promise<BrowserShot> {
  const shot = JSON.parse(await cdp(['shot', ...forTab(tab)]));
  return { ...shot, jpeg: Buffer.from(shot.jpeg, 'base64') };
}

export async function clickTab(
  tab: string | null,
  x: number,
  y: number,
  count: number
): Promise<void> {
  await cdp([
    'click',
    ...forTab(tab),
    '--x',
    String(x),
    '--y',
    String(y),
    '--count',
    String(count),
  ]);
}

export async function scrollTab(
  tab: string | null,
  x: number,
  y: number,
  dx: number,
  dy: number
): Promise<void> {
  await cdp([
    'scroll',
    ...forTab(tab),
    '--x',
    String(x),
    '--y',
    String(y),
    '--dx',
    String(dx),
    '--dy',
    String(dy),
  ]);
}

export async function typeIntoTab(
  tab: string | null,
  text: string
): Promise<void> {
  await cdp(['text', ...forTab(tab), text]);
}

export async function pressTabKey(
  tab: string | null,
  key: BrowserKey
): Promise<void> {
  await cdp(['key', ...forTab(tab), key]);
}

export async function navigateTab(
  tab: string | null,
  url: string
): Promise<void> {
  await cdp(['navigate', ...forTab(tab), url]);
}

export async function stepTabHistory(
  tab: string | null,
  direction: 'back' | 'forward'
): Promise<void> {
  await cdp([direction, ...forTab(tab)]);
}

export async function reloadTab(tab: string | null): Promise<void> {
  await cdp(['reload', ...forTab(tab)]);
}

export async function openTab(url: string): Promise<string> {
  return JSON.parse(await cdp(['open', url])).id;
}

export async function closeTab(tab: string): Promise<void> {
  await cdp(['close', '--target', tab]);
}
