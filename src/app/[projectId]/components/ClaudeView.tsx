'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DesktopScreenView } from './DesktopScreenView';
import { DesktopSessions } from './DesktopSessions';
import { useAutoRefresh } from '../../../lib/use-auto-refresh';

export interface DesktopSession {
  windowId: string;
  title: string;
  workspace: string;
  projectId: string;
  focused: boolean;
  sessionId: string | null;
  cwd: string | null;
}

export function ClaudeView({
  projectId,
  projectPath,
}: {
  projectId: string;
  projectPath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const windowParam = searchParams.get('window');

  const [sessions, setSessions] = useState<DesktopSession[] | null>(null);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/desktop`);
    const data = await res.json();
    if (res.ok) {
      setSessions(data.sessions);
      setWorkspaces(data.workspaces);
      setError(null);
    } else {
      setError(data.error || 'Could not read the desktop');
    }
  }, [projectId]);

  useAutoRefresh(fetchSessions, windowParam ? undefined : 5000);

  const openScreen = (windowId: string) => {
    router.push(
      `/${projectId}?tab=claude&window=${encodeURIComponent(windowId)}`
    );
  };

  if (windowParam) {
    const session = sessions?.find((s) => s.windowId === windowParam);
    return (
      <DesktopScreenView
        projectId={projectId}
        windowId={windowParam}
        title={session?.title || `Window ${windowParam}`}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <DesktopSessions
      projectId={projectId}
      projectPath={projectPath}
      sessions={sessions}
      workspaces={workspaces}
      error={error}
      onRetry={fetchSessions}
      onOpenScreen={openScreen}
    />
  );
}
