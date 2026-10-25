# Architecture

## What it does

**GitMob** (`/app`), for each project:

- Browse files, review changes, commit, push and deploy
- Start, stop and watch the project's run commands; toggle sudo
- Run CLI commands as detached jobs that notify when they finish
- Start, watch, type into and resume Claude and Codex sessions; search past ones
- Manage worktrees, todos and pinboard notes
- See when `gg hold` is holding its autopush and auto-pull, and release it

and across projects, from the front page:

- See every project's state at a glance; scan closed ones for uncommitted work
- Read and launch handoffs, and accept commits, parked from the desktop
- Keep a scratchpad on the device
- Drive the agent's Chrome by hand (`/app/browser`)

**Pinboard** (`/pinboard`) — every project's notes on one page.
**Checklist** (`/checklist`) — lists of what to bring.

## Layout

- `src/lib` — core logic, one module per concern
- `src/app/api` — API routes
- `src/app/app`, `src/app/pinboard`, `src/app/checklist` — the three PWAs; a project's tabs are in
  `src/app/app/p/[projectId]/components`
- `src/components` — UI shared across the PWAs
- `src/proxy.ts` — host routing between the PWAs and the guard against resent requests

## Rules

- Per-project state belongs to the CLI that owns it. Shell out and surface its failures; never read
  its caches or redo its lookups here. See [cli-integrations.md](cli-integrations.md).
- The project list is reopened all day: keep process spawns off the per-project path and the
  network off the request path (`src/lib/background-cache.ts`).
- Work that outlives a request runs as a detached job (`src/lib/cli-jobs.ts`). A tab's job has
  one id per project (`cli-`, `push-`, `clone-`), so a reload finds it again and the next run
  replaces its log rather than adding one.
- A project id is plain text everywhere — worktree ids hold `::` — and is encoded only where a
  URL is built, through `src/lib/project-paths.ts`. The `[projectId]` pages decode the route
  param on read.
- Every way into a new session goes through the one session modal (`src/app/app/NewSessionModal.tsx`).
- A diff opened from a list is laid over that list, keyed by the URL, rather than navigated to:
  the list stays mounted, so back finds it scrolled and expanded as it was. Both the Commit tab's
  cards and the Changes tab open `ReviewScreen` this way, each passing its own actions.
