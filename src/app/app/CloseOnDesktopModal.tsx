'use client';

import { addToast, apiFetch } from '../../lib/api';
import { Modal } from './Modal';

/** Opens or closes a project on the desktop, toasting when it went through. */
export async function actOnDesktop(
  projectId: string,
  action: 'open' | 'close'
): Promise<boolean> {
  const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (res.ok) {
    addToast(
      `${action === 'open' ? 'Opened' : 'Closed'} ${projectId} on the desktop`,
      'success'
    );
  }
  return res.ok;
}

export function CloseOnDesktopModal({
  projectId,
  onCancel,
  onConfirm,
}: {
  projectId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      heading="Close on the desktop?"
      subtitle={projectId}
      onClose={onCancel}
    >
      <p className="px-4 py-3 text-sm text-foreground/70">
        Closes its terminals, IDE and windows, stops its runs, and sends its
        Claude sessions to purgatory.
      </p>
      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
        <button
          data-modal-cancel
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-sm rounded-lg bg-red-500/15 text-red-500 active:bg-red-500/25"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
