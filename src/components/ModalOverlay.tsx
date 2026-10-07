'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const openOverlays: symbol[] = [];

/** Shared dismissal policy. Override guardDismiss for prefilled forms or non-text drafts. */
export function ModalOverlay({
  children,
  onClose,
  guardDismiss,
  className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50',
}: {
  children: ReactNode;
  onClose: () => void;
  guardDismiss?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const pressedBackdrop = useRef(false);
  const latest = useRef({ onClose, guardDismiss });
  useEffect(() => {
    latest.current = { onClose, guardDismiss };
  });

  const dismiss = () => {
    const element = root.current;
    if (!element) return;
    const guarded =
      latest.current.guardDismiss ??
      Array.from(
        element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'textarea, input'
        )
      ).some(
        (field) =>
          !field.readOnly &&
          !['checkbox', 'radio', 'hidden', 'button', 'submit'].includes(
            field.type
          ) &&
          Boolean(field.value)
      );
    if (!guarded) {
      latest.current.onClose();
      return;
    }
    const cancel = element.querySelector<HTMLButtonElement>(
      '[data-modal-cancel]'
    );
    if (cancel) {
      animation.current?.cancel();
      animation.current = cancel.animate(
        [
          { backgroundColor: 'transparent', outline: '2px solid transparent' },
          {
            backgroundColor: 'rgba(245, 158, 11, 0.3)',
            outline: '2px solid rgb(245, 158, 11)',
          },
          { backgroundColor: 'transparent', outline: '2px solid transparent' },
        ],
        { duration: 350, iterations: 2 }
      );
    }
  };
  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  useEffect(() => {
    const id = Symbol('modal');
    openOverlays.push(id);
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || openOverlays.at(-1) !== id) return;
      if (root.current?.querySelector('[data-open-menu]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissRef.current();
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      openOverlays.splice(openOverlays.indexOf(id), 1);
      document.removeEventListener('keydown', keydown, true);
      animation.current?.cancel();
    };
  }, []);

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      className={className}
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && pressedBackdrop.current)
          dismiss();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
