# The two PWAs, routing and icons

## Two hostnames, one server

Two installable PWAs off one server, on **two hostnames**: `gitmob.<front>` serves `/app`,
`pinboard.<front>` serves `/pinboard`, the read-and-remove overview of every project's notes. Both
are one portman registration each pointing at the same port (`static.yaml`), so all five fronts
follow.

They must not share an origin: Android gives every installed PWA its own app-level notification
permission while Chrome keeps one permission per origin, so opening the app that was never granted
it revoked the other's — and the revocation takes the origin's push subscription with it. That was
the whole bug behind "GitMob says it is not subscribed".

`src/proxy.ts` keeps them apart — each host serves only its own app and redirects the other's paths
to the sibling host, `/` lands on whichever app the host is for, and a host the name does not
identify (`dev.gitmob.loc`, localhost) serves both untouched, since nothing is installed from those.
`/api` is never redirected: both apps call it on their own origin, and the two see the same server
state.

Adding and editing notes stay on a project's Pinboard tab; the overview reads all boards through
`/api/pinboard`.

## Routing rules

- Keep every GitMob page under `/app`: a page left at the root would fall outside the manifest scope
  and open in Chrome's in-app browser instead of the installed PWA.
- A project page is `/app/p/<projectId>`, never `/app/<projectId>`. Project ids come from
  rworkspaces and are not this app's to choose — one named `files` or `notifications` would
  otherwise be shadowed by a page of the same name, silently and only for that project. The prefix
  keeps GitMob's namespace free for pages.

## Icons and manifests

All PNGs/ICO in `public/` are generated from `assets/icon.svg` (GitMob) and
`assets/pinboard-icon.svg` (the pinboard PWA) via `assets/gen-icons.sh`; edit the SVGs and
regenerate rather than editing them by hand. Do NOT put an SVG in `src/app/` — it crashes the
Turbopack build.

Icons and manifests are named in each layout's `metadata`, not dropped into `src/app/` as Next's
file conventions: a convention file applies to every nested route too, so the root icon and manifest
would follow `/pinboard` around. Each PWA's manifest is named by its own layout —
`src/app/app/layout.tsx` and `src/app/pinboard/layout.tsx` — and the root layout names neither.
