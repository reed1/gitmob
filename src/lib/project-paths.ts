export function projectPagePath(projectId: string): string {
  return `/app/p/${encodeURIComponent(projectId)}`;
}

export function projectApiPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}`;
}
