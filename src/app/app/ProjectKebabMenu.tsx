'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloneModal } from './CloneModal';
import { ReleaseHoldModal } from './GgHold';
import { actOnDesktop, CloseOnDesktopModal } from './CloseOnDesktopModal';
import { KebabMenu, KebabMenuItem } from './KebabMenu';
import { Modal } from './Modal';
import { NewSessionModal } from './NewSessionModal';
import { useScratchpadEnabled } from './Scratchpad';
import { ProjectWorktreeModal } from './WorktreeActions';

const DOOIT_DOMAIN = process.env.NEXT_PUBLIC_DOOIT_DOMAIN;

interface Props {
  project: {
    id: string;
    canonicalId: string;
    worktreeName?: string;
    path: string;
    repo?: string;
    missing: boolean;
    openOnDesktop: boolean;
    hold: string[] | null;
    urls?: Record<string, string>;
  };
  /** The tree is dirty: there is something to review. */
  hasChanges: boolean;
  /** The project's state moved on — cloned, opened on the desktop, or synced. */
  onChanged: () => void;
  /** Closed on the desktop, or merged or removed; a worktree has no project left to show after that. */
  onClosed: () => void;
}

export default function ProjectKebabMenu({
  project,
  hasChanges,
  onChanged,
  onClosed,
}: Props) {
  const router = useRouter();
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [wtmanOpen, setWtmanOpen] = useState(false);
  const [releaseHoldOpen, setReleaseHoldOpen] = useState(false);
  const [scratchpadEnabled, toggleScratchpad] = useScratchpadEnabled();

  const urls = project.urls ?? {};
  const urlEntries = Object.entries(urls);
  const hasUrls = urlEntries.length > 0;

  return (
    <>
      <KebabMenu label={`Actions for ${project.id}`}>
        <KebabMenuItem onSelect={toggleScratchpad}>
          <span className="flex justify-between gap-4">
            Scratchpad
            <span className="text-foreground/50">
              {scratchpadEnabled ? 'On' : 'Off'}
            </span>
          </span>
        </KebabMenuItem>
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
            <KebabMenuItem
              onSelect={async () => {
                if (await actOnDesktop(project.id, 'open')) onChanged();
              }}
            >
              Open
            </KebabMenuItem>
          )
        )}
        {hasChanges && (
          <KebabMenuItem
            onSelect={() => router.push(`/app/p/${project.id}/review`)}
          >
            Review
          </KebabMenuItem>
        )}
        {project.hold && (
          <KebabMenuItem onSelect={() => setReleaseHoldOpen(true)}>
            Release hold
          </KebabMenuItem>
        )}
        <KebabMenuItem
          onSelect={() => setUrlModalOpen(true)}
          disabled={!hasUrls}
        >
          Open URL
        </KebabMenuItem>
        {project.worktreeName && (
          <KebabMenuItem onSelect={() => setWtmanOpen(true)}>
            Wtman
          </KebabMenuItem>
        )}
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

      {wtmanOpen && (
        <ProjectWorktreeModal
          repoId={project.canonicalId}
          projectId={project.id}
          onClose={() => setWtmanOpen(false)}
          onChanged={onChanged}
          onGone={onClosed}
        />
      )}

      {releaseHoldOpen && project.hold && (
        <ReleaseHoldModal
          projectId={project.id}
          hold={project.hold}
          onCancel={() => setReleaseHoldOpen(false)}
          onReleased={() => {
            setReleaseHoldOpen(false);
            onChanged();
          }}
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
        <CloseOnDesktopModal
          projectId={project.id}
          onCancel={() => setCloseConfirmOpen(false)}
          onConfirm={async () => {
            setCloseConfirmOpen(false);
            if (await actOnDesktop(project.id, 'close')) onClosed();
          }}
        />
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
              data-modal-cancel
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
