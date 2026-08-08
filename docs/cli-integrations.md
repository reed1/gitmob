# CLI integrations

Each of these local CLIs owns a piece of state this app only displays. Shell out to the command,
map its JSON, and let its failures reach the user — reading its cache files or reimplementing its
lookups here puts two sources of truth on the same state.

## Worktrees — `rw-msg`

`src/lib/workspaces.ts` and `src/lib/worktree.ts`, read by the project list.

- `rw-msg get_state` — the rworkspaces socket's view of the desktop. Each active project
  carries `worktree_name` (null on a main checkout) and `canonical_project_id` beside its id
  and path, so this app never takes an id apart to find out what it is looking at. This is
  also the only place a worktree project is announced: opening one on the desktop is what
  brings it into existence.

A worktree project has no config of its own. It runs on the config of the project it is a
checkout of, pointed at the path rworkspaces reports, with the `loc` url rewritten to carry
the worktree's name — the one derivation left in `src/lib/worktree.ts`, mirrored from
`rlocal/lib/python/rworktree` because this app cannot import it.

That makes `getProject` async: a configured id answers from the JSON alone, and anything else
costs one ~80ms socket round trip. Failure there is not swallowed — the project list reports
it rather than showing a desktop with nothing open on it.

The other CLIs speak these ids directly: `pt` reports one from a worktree cwd, `rv run`
resolves and reports one, and `claudex desktop|remote` treat a worktree as the project it is.
What is *not* per-worktree is sudo, env checks and monitored sites — those belong to the repo
and its servers, so the project list reads them under `canonicalId`, as do the dooit todos.

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

`src/lib/desktop.ts`, read by the Desktop section of the Claude tab and the project list.

- `claudex desktop list <projectId>` — the Claude Code sessions on that project's workspaces. A
  window counts wherever the project's number prefixes the workspace name, so a session dragged
  from the code slot to the browser one stays on the project's list. A worktree is a project of
  its own here and answers only to its own id.
- `claudex desktop count` — session counts per project, the project-list sweep (~120ms) behind
  the sparkle icon that promotes a project with a live session to Active.
- `claudex desktop screen <windowId>` — that window's current terminal content.
- `claudex desktop send <windowId> <text> --press-enter` — types into that window.
- `claudex desktop keys <windowId> <key>` — presses one named key in it, whatever is on screen.

claudex owns the session registry, the kitty remote sockets and the i3 lookup, so this app only
ever handles window ids. The server has no DISPLAY, which is why nothing here talks to X itself.

The Desktop section's "Remote" types `/remote-control <name>` into a session that already has a
window; "Exit" types `/exit` into one. `claudex remote` below is the other half: sessions that
never had one.

"Send Keys" is the keyboard for a session with nobody at its desktop. Its text box goes out as
`send --force --paste`: `--force` because the empty-prompt check `send` normally applies would
refuse the dialogs this exists to answer, and `--paste` so a multi-line box arrives as multiple
lines instead of submitting at every newline. Its key buttons are `keys`, listed in
`src/lib/desktop-keys.ts` — the client component cannot import `desktop.ts` for them, since that
one reaches for child_process.

## Remote — `claudex`

`src/lib/remote.ts`, read by the Remote section of the Claude tab and the project list.

- `claudex remote start <projectId> --permission-mode auto|default|bypassPermissions` — opens an
  environment and prints it, URL included, once `claude remote-control` has published one.
- `claudex remote list <projectId>` — the environments open on that project.
- `claudex remote count` — counts per project, merged into the desktop counts behind the sparkle.
- `claudex remote stop <unit>` — closes one.

Each environment is a transient systemd unit of its own, which is what keeps it independent of
this app: restarting gitmob no longer takes its Claude sessions down with it. Before that, the
route spawned `claude` as a detached child, and `detached` only escapes the process group —
never the cgroup, so every restart SIGTERMed the sessions along with the server.

There is no session file on either side. claudex reads the units back out of systemd and the URL
out of each unit's journal, so a session this app never hears about is still listed, and one it
started is still listed after it forgets.
