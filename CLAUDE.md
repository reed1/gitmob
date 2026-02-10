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

## App Icons

Source SVG: `src/app/icon.svg` — all PNGs are generated from this via `rsvg-convert`.

- `src/app/icon.png` (180x180) - Next.js auto-discovered web icon; Android app symlinks to this
- `src/app/apple-icon.png` (180x180) - Next.js auto-discovered Apple touch icon
- `src/app/favicon.ico` (16+32) - Next.js auto-discovered browser tab icon
- `public/icon-192.png` (192x192) - PWA manifest (`src/app/manifest.json`)
- `public/icon-512.png` (512x512) - PWA manifest (`src/app/manifest.json`)
- `android/icon.png` - Symlink → `../src/app/icon.png`

## Key Patterns

- Projects loaded from `~/.cache/rlocal/rofi-vscode/projects.generated.json`
- CLI commands run as detached processes, output to `~/.local/share/gitmob/cli-jobs/{jobId}.log`
- Process management via tmux sessions (`rvp-{projectId}`) and `rv` CLI tool
