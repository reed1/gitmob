# CLAUDE.md

Next.js web interface for managing Git operations across multiple projects from mobile devices.

## Tech Stack

React 19, Next.js 16, TypeScript, Tailwind CSS 4, simple-git

## Structure

- `/src/lib` - Core logic (git.ts, process.ts, projects.ts, files.ts)
- `/src/app/api` - API routes (projects, cli jobs, dooit todos)
- `/src/app/[projectId]/components` - Project views (FileBrowser, ChangesView, ActionsView, ProcessView, CLIView, DooitView)

## Development

```
npm run dev && npm run lint && npm run format
npm run build && npm start
```

## Key Patterns

- Projects loaded from `~/.cache/rlocal/rofi-vscode/projects.generated.json`
- CLI commands run as detached processes, output to `~/.local/share/gitmob/cli-jobs/{jobId}.log`
- Process management via tmux sessions (`rvp-{projectId}`) and `rv` CLI tool
