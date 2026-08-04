# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.

## Tech Stack

React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git

## Structure

- `/src/lib` - Core logic (git.ts, run.ts, projects.ts, files.ts)
- `/src/app/api` - API routes (projects, cli jobs, dooit todos)
- `/src/app/[projectId]/components` - Project views (FileBrowser, ChangesView, ActionsView, RunView, CLIView, DooitView, DesktopView, SudoView)

## Development

```
pnpm dev && pnpm lint && pnpm format
pnpm build && pnpm start
```

## App Icons

All PNGs/ICO are generated from `android/icon.svg` via `android/gen-icons.sh`; edit the SVG and regenerate rather than editing them by hand. Do NOT put an SVG in `src/app/` — it crashes the Turbopack build.

## Key Patterns

- Projects loaded from `~/.cache/rlocal/rofi-vscode/projects.generated.json`
- CLI commands run as detached processes, output to `~/.local/share/gitmob/cli-jobs/{jobId}.log`
- Sudo state comes only from `pt sudo list --json` (per project, cwd set to it) and `pt sudo list --all-projects --json` (the project-list sweep, ~120ms). `pt` owns the cache and the target-to-server mapping — do not read its cache files here. Toggling is `pt sudo <target> on|off|status`, which does the SSH work. If `pt` fails, the Sudo tab shows the error rather than reporting targets as disabled.
- The Desktop tab shells out to `claudex desktop` for the Claude sessions on the project's code workspace: `list <projectId>`, `screen <windowId>`, `send <windowId> <text> --press-enter`. claudex owns the session registry, the kitty remote sockets and the i3 lookup — this app only knows window ids. The server has no DISPLAY, which is why nothing here talks to X itself. "Remote" types `/remote-control <name>` into a session that is already running, unlike the `claude-remote` route, which spawns a new headless one. The project list sweeps the same command with `list --all-projects` (~120ms) for the sparkle icon that promotes a project with a live session to Active.
- The Run tab shells out to the `rv` CLI to manage transient systemd user units (`rvp-{projectId}-{cmd}.service`, logs read via journalctl). Note the asymmetry: starting is `rv run --mode systemd --project X --cmd Y`, while `stop`/`restart`/`status` are subcommands of `rv run`.
