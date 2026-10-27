'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DesktopScreenView } from './DesktopScreenView';
import { DesktopSessions } from './DesktopSessions';
import { RecallSearch } from './RecallSearch';
import { RecallTranscript } from './RecallTranscript';
import { SessionTranscript } from './SessionTranscript';
import { usePoll } from '@/lib/use-load';
import { projectApiPath, projectPagePath } from '@/lib/project-paths';

/** What Claude Code itself reports the session's context window to be holding. */
export interface SessionContext {
  usedTokens: number;
  windowSize: number;
  usedPercentage: number;
}

export interface DesktopSession {
  windowId: string;
  /** A provider id from `claudex models`. */
  provider: string;
  title: string;
  workspace: string;
  projectId: string;
  focused: boolean;
  sessionId: string | null;
  cwd: string | null;
  context: SessionContext | null;
}

/** recall reads Claude transcripts alone; Codex records its turns its own way. */
export function transcriptSessionId(session: DesktopSession): string | null {
  return session.provider === 'claude' ? session.sessionId : null;
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
  const viewParam = searchParams.get('view');

  const [sessions, setSessions] = useState<DesktopSession[] | null>(null);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch(`${projectApiPath(projectId)}/desktop`);
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
  usePoll(fetchSessions, showingList ? 5000 : null);

  const sessionsUrl = `${projectPagePath(projectId)}?tab=claude`;

  const windowUrl = (windowId: string, view: 'terminal' | 'transcript') =>
    `${sessionsUrl}&window=${encodeURIComponent(windowId)}` +
    (view === 'transcript' ? '&view=transcript' : '');

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
    const title = session?.title || `Window ${windowParam}`;
    // Switching between the two views of a window replaces rather than pushes, so Back
    // leaves the window instead of walking every switch.
    if (viewParam === 'transcript') {
      return (
        <SessionTranscript
          projectId={projectId}
          canonicalId={canonicalId}
          windowId={windowParam}
          sessionId={session ? transcriptSessionId(session) : null}
          lookingUp={sessions === null}
          title={title}
          onBack={() => router.back()}
          onOpenTerminal={() =>
            router.replace(windowUrl(windowParam, 'terminal'))
          }
        />
      );
    }
    if (viewParam !== null) throw new Error(`Unexpected view: ${viewParam}`);
    return (
      <DesktopScreenView
        projectId={projectId}
        canonicalId={canonicalId}
        windowId={windowParam}
        title={title}
        onBack={() => router.back()}
        onOpenTranscript={
          session && transcriptSessionId(session)
            ? () => router.replace(windowUrl(windowParam, 'transcript'))
            : undefined
        }
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
      onOpenWindow={(windowId, view) => router.push(windowUrl(windowId, view))}
      onOpenSearch={() => router.push(`${sessionsUrl}&recall=1`)}
    />
  );
}
