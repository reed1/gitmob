'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { addToast } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { useCachedState } from '@/lib/use-cached-state';
import { KebabMenu, KebabMenuItem } from './KebabMenu';
import { Modal } from './Modal';
import { SpeakButton } from './SpeakButton';

const ENABLED_KEY = 'gitmob:scratchpad:enabled';
const POSITION_KEY = 'gitmob:scratchpad:position';
const TEXT_KEY = 'gitmob:scratchpad:text';
const SAVE_DELAY_MS = 500;
const FAB_SIZE = 56;
const DRAG_THRESHOLD = 8;

/** Where the button sits, as fractions of the room the viewport leaves it, so a rotation keeps it on screen. */
interface Position {
  x: number;
  y: number;
}

export function useScratchpadEnabled() {
  const [enabled, setEnabled] = useCachedState<boolean>(ENABLED_KEY);
  const [, setPosition] = useCachedState<Position | null>(POSITION_KEY);
  const toggle = () => {
    if (enabled) setPosition(null);
    setEnabled(!enabled);
  };
  return [enabled === true, toggle] as const;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** The draggable button, on every GitMob page while the scratchpad is on. */
export function Scratchpad() {
  const [enabled] = useCachedState<boolean>(ENABLED_KEY);
  const [savedPosition, setSavedPosition] = useCachedState<Position | null>(
    POSITION_KEY
  );
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const drag = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const dragged = useRef(false);

  if (!enabled) return null;

  const positionAt = (
    event: PointerEvent,
    offsetX: number,
    offsetY: number
  ) => ({
    x: clamp((event.clientX - offsetX) / (window.innerWidth - FAB_SIZE)),
    y: clamp((event.clientY - offsetY) / (window.innerHeight - FAB_SIZE)),
  });

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragged.current = false;
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    if (
      !current.moved &&
      Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY
      ) < DRAG_THRESHOLD
    )
      return;
    current.moved = true;
    setDragPosition(positionAt(event, current.offsetX, current.offsetY));
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    dragged.current = true;
    setSavedPosition(positionAt(event, current.offsetX, current.offsetY));
    setDragPosition(null);
  };

  const position = dragPosition ?? savedPosition;

  return (
    <>
      <button
        aria-label="Scratchpad"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragPosition(null);
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          setOpen(true);
        }}
        style={
          position
            ? {
                left: `calc((100% - ${FAB_SIZE}px) * ${position.x})`,
                top: `calc((100% - ${FAB_SIZE}px) * ${position.y})`,
              }
            : undefined
        }
        className={`fixed z-40 w-14 h-14 rounded-full bg-amber-500 text-black shadow-lg shadow-black/30 flex items-center justify-center touch-none select-none active:opacity-80 ${
          position
            ? ''
            : 'right-4 bottom-[max(1rem,env(safe-area-inset-bottom))]'
        }`}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>
      {open && <ScratchpadModal onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The one modal a tap outside closes with text in it: the text is saved as it is typed, so
 * closing loses nothing.
 */
function ScratchpadModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(
    () => window.localStorage.getItem(TEXT_KEY) ?? ''
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current!;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.scrollTop = textarea.scrollHeight;
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => window.localStorage.setItem(TEXT_KEY, text),
      SAVE_DELAY_MS
    );
    return () => clearTimeout(timer);
  }, [text]);

  const close = () => {
    window.localStorage.setItem(TEXT_KEY, text);
    onClose();
  };

  const clear = () => {
    setText('');
    textareaRef.current!.focus();
  };

  const copy = async () => {
    if (await copyText(text)) addToast('Copied scratchpad', 'success');
    else addToast('Could not copy to the clipboard');
  };

  return (
    <Modal
      heading="Scratchpad"
      onClose={close}
      guardDismiss={false}
      menu={
        <KebabMenu label="Scratchpad actions">
          <KebabMenuItem onSelect={clear} disabled={!text} danger>
            Clear
          </KebabMenuItem>
        </KebabMenu>
      }
    >
      <div className="p-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick notes..."
          rows={12}
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded resize-none"
        />
      </div>
      <div className="px-4 py-3 border-t border-foreground/10 flex items-center justify-between gap-2">
        {/* The scratchpad belongs to no project, so dictation takes only the shared phrase table. */}
        <SpeakButton
          projectId="global"
          textareaRef={textareaRef}
          onChange={setText}
        />
        <div className="flex gap-2">
          <button
            onClick={copy}
            disabled={!text}
            className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30"
          >
            Copy
          </button>
          <button
            onClick={close}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
