# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.

## Tech Stack

React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git

## Structure

- `/src/lib` - Core logic (git.ts, run.ts, projects.ts, files.ts)
- `/src/app/api` - API routes (projects, cli jobs, dooit todos)
- `/src/app/p/[projectId]/components` - Project views (FileBrowser, ChangesView, CommitView, RunView, CLIView, DooitView, ClaudeView, PushView, SudoView)

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
manifest would follow `/pinboard` around.

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
  gear menu is where a device subscribes.
- Two installable PWAs off one app: `/` is GitMob, `/pinboard` is the read-and-remove overview
  of every project's notes, each with its own manifest, scope and icon. The overview reads all
  boards through `/api/pinboard`; adding and editing stay on a project's Pinboard tab.
  Install Pinboard FIRST: GitMob's scope is `/`, which contains `/pinboard`, so once GitMob is
  installed Chrome answers the inner app's install with "already installed" and opens GitMob.
  Uninstall both and take the inner one first if that happens.
- A project page is `/p/<projectId>`, never `/<projectId>`. Project ids come from rworkspaces
  and are not this app's to choose — one named `pinboard` or `files` would otherwise be
  shadowed by a page of the same name, silently and only for that project. The prefix keeps
  the root namespace free for pages.
- Per-project state (sudo, runs, desktop sessions) belongs to the CLI that owns it — `pt`, `rv`, `claudex`. Shell out to those commands and surface their failures; never read their caches or redo their lookups here. Contracts in [docs/cli-integrations.md](docs/cli-integrations.md).
