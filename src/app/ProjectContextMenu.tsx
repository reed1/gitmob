'use client';

import { useState } from 'react';
import { apiFetch } from '../lib/api';

const DOOIT_DOMAIN = process.env.NEXT_PUBLIC_DOOIT_DOMAIN;

function openExternal(url: string) {
  window.open(`https://href.li/?${url}`, '_blank');
}

interface Props {
  project: { id: string; urls?: Record<string, string> };
  hasRunningProcess?: boolean;
}

export default function ProjectContextMenu({
  project,
  hasRunningProcess,
}: Props) {
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
  const stopProcEnabled = hasRunningProcess !== false;

  return (
    <>
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
                  if (stopProcEnabled) {
                    await apiFetch(`/api/projects/${project.id}/process`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'stopAll' }),
                    });
                    window.location.reload();
                  }
                }}
                disabled={!stopProcEnabled}
                className={`block w-full px-4 py-2 text-sm text-left ${
                  stopProcEnabled
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
    </>
  );
}
