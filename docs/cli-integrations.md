# CLI integrations

Each of these local CLIs owns a piece of state this app only displays. Shell out to the command,
map its JSON, and let its failures reach the user — reading its cache files or reimplementing its
lookups here puts two sources of truth on the same state.

## Sudo — `pt`

`src/lib/sudo.ts`, read by the Sudo tab and the project list.

- `pt sudo list --json`, with cwd set to the project — the targets of one project.
- `pt sudo list --all-projects --json` — the project-list sweep, ~120ms.
- `pt sudo <target> on|off|status` — does the SSH work.

`pt` owns the flag cache and the target-to-server mapping. When it fails, the Sudo tab shows the
error: reporting every target as disabled would be a lie about a security setting.

## Run — `rv`

`src/lib/run.ts`, read by the Run tab.

Transient systemd user units named `rvp-{projectId}-{cmd}.service`, with logs read via journalctl.
Note the asymmetry: starting is `rv run --mode systemd --project X --cmd Y`, while `stop`,
`restart` and `status` are subcommands of `rv run`.

## Desktop — `claudex`

`src/lib/desktop.ts`, read by the Desktop tab and the project list.

- `claudex desktop list <projectId>` — the Claude Code sessions on that project's workspaces. A
  window counts wherever the project's number prefixes the workspace name, so a session dragged
  from the code slot to the browser one stays on the project's list.
- `claudex desktop list --all-projects` — session counts per project, the project-list sweep
  (~120ms) behind the sparkle icon that promotes a project with a live session to Active.
- `claudex desktop screen <windowId>` — that window's current terminal content.
- `claudex desktop send <windowId> <text> --press-enter` — types into that window.

claudex owns the session registry, the kitty remote sockets and the i3 lookup, so this app only
ever handles window ids. The server has no DISPLAY, which is why nothing here talks to X itself.

The Desktop tab's "Remote" types `/remote-control <name>` into a session that is already running.
The `claude-remote` route is the other half of that: it spawns a new headless session instead.
