'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToast, apiFetch } from '../../../lib/api';
import { goHome } from '../../../lib/app-depth';
import { useBackToDismiss } from '../../../lib/use-back-to-dismiss';
import {
  ARROW_KEY_ROWS,
  COMMAND_KEYS,
  type BrowserKey,
} from '../../../lib/browser-keys';

/**
 * The agent's Chrome, driven from wherever the phone is.
 *
 * The page it draws is a JPEG of one tab, refetched on a loop, and every gesture on it goes
 * back as the coordinate it landed on: the frame is sized in CSS pixels, so nothing here
 * rescales anything. It exists for the sign-in the agent cannot do for itself — a login page
 * on a desktop that nobody is sitting at — which is why the frame gets the whole screen and
 * GitMob's own furniture is nowhere on it.
 *
 * It drives the page, not Chrome: there is no omnibox behind the URL box, and a file picker or
 * an HTTP-auth dialog is out of reach. Those need chrome-rdzero-attach and a laptop.
 */

/** Slow enough that a subprocess per frame is not the whole of what this machine does. */
const FRAME_GAP_MS = 1200;
/** Under this much travel a drag was a tap: fingers are not still. */
const TAP_SLOP_PX = 10;

interface Tab {
  id: string;
  title: string;
  url: string;
}

interface Frame {
  src: string;
  url: string;
  title: string;
}

