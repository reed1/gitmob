'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ImagePreview } from '@/components/ImagePreview';
import { apiFetch } from '@/lib/api';
import { postcardImageUrl, type Postcard } from '@/lib/postcards';
import { relativeTime } from '@/lib/relative-time';
import { useBackToDismiss } from '@/lib/use-back-to-dismiss';
import { useLoad } from '@/lib/use-load';
import { postcardLabel } from '@/app/app/NewPostcards';

interface SessionGroup {
  sessionId: string;
  postcards: Postcard[];
}

interface OpenImage {
  postcard: Postcard;
  file: string;
}

/** Postcards come newest first, so each session's group lands where its newest one does. */
function groupBySession(postcards: Postcard[]): SessionGroup[] {
  const groups = new Map<string, Postcard[]>();
  for (const postcard of postcards) {
    groups.set(postcard.sessionId, [
      ...(groups.get(postcard.sessionId) ?? []),
      postcard,
    ]);
  }
  return [...groups].map(([sessionId, grouped]) => ({
    sessionId,
    postcards: grouped,
  }));
}

function checkoutLabel(postcard: Postcard): string {
  const project = postcard.canonicalProjectId ?? postcardLabel(postcard);
  return postcard.worktreeName
    ? `${project} › ${postcard.worktreeName}`
    : project;
}

export default function PostcardsPage() {
  // useSearchParams opts a static route out of prerendering only inside a boundary.
  return (
    <Suspense>
      <Postcards />
    </Suspense>
  );
}

/**
 * Every postcard sessions sent with `claudex postcard`, or one session's with `?session=`,
 * grouped by the session that sent them under the project and worktree it works in. The ones
 * not seen before are marked new for this visit, and seen from the next.
 */
function Postcards() {
  const router = useRouter();
  const session = useSearchParams().get('session');
  const [postcards, setPostcards] = useState<Postcard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenImage | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      session
        ? `/api/postcards?session=${encodeURIComponent(session)}`
        : '/api/postcards'
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not read the postcards');
      return;
    }
    const loaded: Postcard[] = data.postcards;
    setPostcards(loaded);
    setError(null);
    const unseen = loaded.filter((p) => !p.seen).map((p) => p.id);
    if (unseen.length > 0) {
      await apiFetch('/api/postcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seen: unseen }),
      });
    }
  }, [session]);

  useLoad(load);
  useBackToDismiss(open !== null, () => setOpen(null));

  const groups = postcards ? groupBySession(postcards) : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Postcards</h1>
            {session && (
              <div className="text-xs text-foreground/50 truncate">
                {postcards?.[0] ? `${checkoutLabel(postcards[0])} · ` : ''}
                session {session.slice(0, 8)}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {error ? (
          <div className="p-4 rounded-lg border border-red-500/50 bg-red-500/10">
            <div className="text-sm font-medium text-red-500 mb-1">
              Could not read the postcards
            </div>
            <pre className="text-xs text-foreground/70 whitespace-pre-wrap break-words">
              {error}
            </pre>
          </div>
        ) : postcards === null ? (
          <div className="text-center text-foreground/50 py-8">Loading...</div>
        ) : postcards.length === 0 ? (
          <div className="text-center text-foreground/50 py-8">
            No postcards
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.sessionId} className="space-y-3">
              {!session && (
                <h2 className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-rose-400 truncate">
                    {checkoutLabel(group.postcards[0])}
                  </span>
                  <span className="shrink-0 text-xs text-foreground/40">
                    session {group.sessionId.slice(0, 8)}
                  </span>
                </h2>
              )}
              {group.postcards.map((postcard) => (
                <PostcardCard
                  key={postcard.id}
                  postcard={postcard}
                  onOpen={(file) => setOpen({ postcard, file })}
                />
              ))}
            </section>
          ))
        )}
      </main>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background">
          <header className="border-b border-foreground/10 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="text-foreground/50 hover:text-foreground transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0 text-sm line-clamp-2">
              {open.postcard.caption}
            </div>
          </header>
          <div className="flex-1 min-h-0">
            <ImagePreview
              src={postcardImageUrl(open.postcard.id, open.file)}
              alt={open.postcard.caption}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PostcardCard({
  postcard,
  onOpen,
}: {
  postcard: Postcard;
  onOpen: (file: string) => void;
}) {
  return (
    <article
      className={`rounded-lg border overflow-hidden ${
        postcard.seen
          ? 'border-foreground/10 bg-foreground/5'
          : 'border-rose-500/40 bg-rose-500/10'
      }`}
    >
      <div className="space-y-px">
        {postcard.images.map((file) => (
          <button
            key={file}
            onClick={() => onOpen(file)}
            className="block w-full bg-[repeating-conic-gradient(#8883_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={postcardImageUrl(postcard.id, file)}
              alt={postcard.caption}
              className="mx-auto max-w-full max-h-[70vh] object-contain"
            />
          </button>
        ))}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          {!postcard.seen && (
            <span className="px-1.5 rounded bg-rose-500 text-white font-medium">
              New
            </span>
          )}
          <span>{relativeTime(postcard.createdAt)}</span>
          {postcard.images.length > 1 && (
            <span>{postcard.images.length} images</span>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">{postcard.caption}</p>
      </div>
    </article>
  );
}
