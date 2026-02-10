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

  if (!res.ok) return [];

  return res.json();
}

export async function getProjectMonitorStatus(
  projectId: string
): Promise<MonitorStatus[]> {
  return fetchMonitors(`project_id=${encodeURIComponent(projectId)}`);
}

export async function getDownSites(): Promise<Record<string, string[]>> {
  try {
    const monitors = await fetchMonitors();
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
