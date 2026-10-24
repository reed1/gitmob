# The PWAs, routing and icons

## Three hostnames, one server

Three installable PWAs off one server, on **three hostnames**: `gitmob.<front>` serves `/app`,
`pinboard.<front>` serves `/pinboard`, the read-and-remove overview of every project's notes, and
`checklist.<front>` serves `/checklist`. Each is one portman registration pointing at the same port
(`static.yaml`), so every front follows.

No two may share an origin: Android gives every installed PWA its own app-level notification
permission while Chrome keeps one permission per origin, so opening the app that was never granted
it revoked the other's — and the revocation takes the origin's push subscription with it. That was
the whole bug behind "GitMob says it is not subscribed".

`src/proxy.ts` keeps them apart — each host serves only its own app and redirects the others' paths
to the sibling host, `/` lands on whichever app the host is for, and a host the name does not
identify (`dev.gitmob.loc`, localhost) serves them all untouched, since nothing is installed from
those. `/api` is never redirected: every app calls it on its own origin, and all of them see the
same server state.

A third app means a third hostname — the Checklist sends no notifications, but sharing GitMob's
origin would still have its install overwrite GitMob's permission.

Adding notes stays on a project's Pinboard tab; the overview reads all boards through
`/api/pinboard`, and edits and deletes notes.

That call takes a couple of seconds — it runs `rv pinboard list` once per project — so the overview
does not wait on it to draw anything. Its last response is kept in localStorage through
`useCachedState` (`src/lib/use-cached-state.ts`) and painted on open; the spinning refresh icon is
the only sign that a fetch is in flight. The full-page "Loading..." is only ever seen before the
first successful fetch on a device. The hook keeps the value in localStorage rather than in React
state, reading it through `useSyncExternalStore` so the server-rendered markup, which has no store
to read, still hydrates cleanly.

Edit and Delete stay disabled until that fetch lands, which gives the page a list of its own to
change. Both are optimistic: the modal closes and the list changes at once, and the page never
reconciles with what the server answers. A failed write is only a toast — a failed edit leaves the
text it sent on screen to copy and retry after a reload, a failed delete asks for a reload. Writes
go out as plain `fetch` calls, not `apiFetch`, so two to the same board may overlap. Each successful
write re-reads every board 10 seconds after the last one and stores it in the cache alone; the
screen changes only on a reload or the refresh button.

On a keyboard the overview is driven like a list: one note is always highlighted (the first on
open), `j`/`k` move the highlight and scroll it into view, Space expands or collapses it as a tap
would and keeps it in view, `y` copies it, `o` opens its project's Pinboard tab, `e` opens it in the
edit box — Ctrl+Enter saves, Escape cancels — `x` asks to delete it — Enter or `y` confirms, Escape
or `n` cancels — and `q` closes the app window. The highlight follows the note, not its place in the
list: a refresh keeps it on the same note and falls back to the first when that note is gone, and a
delete passes it to the next note.

`/` empties the search box beside the title and focuses it; Enter applies its words as the filter —
every word must appear in a note's text or project id — and highlights the first match, so `/` then
Enter shows every note again. Escape leaves the box without applying it.

## The Checklist

Lists of what to bring, as plain text. Each list is one file in this repository,
`checklists/<name>.json`, holding `{ "items": [...] }` and nothing else: the filename is the list's
name, so a name is lowercase letters joined by single dashes, and renaming a list renames its file.
Lists are shown in filename order.

Like the Pinboard overview, the page paints the lists it last read, kept in localStorage through
`useCachedState`, and replaces them when `/api/checklist` answers; the spinning refresh icon shows
the read in flight. Edit stays disabled until that read lands, since Save sends every list and would
otherwise write a stale one back.

Edit changes nothing until Save. Save sends every list to `/api/checklist`, which writes them, deletes
the file of each list that is gone — removed or renamed — and commits `checklists/` alone, leaving
anything else staged where it is; a save that changes nothing commits nothing. The page then reads
the lists back. Cancel drops the edits.

## Routing rules

- Keep every GitMob page under `/app`: a page left at the root would fall outside the manifest scope
  and open in Chrome's in-app browser instead of the installed PWA.
- A project page is `/app/p/<projectId>`, never `/app/<projectId>`. Project ids come from
  rworkspaces and are not this app's to choose — one named `files` or `notifications` would
  otherwise be shadowed by a page of the same name, silently and only for that project. The prefix
  keeps GitMob's namespace free for pages.

## Icons and manifests

All PNGs/ICO in `public/` are generated from `assets/icon.svg` (GitMob),
`assets/pinboard-icon.svg` (the pinboard PWA) and `assets/checklist-icon.svg` (the checklist PWA)
via `assets/gen-icons.sh`; edit the SVGs and
regenerate rather than editing them by hand. Do NOT put an SVG in `src/app/` — it crashes the
Turbopack build.

Icons and manifests are named in each layout's `metadata`, not dropped into `src/app/` as Next's
file conventions: a convention file applies to every nested route too, so the root icon and manifest
would follow `/pinboard` around. Each PWA's manifest is named by its own layout —
`src/app/app/layout.tsx`, `src/app/pinboard/layout.tsx` and `src/app/checklist/layout.tsx` — and the
root layout names none of them.
