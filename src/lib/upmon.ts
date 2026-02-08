import { execSync } from 'child_process';

let cachedPort: string | null = null;
let cachedApiKey: string | null = null;

function getPort(): string {
  if (!cachedPort) {
    cachedPort = execSync('rpass port get sgtent/upmon', {
      encoding: 'utf-8',
    }).trim();
  }
  return cachedPort;
}

function getApiKey(): string {
  if (!cachedApiKey) {
    cachedApiKey = execSync('rpass get sgtent/upmon/api-key', {
      encoding: 'utf-8',
    }).trim();
  }
  return cachedApiKey;
}

interface MonitorStatus {
  project_id: string;
  site_key: string;
  is_up: boolean;
}

export async function getDownSites(): Promise<Record<string, string[]>> {
  try {
    const port = getPort();
    const apiKey = getApiKey();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`http://sgtent:${port}/status`, {
      headers: { 'X-Api-Key': apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return {};

    const monitors: MonitorStatus[] = await res.json();
    const downMap: Record<string, string[]> = {};

    for (const m of monitors) {
      if (!m.is_up) {
        if (!downMap[m.project_id]) {
          downMap[m.project_id] = [];
        }
        downMap[m.project_id].push(m.site_key);
      }
    }

    return downMap;
  } catch {
    return {};
  }
}
