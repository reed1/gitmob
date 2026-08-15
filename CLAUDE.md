# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.

## Tech Stack

React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git

## Structure

- `/src/lib` - Core logic (git.ts, run.ts, projects.ts, files.ts)
- `/src/app/api` - API routes (projects, cli jobs, dooit todos)
- `/src/app/[projectId]/components` - Project views (FileBrowser, ChangesView, CommitView, RunView, CLIView, DooitView, ClaudeView, SudoView)

## Development

```
pnpm dev && pnpm lint && pnpm format
pnpm build && pnpm start
```

## App Icons

All PNGs/ICO are generated from `assets/icon.svg` via `assets/gen-icons.sh`; edit the SVG and regenerate rather than editing them by hand. Do NOT put an SVG in `src/app/` — it crashes the Turbopack build.

## Key Patterns

- Projects loaded from `~/.cache/rlocal/rofi-vscode/projects.generated.json`, plus the
  worktrees open on the desktop — see [docs/cli-integrations.md](docs/cli-integrations.md).
  A worktree project carries `canonicalId` and `worktreeName` as fields, published by
  rworkspaces: how an id encodes them is rworkspaces' business, and nothing here parses one.
- CLI commands run as detached processes, output to `~/.local/share/gitmob/cli-jobs/{jobId}.log`
- Per-project state (sudo, runs, desktop sessions) belongs to the CLI that owns it — `pt`, `rv`, `claudex`. Shell out to those commands and surface their failures; never read their caches or redo their lookups here. Contracts in [docs/cli-integrations.md](docs/cli-integrations.md).
