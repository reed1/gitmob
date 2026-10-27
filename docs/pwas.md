# The PWAs, routing and icons

## Three hostnames, one server

`gitmob.<front>` serves `/app`, `pinboard.<front>` serves `/pinboard` and `checklist.<front>` serves
`/checklist` — three portman registrations (`static.yaml`) pointing at the same port.

No two apps may share an origin. Android gives each installed PWA its own notification permission
while Chrome keeps one per origin, so installing a second app on the same origin revokes the first
one's permission, and its push subscription with it. A new app means a new hostname.
`src/proxy.ts` keeps each app on its own host.

## Routing rules

- Keep every GitMob page under `/app`: a page outside the manifest scope opens in Chrome's in-app
  browser instead of the installed PWA.
- A project page is `/app/p/<projectId>`, never `/app/<projectId>`: project ids come from
  rworkspaces, and one named like a page would be shadowed by it.

## Icons and manifests

The PNGs and ICO in `public/` are generated from the SVGs in `assets/` by `assets/gen-icons.sh`;
edit the SVGs and regenerate. Never put an SVG in `src/app/` — it crashes the Turbopack build.

Each PWA names its icons and manifest in its own layout's `metadata`, not through Next's file
conventions in `src/app/`, which would apply to every nested route.

## Offline

Pinboard and Checklist open with no network. `public/sw.js` serves their page and every asset it
names from a cache, then fetches a fresh copy behind it, so a new build shows on the open after the
one that fetched it.

Both pages are built on `useOfflineFirst` (`src/lib/use-offline-first.ts`), which paints the data
cached in localStorage, asks the server only after that and keeps the cached data when the server
cannot be reached, and on `OfflineFirstPage` (`src/components/OfflineFirstPage.tsx`), the header
with its refresh button and the body that waits for that data. A page that is to open offline is
built on the two, and its home path added to `OFFLINE_HOMES` in `public/sw.js`.

The worker picks the app by the hostname's first label. GitMob caches nothing, and neither does a
dev host, so offline behaviour can only be tried on a `pinboard.` or `checklist.` host.
