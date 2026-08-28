# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.

## Tech Stack

React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git

## Structure

- `/src/lib` - Core logic (git.ts, run.ts, projects.ts, files.ts)
- `/src/app/api` - API routes (projects, cli jobs, dooit todos)
- `/src/app/app/p/[projectId]/components` - Project views (FileBrowser, ChangesView, CommitView, RunView, CLIView, DooitView, ClaudeView, PushView, SudoView)

## Development

```
pnpm dev && pnpm lint && pnpm format
pnpm build && pnpm start
```

`pnpm dev` builds into `.next` and is yours to start, restart and kill. My own dev server is
`pnpm dev:rv`, started by `rv run` (cmd `web`) and served at http://dev.gitmob.loc — it builds
into `.next-dev`, so leave it running.

## Production

Deployed on my PC as the `gitmob` systemd user service, which runs `run_production.sh`: it builds
`.next-prod` (`GITMOB_DIST_DIR`) when HEAD moved, then serves it with `next start`.

## App Icons

All PNGs/ICO in `public/` are generated from `assets/icon.svg` (GitMob) and
`assets/pinboard-icon.svg` (the pinboard PWA) via `assets/gen-icons.sh`; edit the SVGs and
regenerate rather than editing them by hand. Do NOT put an SVG in `src/app/` — it crashes the
Turbopack build.

Icons and manifests are named in each layout's `metadata`, not dropped into `src/app/` as Next's
file conventions: a convention file applies to every nested route too, so the root icon and
manifest would follow `/pinboard` around. Each PWA's manifest is named by its own layout —
`src/app/app/layout.tsx` and `src/app/pinboard/layout.tsx` — and the root layout names neither.

## Key Patterns

- Projects loaded from `~/.cache/rlocal/rofi-vscode/projects.generated.json`, plus the
  worktrees open on the desktop — see [docs/cli-integrations.md](docs/cli-integrations.md).
  A worktree project carries `canonicalId` and `worktreeName` as fields, published by
  rworkspaces: how an id encodes them is rworkspaces' business, and nothing here parses one.
- CLI commands and deploys run as detached processes through `src/lib/cli-jobs.ts`, output to
  `~/.local/share/gitmob/cli-jobs/{jobId}.log` — they outlive the request and the tab that
  started them
- A job with `notify` set pushes its result to every browser subscribed under
  `~/.local/share/gitmob/notification-devices.json` — Web Push from `src/lib/notifications.ts`,
  received by the service worker in `public/sw.js`, so the notification comes from the installed
  PWA itself. The VAPID keypair generates itself on first send; the Notifications page in the
  gear menu is where a device subscribes. A push service answering 404/410 means that
  subscription is dead, so the send drops it — which is why enabling always mints a fresh
  subscription rather than reusing the one the browser offers, and why `sw.js` re-registers on
  `pushsubscriptionchange`. Delivery counts come back from `sendNotification`: a send that
  reached nobody must not report success.
- A push subscription dies with its origin's notification permission, which on Android is
  delegated to the installed app's own app-level permission — the reason the two PWAs are on two
  hostnames above. Eviction of the origin's storage takes it too, so enabling asks for persistent
  storage on the way through.
- Two installable PWAs off one server, on **two hostnames**: `gitmob.<front>` serves `/app`,
  `pinboard.<front>` serves `/pinboard`, the read-and-remove overview of every project's notes.
  Both are one portman registration each pointing at the same port (`static.yaml`), so all five
  fronts follow. They must not share an origin: Android gives every installed PWA its own
  app-level notification permission while Chrome keeps one permission per origin, so opening the
  app that was never granted it revoked the other's — and the revocation takes the origin's push
  subscription with it. That was the whole bug behind "GitMob says it is not subscribed".
  `src/proxy.ts` keeps them apart — each host serves only its own app and redirects the other's
  paths to the sibling host, `/` lands on whichever app the host is for, and a host the name does
  not identify (`dev.gitmob.loc`, localhost) serves both untouched, since nothing is installed
  from those. `/api` is never redirected: both apps call it on their own origin, and the two see
  the same server state. Keep every GitMob page under `/app`: a page left at the root would fall
  outside the manifest scope and open in Chrome's in-app browser instead of the installed PWA.
  Adding and editing notes stay on a project's Pinboard tab; the overview reads all boards
  through `/api/pinboard`.
- `claudex handoff` parks a briefing here instead of opening a window when `am-i-afk` says
  nobody is at the desktop: `~/.local/share/gitmob/pending-handoffs`, one file per handoff,
  announced at the top of the front page — above the project list, whichever project it names —
  to edit and launch from there. The same trade gg makes when it sends a commit message to the
  Commit tab rather than a review overlay nobody is sitting in front of. Contract in
  [docs/cli-integrations.md](docs/cli-integrations.md).
- A project page is `/app/p/<projectId>`, never `/app/<projectId>`. Project ids come from
  rworkspaces and are not this app's to choose — one named `files` or `notifications` would
  otherwise be shadowed by a page of the same name, silently and only for that project. The
  prefix keeps GitMob's namespace free for pages.
- Per-project state (sudo, runs, desktop sessions) belongs to the CLI that owns it — `pt`, `rv`, `claudex`. Shell out to those commands and surface their failures; never read their caches or redo their lookups here. Contracts in [docs/cli-integrations.md](docs/cli-integrations.md).
