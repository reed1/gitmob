# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.
React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git.

It serves three installable PWAs off one server: **GitMob** (`/app`) — per-project browsing,
changes, commits, pushes, runs, CLI jobs, todos, notes and Claude sessions, plus `/app/browser`, a
project's agent Chrome driven by hand — **Pinboard** (`/pinboard`), the overview of every project's
notes, and **Checklist** (`/checklist`), lists of what to bring, kept as JSON in `checklists/`.
Projects and their per-project state come from the desktop CLIs (`rworkspaces`, `wtman`, `pt`, `rv`,
`claudex`, `gg`); long-running work runs as detached jobs that report back over Web Push.

## Docs

- [docs/architecture.md](docs/architecture.md) — what the app does, code layout, the rules the
  code follows
- [docs/pwas.md](docs/pwas.md) — the three hostnames, routing rules, icons and manifests
- [docs/notifications.md](docs/notifications.md) — Web Push and why subscriptions die
- [docs/cli-integrations.md](docs/cli-integrations.md) — which CLI each feature calls, and where
  its docs are
- [docs/development.md](docs/development.md) — dev servers, build dirs, the production service
