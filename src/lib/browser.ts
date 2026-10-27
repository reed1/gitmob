import { execFile } from 'child_process';
import type { BrowserKey } from './browser-keys';

/**
 * A project's agent Chrome, reached through the CLI that owns it — `rv chrome cdp`. Same
 * contract as every other CLI here: shell out, map the JSON, let its failures reach the user.
 *
 * Every project has its own, shared by the agents working on it, so everything past
 * `listChromes` names the project whose Chrome it drives.
 */

export interface AgentChrome {
  project_id: string;
  pid: number;
  /** Null for the moment between Chrome starting and writing its port out. */
  debug_port: number | null;
}

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
      'rv',
      ['chrome', 'cdp', ...args],
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
function forTab(project: string, tab: string | null): string[] {
  return ['--project-id', project, ...(tab ? ['--target', tab] : [])];
}

export async function listChromes(): Promise<AgentChrome[]> {
  return JSON.parse(await cdp(['list'])).chromes;
}

export async function listTabs(project: string): Promise<BrowserTab[]> {
  return JSON.parse(await cdp(['tabs', '--project-id', project])).tabs;
}

export async function captureTab(
  project: string,
  tab: string | null
): Promise<BrowserShot> {
  const shot = JSON.parse(await cdp(['shot', ...forTab(project, tab)]));
  return { ...shot, jpeg: Buffer.from(shot.jpeg, 'base64') };
}

export async function clickTab(
  project: string,
  tab: string | null,
  x: number,
  y: number,
  count: number
): Promise<void> {
  await cdp([
    'click',
    ...forTab(project, tab),
    '--x',
    String(x),
    '--y',
    String(y),
    '--count',
    String(count),
  ]);
}

export async function scrollTab(
  project: string,
  tab: string | null,
  x: number,
  y: number,
  dx: number,
  dy: number
): Promise<void> {
  await cdp([
    'scroll',
    ...forTab(project, tab),
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
  project: string,
  tab: string | null,
  text: string
): Promise<void> {
  await cdp(['text', ...forTab(project, tab), text]);
}

export async function pressTabKey(
  project: string,
  tab: string | null,
  key: BrowserKey
): Promise<void> {
  await cdp(['key', ...forTab(project, tab), key]);
}

export async function navigateTab(
  project: string,
  tab: string | null,
  url: string
): Promise<void> {
  await cdp(['navigate', ...forTab(project, tab), url]);
}

export async function stepTabHistory(
  project: string,
  tab: string | null,
  direction: 'back' | 'forward'
): Promise<void> {
  await cdp([direction, ...forTab(project, tab)]);
}

export async function reloadTab(
  project: string,
  tab: string | null
): Promise<void> {
  await cdp(['reload', ...forTab(project, tab)]);
}

export async function openTab(project: string, url: string): Promise<string> {
  return JSON.parse(await cdp(['open', '--project-id', project, url])).id;
}

export async function closeTab(project: string, tab: string): Promise<void> {
  await cdp(['close', ...forTab(project, tab)]);
}
