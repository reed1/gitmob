'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DesktopScreenView } from './DesktopScreenView';
import { DesktopSessions } from './DesktopSessions';
import { RecallSearch } from './RecallSearch';
import { RecallTranscript } from './RecallTranscript';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';

/** What Claude Code itself reports the session's context window to be holding. */
export interface SessionContext {
  usedTokens: number;
  windowSize: number;
  usedPercentage: number;
}

export interface DesktopSession {
  windowId: string;
  title: string;
  workspace: string;
  projectId: string;
  focused: boolean;
  sessionId: string | null;
  cwd: string | null;
  context: SessionContext | null;
}

export function ClaudeView({
  projectId,
  canonicalId,
}: {
  projectId: string;
  canonicalId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const windowParam = searchParams.get('window');
  const searchParam = searchParams.get('recall');
  const sessionParam = searchParams.get('session');

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

  // The list polls, but only while it is the thing on screen: a five-second refresh under a
  // search box is a keystroke lost every five seconds.
  const showingList = !windowParam && !searchParam && !sessionParam;
  useAutoRefresh(fetchSessions, showingList ? 5000 : undefined);

  const sessionsUrl = `/app/p/${projectId}?tab=claude`;

  const openScreen = (windowId: string) => {
    router.push(`${sessionsUrl}&window=${encodeURIComponent(windowId)}`);
  };

  if (sessionParam) {
    return (
      <RecallTranscript
        projectId={projectId}
        sessionId={sessionParam}
        onBack={() => router.back()}
        onResumed={() => router.replace(sessionsUrl)}
        // The conversation is already open, so the window holding it replaces the transcript
        // rather than stacking on top of it.
        onOpenWindow={(windowId) =>
          router.replace(
            `${sessionsUrl}&window=${encodeURIComponent(windowId)}`
          )
        }
      />
    );
  }

  if (searchParam) {
    return (
      <RecallSearch
        projectId={projectId}
        onBack={() => router.back()}
        onOpenSession={(sessionId) =>
          router.push(`${sessionsUrl}&session=${encodeURIComponent(sessionId)}`)
        }
      />
    );
  }

  if (windowParam) {
    const session = sessions?.find((s) => s.windowId === windowParam);
    return (
      <DesktopScreenView
        projectId={projectId}
        canonicalId={canonicalId}
        windowId={windowParam}
        title={session?.title || `Window ${windowParam}`}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <DesktopSessions
      projectId={projectId}
      canonicalId={canonicalId}
      sessions={sessions}
      workspaces={workspaces}
      error={error}
      onRetry={fetchSessions}
      onOpenScreen={openScreen}
      onOpenSearch={() => router.push(`${sessionsUrl}&recall=1`)}
    />
  );
}
