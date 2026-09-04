# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.
React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git.

It serves two installable PWAs off one server: **GitMob** (`/app`) — per-project browsing, changes,
commits, pushes, runs, CLI jobs, todos, notes and Claude sessions — and **Pinboard** (`/pinboard`),
the overview of every project's notes. Projects and their per-project state come from the
desktop CLIs (`rworkspaces`, `wtman`, `pt`, `rv`, `claudex`, `gg`); long-running work runs as
detached jobs that report back over Web Push.

## Docs

- [docs/architecture.md](docs/architecture.md) — code layout, where projects come from, detached
  jobs, the guard against resent requests, parked handoffs, the session modal, dictation
- [docs/pwas.md](docs/pwas.md) — the two hostnames and `src/proxy.ts`, routing rules, icons and
  manifests
- [docs/notifications.md](docs/notifications.md) — Web Push, subscriptions, the service worker
- [docs/cli-integrations.md](docs/cli-integrations.md) — the contract with each CLI this app shells
  out to
- [docs/development.md](docs/development.md) — dev servers, build dirs, the production service