export default function BrowserPage() {
  const router = useRouter();
  const [tab, setTab] = useState<string | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [controls, setControls] = useState(true);
  /** Only for the button's label — the scale itself is a ref, being written on every move. */
  const [atFit, setAtFit] = useState(true);
  const [address, setAddress] = useState('');
  const [typing, setTyping] = useState('');

  const boxRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  /** Where the frame sits in its box and how big it is drawn — this page's own, sent nowhere. */
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const atFitRef = useRef(true);
  const sizedRef = useRef('');
  // Set while a scroll is on the wire. A drag produces far more deltas than a subprocess per
  // request can carry, so the ones raised meanwhile are added up and sent as one.
  const scrollingRef = useRef(false);
  const pendingScrollRef = useRef({ x: 0, y: 0, dx: 0, dy: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    span: number;
    midX: number;
    midY: number;
  } | null>(null);
  const dragRef = useRef<{
    lastX: number;
    lastY: number;
    travelled: number;
  } | null>(null);

  useBackToDismiss(tabsOpen, () => setTabsOpen(false));

  /** Cuts the wait between frames short, for after something that changed the page. */
  const refreshNow = useCallback(() => wakeRef.current?.(), []);

  const grabFrame = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;

    const query = tab ? `?tab=${encodeURIComponent(tab)}` : '';
    const res = await fetch(`/api/browser/screenshot${query}`).catch(
      () => null
    );
    if (res === null) {
      setError('Could not reach GitMob');
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? `Could not read that Chrome (${res.status})`);
      setLoading(false);
      return;
    }

    const next = URL.createObjectURL(await res.blob());
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = next;

    const url = decodeURIComponent(res.headers.get('X-Browser-Url') ?? '');
    setFrame({
      src: next,
      url,
      title: decodeURIComponent(res.headers.get('X-Browser-Title') ?? ''),
    });
    // Pinned on the first frame: with no tab named the capture follows whichever one Chrome
    // has in front, and a tap meant for the page in view must not land on a tab that moved
    // there in between.
    const shown = res.headers.get('X-Browser-Tab');
    if (shown && shown !== tab) setTab(shown);
    setError(null);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    let stopped = false;

    async function loop() {
      while (!stopped) {
        await grabFrame();
        if (stopped) return;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, FRAME_GAP_MS);
          wakeRef.current = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      }
    }

    loop();
    return () => {
      stopped = true;
      wakeRef.current?.();
    };
  }, [grabFrame]);

  // Frames are not fetched while the tab is in the background, so coming back to it wants one
  // now rather than at the end of a wait that has been running the whole time it was away.
  useEffect(() => {
    document.addEventListener('visibilitychange', refreshNow);
    return () => document.removeEventListener('visibilitychange', refreshNow);
  }, [refreshNow]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Turning the phone, or folding the controls away, changes the box the frame is fitted to.
  // A view left at fit is refitted; one the user has zoomed is only pulled back inside.
  useEffect(() => {
    const box = boxRef.current;
    if (box === null) return;
    const observer = new ResizeObserver(() => {
      if (imageRef.current === null || imageRef.current.naturalWidth === 0) {
        return;
      }
      setScale(atFitRef.current ? fitScale() : viewRef.current.scale);
    });
    observer.observe(box);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The address bar follows the page except while it is being typed into, which focus says.
  useEffect(() => {
    if (frame && document.activeElement?.tagName !== 'INPUT') {
      setAddress(frame.url);
    }
  }, [frame]);

  const send = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, tab }),
      });
      if (res.ok) refreshNow();
      return res.ok;
    },
    [tab, refreshNow]
  );

  /**
   * The frame is moved and scaled here rather than by the browser: `touch-action: none` is what
   * stops a drag over the page from being taken as a scroll of GitMob itself, and it takes the
   * browser's own pinch with it. So the view is a transform this page owns, written straight to
   * the element — a re-render per finger-move would only make it stutter.
   */
  function applyView() {
    const image = imageRef.current;
    if (image === null) return;
    const view = viewRef.current;
    image.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  }

  /** The scale at which the whole width of the page is on screen. */
  function fitScale() {
    const image = imageRef.current;
    const box = boxRef.current;
    if (image === null || box === null || image.naturalWidth === 0) return 1;
    return box.clientWidth / image.naturalWidth;
  }

  /** Keeps the frame against the edges it has reached, and centred on any axis it fits in. */
  function clampView() {
    const image = imageRef.current;
    const box = boxRef.current;
    if (image === null || box === null) return;

    const view = viewRef.current;
    const width = image.naturalWidth * view.scale;
    const height = image.naturalHeight * view.scale;
    view.x =
      width <= box.clientWidth
        ? (box.clientWidth - width) / 2
        : Math.min(0, Math.max(box.clientWidth - width, view.x));
    view.y =
      height <= box.clientHeight
        ? (box.clientHeight - height) / 2
        : Math.min(0, Math.max(box.clientHeight - height, view.y));
  }

  /** Kept in a ref beside the state: the resize observer reads it without being rebuilt on
   *  every frame, and the button reads the state. */
  function noteScale() {
    const fitted = Math.abs(viewRef.current.scale - fitScale()) < 0.01;
    atFitRef.current = fitted;
    setAtFit(fitted);
  }

  function setScale(scale: number) {
    viewRef.current.scale = scale;
    clampView();
    applyView();
    noteScale();
  }

  /**
   * A frame lands on the loop, so most of them must leave the view exactly where the last
   * gesture put it — being pulled back to fit every second is not a view anybody can work in.
   * Only a frame of a size this page has not sized itself against resets it, which is the
   * first one and then a remote window that changed shape.
   */
  function onFrameLoad() {
    const image = imageRef.current;
    if (image === null) return;
    const size = `${image.naturalWidth}x${image.naturalHeight}`;
    if (sizedRef.current === size) {
      applyView();
      return;
    }
    sizedRef.current = size;
    setScale(fitScale());
  }

  /** Where on the remote page a point on this screen is — the view transform, undone. */
  function toPage(clientX: number, clientY: number) {
    const box = boxRef.current;
    const image = imageRef.current;
    if (box === null || image === null || image.naturalWidth === 0) return null;
    const rect = box.getBoundingClientRect();
    const view = viewRef.current;
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }

  async function flushScroll() {
    if (scrollingRef.current) return;
    const pending = pendingScrollRef.current;
    if (pending.dx === 0 && pending.dy === 0) return;

    pendingScrollRef.current = { x: pending.x, y: pending.y, dx: 0, dy: 0 };
    scrollingRef.current = true;
    try {
      await send('/api/browser/input', { action: 'scroll', ...pending });
    } finally {
      scrollingRef.current = false;
    }
    flushScroll();
  }

  /** The two fingers of a pinch, as a span and a point between them. */
  function pinchOf(points: { x: number; y: number }[]) {
    const [first, second] = points;
    return {
      span: Math.hypot(second.x - first.x, second.y - first.y),
      midX: (first.x + second.x) / 2,
      midY: (first.y + second.y) / 2,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLImageElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = pointersRef.current;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (points.size === 1) {
      dragRef.current = {
        lastX: event.clientX,
        lastY: event.clientY,
        travelled: 0,
      };
      return;
    }
    // A second finger means the first was never a tap or a scroll of the page — it was half of
    // a pinch that had not opened yet. Dropping the drag is what stops it landing as a click.
    dragRef.current = null;
    pinchRef.current = pinchOf([...points.values()]);
  }

  function onPointerMove(event: React.PointerEvent<HTMLImageElement>) {
    const points = pointersRef.current;
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (points.size >= 2) {
      movePinch([...points.values()]);
      return;
    }

    const drag = dragRef.current;
    if (drag === null) return;
    const movedX = event.clientX - drag.lastX;
    const movedY = event.clientY - drag.lastY;
    drag.travelled += Math.abs(movedX) + Math.abs(movedY);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (drag.travelled < TAP_SLOP_PX) return;

    const point = toPage(event.clientX, event.clientY);
    if (point === null) return;
    // The page goes the other way from the finger, which is what dragging a page means. In the
    // page's own pixels, which the view's scale is the whole of the difference from.
    pendingScrollRef.current = {
      x: point.x,
      y: point.y,
      dx: pendingScrollRef.current.dx - movedX / viewRef.current.scale,
      dy: pendingScrollRef.current.dy - movedY / viewRef.current.scale,
    };
    flushScroll();
  }

  /** Zoom about the point between the fingers, and follow it as it moves. Nothing is sent: two
   *  fingers move the view over the page, where one finger moves the page under the view. */
  function movePinch(points: { x: number; y: number }[]) {
    const previous = pinchRef.current;
    const now = pinchOf(points);
    pinchRef.current = now;
    if (previous === null || previous.span === 0 || now.span === 0) return;

    const box = boxRef.current;
    if (box === null) return;
    const rect = box.getBoundingClientRect();
    const view = viewRef.current;
    const growth = now.span / previous.span;

    // The page point under the midpoint has to stay under it, which is what anchors the zoom
    // to the fingers instead of to the corner the transform is measured from.
    const anchorX = previous.midX - rect.left;
    const anchorY = previous.midY - rect.top;
    view.x = now.midX - rect.left - (anchorX - view.x) * growth;
    view.y = now.midY - rect.top - (anchorY - view.y) * growth;
    view.scale = Math.min(Math.max(view.scale * growth, fitScale() / 2), 4);

    clampView();
    applyView();
    noteScale();
  }

  function onPointerUp(event: React.PointerEvent<HTMLImageElement>) {
    const points = pointersRef.current;
    points.delete(event.pointerId);
    if (points.size < 2) pinchRef.current = null;
    // A finger lifted off a pinch leaves the other one down, and carrying on from where it is
    // would jump the page by however far apart they were.
    if (points.size === 1) {
      const [remaining] = [...points.values()];
      dragRef.current = {
        lastX: remaining.x,
        lastY: remaining.y,
        travelled: TAP_SLOP_PX,
      };
      return;
    }
    if (points.size > 0) return;

    const drag = dragRef.current;
    dragRef.current = null;
    if (drag === null) return;

    if (drag.travelled >= TAP_SLOP_PX) {
      flushScroll();
      return;
    }
    const point = toPage(event.clientX, event.clientY);
    if (point === null) return;
    send('/api/browser/input', { action: 'click', x: point.x, y: point.y });
  }

  async function loadTabs() {
    const res = await fetch('/api/browser');
    const data = await res.json();
    if (res.ok) setTabs(data.tabs);
    else addToast(data.error ?? 'Could not list the tabs');
  }

  function openTabs() {
    setTabsOpen(true);
    loadTabs();
  }

  async function act(action: string, body: Record<string, unknown> = {}) {
    const res = await apiFetch('/api/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, tab, ...body }),
    });
    if (res.ok) refreshNow();
    return res;
  }

  async function goToAddress(event: React.FormEvent) {
    event.preventDefault();
    const typed = address.trim();
    if (!typed) return;
    // A bare hostname is a URL that has not been written out yet, not a search: this box is
    // pointed at a login page somebody already knows the address of.
    const url = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;
    (event.target as HTMLFormElement).querySelector('input')?.blur();
    await act('navigate', { url });
  }

  async function newTab() {
    const res = await act('open', { url: 'about:blank' });
    if (!res.ok) return;
    setTab((await res.json()).id);
    setTabsOpen(false);
  }

  async function dropTab(id: string) {
    const res = await apiFetch('/api/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close', tab: id }),
    });
    if (!res.ok) return;
    // Closing the tab being watched leaves nothing to watch: fall back to whichever Chrome
    // puts in front next, which the next frame reports.
    if (id === tab) setTab(null);
    loadTabs();
  }

  async function sendTyped() {
    const text = typing;
    if (!text) return;
    setTyping('');
    await send('/api/browser/input', { action: 'text', text });
  }

  function pressKey(key: BrowserKey) {
    send('/api/browser/input', { action: 'key', key });
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black overscroll-none">
      {controls && (
        <div className="shrink-0 bg-background border-b border-foreground/10">
          <div className="flex items-center gap-1 px-2 py-2">
            <IconButton label="Leave" onClick={() => goHome(router)}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </IconButton>
            <IconButton label="Back" onClick={() => act('back')}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </IconButton>
            <IconButton label="Forward" onClick={() => act('forward')}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </IconButton>
            <IconButton label="Reload" onClick={() => act('reload')}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </IconButton>
            <form onSubmit={goToAddress} className="flex-1 min-w-0">
              <input
                type="url"
                inputMode="url"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-1.5 bg-foreground/5 border border-foreground/10 rounded-lg text-xs placeholder:text-foreground/40 focus:outline-none focus:border-foreground/30"
              />
            </form>
            <IconButton label="Tabs" onClick={openTabs}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </IconButton>
          </div>
          {error && (
            <div className="px-3 pb-2 text-xs text-red-400 break-words">
              {error}
            </div>
          )}
        </div>
      )}

      {/* The frame is placed by the transform, not by the layout: it is drawn at its natural
          size in the corner and moved from there, so panning and pinching are two numbers
          rather than a scroll box the browser would want to drive itself. */}
      <div ref={boxRef} className="relative flex-1 overflow-hidden">
        {frame && (
          // Not next/image: the frame is an object URL for a JPEG this server just made, so
          // there is nothing for the optimiser to fetch, size or cache.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imageRef}
            src={frame.src}
            alt={frame.title}
            draggable={false}
            onLoad={onFrameLoad}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onPointerUp}
            style={{ touchAction: 'none', transformOrigin: '0 0' }}
            className="absolute top-0 left-0 max-w-none select-none"
          />
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-foreground/50 text-sm">
            Reaching that Chrome...
          </div>
        )}
        <button
          onClick={() => setControls(!controls)}
          aria-label={controls ? 'Hide the controls' : 'Show the controls'}
          className="fixed top-1/2 right-0 -translate-y-1/2 z-20 px-1 py-6 rounded-l-lg bg-background/80 border border-r-0 border-foreground/20 text-foreground/60 backdrop-blur"
        >
          <svg
            className={`w-4 h-4 ${controls ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {controls && (
        <div className="shrink-0 bg-background border-t border-foreground/10 px-2 py-2 space-y-2">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={typing}
              onChange={(e) => setTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendTyped();
                }
              }}
              placeholder="Type into the page"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 px-3 py-1.5 bg-foreground/5 border border-foreground/10 rounded-lg text-sm placeholder:text-foreground/40 focus:outline-none focus:border-foreground/30"
            />
            <button
              onClick={sendTyped}
              disabled={typing === ''}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-foreground/10 text-sm active:opacity-80 disabled:opacity-40"
            >
              Send
            </button>
            <button
              onClick={() => setScale(atFit ? 1 : fitScale())}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-foreground/10 text-sm tabular-nums active:opacity-80"
            >
              {atFit ? '1:1' : 'Fit'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {COMMAND_KEYS.map((entry) => (
              <button
                key={entry.key}
                onClick={() => pressKey(entry.key)}
                className="px-2.5 py-1 rounded-md bg-foreground/10 border border-b-[3px] border-foreground/25 text-foreground/70 text-xs active:opacity-80"
              >
                {entry.label}
              </button>
            ))}
            {/* Kept in one box so a narrow screen wraps the four of them together: an arrow
                pad split across two lines stops reading as a direction. */}
            <div className="flex items-center gap-1">
              {ARROW_KEY_ROWS.flat().map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => pressKey(entry.key)}
                  className="w-8 py-1 rounded-md bg-foreground/10 border border-b-[3px] border-foreground/25 text-foreground/70 text-xs active:opacity-80"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tabsOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 flex items-end"
          onClick={() => setTabsOpen(false)}
        >
          <div
            className="w-full max-h-[70vh] overflow-y-auto bg-background rounded-t-xl border-t border-foreground/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
              <span className="text-sm font-medium">Tabs</span>
              <button
                onClick={newTab}
                className="px-3 py-1 rounded-lg bg-foreground/10 text-sm active:opacity-80"
              >
                New tab
              </button>
            </div>
            {tabs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-4 py-3 border-b border-foreground/5"
              >
                <button
                  onClick={() => {
                    setTab(entry.id);
                    setTabsOpen(false);
                    refreshNow();
                  }}
                  className="flex-1 min-w-0 text-left active:opacity-80"
                >
                  <div
                    className={`text-sm truncate ${
                      entry.id === tab
                        ? 'text-foreground'
                        : 'text-foreground/70'
                    }`}
                  >
                    {entry.title || entry.url}
                  </div>
                  <div className="text-xs text-foreground/40 truncate">
                    {entry.url}
                  </div>
                </button>
                <button
                  onClick={() => dropTab(entry.id)}
                  aria-label="Close this tab"
                  className="shrink-0 p-2 text-foreground/50 active:opacity-80"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="shrink-0 p-1.5 rounded-lg text-foreground/60 hover:bg-foreground/10 active:opacity-80"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {children}
      </svg>
    </button>
  );
}
