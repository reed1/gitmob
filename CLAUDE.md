# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.

## Tech Stack

React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git

## Structure

- `/src/lib` - Core logic (git.ts, run.ts, projects.ts, files.ts)
- `/src/app/api` - API routes (projects, cli jobs, dooit todos)
- `/src/app/[projectId]/components` - Project views (FileBrowser, ChangesView, ActionsView, RunView, CLIView, DooitView)

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
- The Run tab shells out to the `rv` CLI to manage transient systemd user units (`rvp-{projectId}-{cmd}.service`, logs read via journalctl). Note the asymmetry: starting is `rv run --mode systemd --project X --cmd Y`, while `stop`/`restart`/`status` are subcommands of `rv run`.
