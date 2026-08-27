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
- Chrome discards a subscription on its own and nothing on either side is told, so the open
  question is which of several things happened. `~/.local/share/gitmob/notification-events.jsonl`
  is the trail that answers it: every enrol, rotation, removal and delivery outcome from
  `src/lib/notifications.ts`, plus what the browser saw — a `boot-state` line per page load from
  `GlobalUI`, and `push-received` / `subscription-change` from `sw.js`, posted through
  `/api/notifications/events`. A device row carries an `installId` from the browser's
  localStorage: it survives a subscription being replaced and dies with the origin's storage, so
  two rows sharing one were enrolled by the same install and two different ones mean the storage
  was wiped in between. Reads must not repair what they measure — `currentEndpoint` and
  `deviceState` use `getRegistration`, never `register`, and only `GlobalUI` and enrolling
  register a worker.
- Two installable PWAs off one app, on scopes that do not contain each other: `/app` is GitMob,
  `/pinboard` is the read-and-remove overview of every project's notes, each with its own
  manifest, scope and icon. Neither owns the root — `/` only redirects to `/app` — so the two
  install in either order. Keep every GitMob page under `/app`: a page left at the root would
  fall outside the scope and open in Chrome's in-app browser instead of the installed PWA.
  The overview reads all boards through `/api/pinboard`; adding and editing stay on a project's
  Pinboard tab. `/api` is shared by both and stays at the root — `scope` constrains navigations,
  not `fetch`.
- A project page is `/app/p/<projectId>`, never `/app/<projectId>`. Project ids come from
  rworkspaces and are not this app's to choose — one named `files` or `notifications` would
  otherwise be shadowed by a page of the same name, silently and only for that project. The
  prefix keeps GitMob's namespace free for pages.
- Per-project state (sudo, runs, desktop sessions) belongs to the CLI that owns it — `pt`, `rv`, `claudex`. Shell out to those commands and surface their failures; never read their caches or redo their lookups here. Contracts in [docs/cli-integrations.md](docs/cli-integrations.md).
