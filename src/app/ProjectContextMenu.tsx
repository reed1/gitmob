'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { launchDesktopSession } from '../lib/desktop-client';
import {
  CLAUDE_MODES,
  ClaudeMode,
  DEFAULT_CLAUDE_MODE,
} from '../lib/desktop-modes';
import { useOutsideClick } from '../lib/use-outside-click';
import { openExternal } from '../lib/open-external';

const DOOIT_DOMAIN = process.env.NEXT_PUBLIC_DOOIT_DOMAIN;

interface Props {
  project: {
    id: string;
    canonicalId: string;
    urls?: Record<string, string>;
    githubUrl: string | null;
  };
}

export default function ProjectContextMenu({ project }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customMode, setCustomMode] = useState<ClaudeMode>(DEFAULT_CLAUDE_MODE);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuOpen, menuRef, () => setMenuOpen(false));

  async function launchCustom() {
    setCustomModalOpen(false);
    await launchDesktopSession(project.id, customMode);
  }

  const urls = project.urls ?? {};
  const urlEntries = Object.entries(urls);
  const hasUrls = urlEntries.length > 0;

  return (
    <>
      <div className="relative" ref={menuRef}>
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
              onClick={() => {
                setMenuOpen(false);
                if (project.githubUrl) {
                  openExternal(project.githubUrl);
                }
              }}
              disabled={!project.githubUrl}
              className={`block w-full px-4 py-2 text-sm text-left ${
                project.githubUrl
                  ? 'hover:bg-foreground/10'
                  : 'text-foreground/30 cursor-not-allowed'
              }`}
            >
              {project.githubUrl ? 'Github' : 'Github (not available)'}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setCustomMode(DEFAULT_CLAUDE_MODE);
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
                  openExternal(
                    `${DOOIT_DOMAIN}/frontend/dooit/${project.canonicalId}`
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
        )}
      </div>

      {customModalOpen &&
        createPortal(
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
                      Permission mode
                    </div>
                    <select
                      value={customMode}
                      onChange={(e) =>
                        setCustomMode(e.target.value as ClaudeMode)
                      }
                      className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background"
                    >
                      {CLAUDE_MODES.map((entry) => (
                        <option key={entry.mode} value={entry.mode}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
          </>,
          document.body
        )}

      {urlModalOpen &&
        createPortal(
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
                        openExternal(url);
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
          </>,
          document.body
        )}
    </>
  );
}
