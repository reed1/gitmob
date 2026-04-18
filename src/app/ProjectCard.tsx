'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Project } from './types';
import { apiFetch } from '../lib/api';

const DOOIT_DOMAIN = process.env.NEXT_PUBLIC_DOOIT_DOMAIN;
function openExternal(url: string) {
  window.open(`https://href.li/?${url}`, '_blank');
}

function getDefaultTab(project: Project): string {
  if (project.downSites.length > 0) return 'process';
  if (project.editing) return 'changes';
  return 'dooit';
}

export default function ProjectCard({
  project,
  isActive,
}: {
  project: Project;
  isActive?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customInterface, setCustomInterface] = useState<'remote' | 'ttyd'>(
    'remote'
  );
  const [customBypassPermissions, setCustomBypassPermissions] = useState(true);

  async function launchCustom() {
    setCustomModalOpen(false);
    const body = JSON.stringify({
      bypassPermissions: customBypassPermissions,
    });
    const headers = { 'Content-Type': 'application/json' };
    if (customInterface === 'remote') {
      const res = await apiFetch(`/api/projects/${project.id}/claude-remote`, {
        method: 'POST',
        headers,
        body,
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } else if (customInterface === 'ttyd') {
      const res = await apiFetch(`/api/projects/${project.id}/claude-ttyd`, {
        method: 'POST',
        headers,
        body,
      });
      const data = await res.json();
      if (data.url) {
        const wrapperUrl = `/ttyd?url=${encodeURIComponent(data.url)}&session=${encodeURIComponent(data.tmuxSession)}`;
        openExternal(window.location.origin + wrapperUrl);
      }
    } else {
      throw new Error(`Unexpected interface: ${customInterface}`);
    }
  }

  const urls = project.urls ?? {};
  const urlEntries = Object.entries(urls);
  const hasUrls = urlEntries.length > 0;

  return (
    <div
      className={`p-4 rounded-lg border flex items-center gap-3 ${
        project.editing
          ? 'border-green-500/50 bg-green-500/10'
          : isActive
            ? 'border-foreground/30 bg-foreground/5'
            : 'border-foreground/10 bg-foreground/5'
      }`}
    >
      <div
        onClick={() =>
          router.push(`/${project.id}?tab=${getDefaultTab(project)}`)
        }
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{project.id}</span>
          {project.hasRunningProcess && (
            <svg
              className="w-3.5 h-3.5 text-green-500"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-label="Running process"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {project.hasPendingMessage && (
            <svg
              className="w-3.5 h-3.5 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Pending commit message"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
          )}
          {project.downSites.length > 0 && (
            <svg
              className="w-3.5 h-3.5 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Sites down"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path
                strokeWidth={2}
                d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"
              />
            </svg>
          )}
        </div>
        {project.tags && project.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-foreground/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg bg-foreground/10 active:bg-foreground/20 transition-colors"
        >
          <svg
            className="w-5 h-5 text-foreground/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01"
            />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[120px]">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (hasUrls) {
                    setUrlModalOpen(true);
                  }
                }}
                disabled={!hasUrls}
                className={`block w-full px-4 py-2 text-sm text-left ${
                  hasUrls
                    ? 'hover:bg-foreground/10'
                    : 'text-foreground/30 cursor-not-allowed'
                }`}
              >
                Open URL
              </button>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  if (project.hasRunningProcess) {
                    await apiFetch(`/api/projects/${project.id}/process`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'stopAll' }),
                    });
                    window.location.reload();
                  }
                }}
                disabled={!project.hasRunningProcess}
                className={`block w-full px-4 py-2 text-sm text-left ${
                  project.hasRunningProcess
                    ? 'hover:bg-foreground/10'
                    : 'text-foreground/30 cursor-not-allowed'
                }`}
              >
                Stop proc
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setCustomInterface('remote');
                  setCustomBypassPermissions(true);
                  setCustomModalOpen(true);
                }}
                className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10"
              >
                Claude
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (DOOIT_DOMAIN) {
                    window.open(
                      `${DOOIT_DOMAIN}/frontend/dooit/${project.id}`,
                      '_blank'
                    );
                  }
                }}
                disabled={!DOOIT_DOMAIN}
                className={`block w-full px-4 py-2 text-sm text-left ${
                  DOOIT_DOMAIN
                    ? 'hover:bg-foreground/10'
                    : 'text-foreground/30 cursor-not-allowed'
                }`}
              >
                Dooit
              </button>
            </div>
          </>
        )}
      </div>

      {customModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setCustomModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full">
              <div className="px-4 py-3 border-b border-foreground/10">
                <h3 className="font-medium">Launch Claude Code</h3>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <div className="text-xs text-foreground/60 mb-1.5">
                    Interface
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 text-sm border border-foreground/20 rounded-lg px-3 py-2 cursor-pointer has-[:checked]:bg-foreground/10 has-[:checked]:border-foreground/40">
                      <input
                        type="radio"
                        name={`custom-iface-${project.id}`}
                        value="remote"
                        checked={customInterface === 'remote'}
                        onChange={() => setCustomInterface('remote')}
                        className="w-4 h-4"
                      />
                      Remote
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 text-sm border border-foreground/20 rounded-lg px-3 py-2 cursor-pointer has-[:checked]:bg-foreground/10 has-[:checked]:border-foreground/40">
                      <input
                        type="radio"
                        name={`custom-iface-${project.id}`}
                        value="ttyd"
                        checked={customInterface === 'ttyd'}
                        onChange={() => setCustomInterface('ttyd')}
                        className="w-4 h-4"
                      />
                      TTYD
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customBypassPermissions}
                    onChange={(e) =>
                      setCustomBypassPermissions(e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span>Bypass permissions</span>
                </label>
              </div>
              <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
                <button
                  onClick={() => setCustomModalOpen(false)}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
                >
                  Cancel
                </button>
                <button
                  onClick={launchCustom}
                  className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90"
                >
                  Launch
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {urlModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setUrlModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full">
              <div className="px-4 py-3 border-b border-foreground/10">
                <h3 className="font-medium">Select URL</h3>
              </div>
              <div className="py-2">
                {urlEntries.map(([key, url]) => (
                  <button
                    key={key}
                    onClick={() => {
                      window.open(url, '_blank');
                      setUrlModalOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10"
                  >
                    <span>{key}</span>
                    <span className="text-foreground/40"> :: </span>
                    <span className="text-blue-500">{url}</span>
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-foreground/10 flex justify-end">
                <button
                  onClick={() => setUrlModalOpen(false)}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
