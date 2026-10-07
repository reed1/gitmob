'use client';

import { type ReactNode } from 'react';
import { ModalOverlay } from '../../components/ModalOverlay';

/**
 * The one dialog shell in the app. Portalled content still bubbles clicks up the React tree
 * into whatever is behind it — a project card that navigates, a session row that opens a
 * screen — so every click inside stops here.
 */
export function Modal({
  heading,
  subtitle,
  onClose,
  children,
  guardDismiss,
}: {
  heading: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  guardDismiss?: boolean;
}) {
  return (
    <ModalOverlay onClose={onClose} guardDismiss={guardDismiss}>
      <div
        className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-foreground/10">
          <h3 className="font-medium">{heading}</h3>
          {subtitle && (
            <div className="text-xs text-foreground/50 truncate">
              {subtitle}
            </div>
          )}
        </div>
        {children}
      </div>
    </ModalOverlay>
  );
}
