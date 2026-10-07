'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useOutsideClick } from '../../lib/use-outside-click';

const CloseKebabMenu = createContext<() => void>(() => {
  throw new Error('KebabMenuItem rendered outside a KebabMenu');
});

/**
 * The ⋮ button and the dropdown of actions behind it. Its clicks stay its own, since it often
 * sits on a card or row that navigates or opens something when tapped.
 */
export function KebabMenu({
  label,
  disabled = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(open, menuRef, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <div
      className="relative shrink-0"
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-label={label}
        className="p-2 rounded-lg bg-foreground/10 active:bg-foreground/20 transition-colors disabled:opacity-40"
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
      {open && (
        <div
          data-open-menu
          className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[140px]"
        >
          <CloseKebabMenu.Provider value={() => setOpen(false)}>
            {children}
          </CloseKebabMenu.Provider>
        </div>
      )}
    </div>
  );
}

export function KebabMenuItem({
  onSelect,
  disabled = false,
  danger = false,
  children,
}: {
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  const close = useContext(CloseKebabMenu);

  return (
    <button
      onClick={() => {
        close();
        onSelect();
      }}
      disabled={disabled}
      className={`block w-full px-4 py-2 text-sm text-left whitespace-nowrap ${
        disabled
          ? 'text-foreground/30 cursor-not-allowed'
          : `hover:bg-foreground/10 ${danger ? 'text-red-500' : ''}`
      }`}
    >
      {children}
    </button>
  );
}
