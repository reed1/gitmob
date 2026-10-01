'use client';

import { useState } from 'react';
import { addToast, apiFetch } from '../../lib/api';
import { CloneModal } from './CloneModal';
import { KebabMenu, KebabMenuItem } from './KebabMenu';
import { Modal } from './Modal';
import { NewSessionModal } from './NewSessionModal';

const DOOIT_DOMAIN = process.env.NEXT_PUBLIC_DOOIT_DOMAIN;

interface Props {
  project: {
    id: string;
    canonicalId: string;
    path: string;
    repo?: string;
    missing: boolean;
    openOnDesktop: boolean;
    urls?: Record<string, string>;
    githubUrl: string | null;
  };
  /** The project's state moved on — cloned, or opened or closed on the desktop. */
  onChanged: () => void;
}

export default function ProjectKebabMenu({ project, onChanged }: Props) {
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const urls = project.urls ?? {};
  const urlEntries = Object.entries(urls);
  const hasUrls = urlEntries.length > 0;

  const actOnDesktop = async (action: 'open' | 'close') => {
    const res = await apiFetch(`/api/projects/${project.id}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return;

    addToast(
      `${action === 'open' ? 'Opened' : 'Closed'} ${project.id} on the desktop`,
      'success'
    );
    onChanged();
  };

  return (
    <>
      <KebabMenu label={`Actions for ${project.id}`}>
        {/* Only ever the way in to a project that has no checkout: everything else on this
            menu, and every tab behind the card, needs one. */}
        {project.missing && project.repo && (
          <KebabMenuItem onSelect={() => setCloneOpen(true)}>
            Clone
          </KebabMenuItem>
        )}
        {project.openOnDesktop ? (
          <KebabMenuItem onSelect={() => setCloseConfirmOpen(true)}>
            Close
          </KebabMenuItem>
        ) : (
          !project.missing && (
            <KebabMenuItem onSelect={() => actOnDesktop('open')}>
              Open
            </KebabMenuItem>
          )
        )}
        <KebabMenuItem
          onSelect={() => setUrlModalOpen(true)}
          disabled={!hasUrls}
        >
          Open URL
        </KebabMenuItem>
        <KebabMenuItem
          onSelect={() => {
            if (project.githubUrl) window.open(project.githubUrl, '_blank');
          }}
          disabled={!project.githubUrl}
        >
          {project.githubUrl ? 'Github' : 'Github (not available)'}
        </KebabMenuItem>
        <KebabMenuItem onSelect={() => setNewSessionOpen(true)}>
          Claude
        </KebabMenuItem>
        <KebabMenuItem
          onSelect={() =>
            window.open(
              `${DOOIT_DOMAIN}/frontend/dooit/${project.canonicalId}`,
              '_blank'
            )
          }
          disabled={!DOOIT_DOMAIN}
        >
          Dooit
        </KebabMenuItem>
      </KebabMenu>

      {cloneOpen && project.repo && (
        <CloneModal
          projectId={project.id}
          repo={project.repo}
          path={project.path}
          onCloned={onChanged}
          onClose={() => setCloneOpen(false)}
        />
      )}

      {newSessionOpen && (
        <NewSessionModal
          projectId={project.id}
          canonicalId={project.canonicalId}
          onClose={() => setNewSessionOpen(false)}
        />
      )}

      {closeConfirmOpen && (
        <Modal
          heading="Close on the desktop?"
          subtitle={project.id}
          onClose={() => setCloseConfirmOpen(false)}
        >
          <p className="px-4 py-3 text-sm text-foreground/70">
            Closes its terminals, IDE and windows, stops its runs, and sends its
            Claude sessions to purgatory.
          </p>
          <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
            <button
              onClick={() => setCloseConfirmOpen(false)}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setCloseConfirmOpen(false);
                actOnDesktop('close');
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-500/15 text-red-500 active:bg-red-500/25"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {urlModalOpen && (
        <Modal heading="Select URL" onClose={() => setUrlModalOpen(false)}>
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
        </Modal>
      )}
    </>
  );
}
