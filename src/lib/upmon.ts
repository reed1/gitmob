import { backgroundCache } from './background-cache';

export interface MonitorStatus {
  project_id: string;
  site_key: string;
  is_up: boolean;
}

async function fetchMonitors(query?: string): Promise<MonitorStatus[]> {
  const baseUrl = process.env.UPMON_URL;
  const apiKey = process.env.UPMON_APIKEY;
  if (!baseUrl || !apiKey) return [];

  const url = query
    ? `${baseUrl}/api/v1/status?${query}`
    : `${baseUrl}/api/v1/status`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const res = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`upmon answered ${res.status}`);

  return res.json();
}

export async function getProjectMonitorStatus(
  projectId: string
): Promise<MonitorStatus[]> {
  return fetchMonitors(`project_id=${encodeURIComponent(projectId)}`).catch(
    () => []
  );
}

const downSites = backgroundCache(
  'upmon.downSites',
  5 * 60 * 1000,
  async () => {
    const downMap: Record<string, string[]> = {};
    for (const m of await fetchMonitors()) {
      if (!m.is_up) {
        if (!downMap[m.project_id]) {
          downMap[m.project_id] = [];
        }
        downMap[m.project_id].push(m.site_key);
      }
    }
    return downMap;
  }
);

/** Monitored sites that are down, by project — from memory, refreshed every five minutes. */
export function getDownSites(): Promise<Record<string, string[]>> {
  return downSites.get().catch(() => ({}));
}

export function refreshDownSites(): Promise<Record<string, string[]>> {
  return downSites.refresh();
}
