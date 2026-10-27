'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addToast, apiFetch } from '@/lib/api';
import { goHome } from '@/lib/app-depth';
import { useModelCatalog } from '@/lib/use-model-catalog';
import { useRestart } from '@/lib/use-restart';
import { RestartingOverlay } from '@/app/app/RestartingOverlay';
import { UncommittedProject, UncommittedProjects } from './UncommittedProjects';

const REFRESH_ICON =
  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';

function Icon({ path, spinning }: { path: string; spinning?: boolean }) {
  return (
    <svg
      className={`w-5 h-5 shrink-0 text-foreground/60 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  );
}

function CardBody({
  icon,
  busy,
  title,
  description,
}: {
  icon: string;
  busy?: boolean;
  title: string;
  description: ReactNode;
}) {
  return (
    <>
      <Icon path={icon} spinning={busy} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-foreground/60">{description}</div>
      </div>
    </>
  );
}

const CARD_CLASS =
  'w-full text-left flex items-start gap-3 p-4 rounded-lg border border-foreground/10 bg-foreground/5 active:opacity-80 disabled:opacity-50';

function ActionCard({
  onClick,
  busy = false,
  ...body
}: {
  onClick: () => void;
  busy?: boolean;
  icon: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={busy} className={CARD_CLASS}>
      <CardBody busy={busy} {...body} />
    </button>
  );
}

export default function InternalsPage() {
  const router = useRouter();
  const { restarting, restart } = useRestart();
  const { reload: reloadModelCatalog } = useModelCatalog();
  const [scanning, setScanning] = useState(false);
  // Null until a scan has run, so an empty result can say so.
  const [uncommitted, setUncommitted] = useState<UncommittedProject[] | null>(
    null
  );
  const [refreshingChecks, setRefreshingChecks] = useState(false);
  const [reloadingModels, setReloadingModels] = useState(false);

  const scanUncommitted = async () => {
    setScanning(true);
    try {
      const res = await apiFetch('/api/uncommitted');
      if (!res.ok) return;
      const { projects }: { projects: UncommittedProject[] } = await res.json();
      setUncommitted(projects);
    } finally {
      setScanning(false);
    }
  };

  const refreshChecks = async () => {
    setRefreshingChecks(true);
    try {
      const res = await apiFetch('/api/checks/refresh', { method: 'POST' });
      if (res.ok) addToast('Checks refreshed', 'success');
    } finally {
      setRefreshingChecks(false);
    }
  };

  const reloadModels = async () => {
    setReloadingModels(true);
    try {
      await reloadModelCatalog();
      addToast('Models reloaded', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err));
    } finally {
      setReloadingModels(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {restarting && <RestartingOverlay />}
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goHome(router)}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Internals</h1>
            <div className="text-xs text-foreground/50 truncate">
              Keeping GitMob itself in shape
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3">
        <Link href="/app/notifications" className={CARD_CLASS}>
          <CardBody
            icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1h6z"
            title="Notifications"
            description="Subscribe this device to job results, send a test, and forget devices that are gone."
          />
        </Link>

        <ActionCard
          onClick={scanUncommitted}
          busy={scanning}
          icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          title="Scan for uncommitted changes"
          description={
            scanning
              ? 'Scanning every repository...'
              : 'The project list only asks git about projects open on the desktop. This asks every closed one, for work left in the tree.'
          }
        />
        {uncommitted !== null &&
          (uncommitted.length === 0 ? (
            <div className="text-sm text-foreground/50 px-1">
              No closed project has uncommitted changes
            </div>
          ) : (
            <UncommittedProjects projects={uncommitted} />
          ))}

        <ActionCard
          onClick={refreshChecks}
          busy={refreshingChecks}
          icon={REFRESH_ICON}
          title="Refresh sudo, sites and env checks"
          description="The project list answers these from memory and refreshes them in the background. This asks again right now."
        />

        <ActionCard
          onClick={reloadModels}
          busy={reloadingModels}
          icon={REFRESH_ICON}
          title="Reload models"
          description="This device keeps the providers, models and efforts a session can run. Fetch them anew after claudex's catalog changes."
        />

        <ActionCard
          onClick={restart}
          busy={restarting}
          icon="M12 3v9m6.36-5.36a9 9 0 11-12.73 0"
          title="Restart GitMob"
          description="Restarts the service, which rebuilds whatever HEAD has on the way up, then reloads this page."
        />
      </main>
    </div>
  );
}
