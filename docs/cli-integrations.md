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
- The same reply carries `warnings` — project id, warning id, message — which the project list
  paints as a red card, as polybar paints them a red project name and a 🚨. What raises one
  and when it clears is rworkspaces' business; this app only shows what it is holding. They
  ride on this call rather than a second one, and the map sits beside `projects` rather than
  inside each: a warning outlives its workspaces being closed, and this app lists projects that
  are not open at all. Keyed by the id it was raised against, so a worktree has its own.

A worktree project has no config of its own. It runs on the config of the project it is a
checkout of, pointed at the path rworkspaces reports, with the `loc` url rewritten to carry
the worktree's name — the one derivation left in `src/lib/worktree.ts`, mirrored from
`rlocal/lib/python/rworktree` because this app cannot import it.

That makes `getProject` async: a configured id answers from the JSON alone, and anything else
costs one ~80ms socket round trip. Failure there is not swallowed — the project list reports
it rather than showing a desktop with nothing open on it.

The other CLIs speak these ids directly: `pt` reports one from a worktree cwd, `rv run`
resolves and reports one, `rv open` opens one, and `claudex desktop` treats a worktree as the
project it is.
What is *not* per-worktree is sudo, env checks and monitored sites — those belong to the repo
and its servers, so the project list reads them under `canonicalId`, as do the dooit todos.

## Pinboard — `rv pinboard`

`src/lib/pinboard.ts`, read and written by the Pinboard tab.

- `rv pinboard list --project-id <projectId> --json` — the notes on that project's board.
- `rv pinboard add --project-id <projectId> <text>` — adds one.
- `rv pinboard edit --project-id <projectId> <noteId> <text>` — replaces its text.
- `rv pinboard delete --project-id <projectId> <noteId>` — removes it.

The project is always a flag: rv defaults it to whatever project the working directory sits
in, which for a server running out of gitmob's own checkout is never the one we mean.

Nothing here touches the YAML. The board files are a repo of their own —
`reed1/pinboard-data`, rebased hourly by `pinboard-pull.timer` — and `rv pinboard` commits
each write, so a note added from a phone survives that pull instead of riding on autostash.
Underneath, rv hands every write to the `pinboard` CLI, which owns what a note is: the next
id, where it lands on the canvas, its colour from the configured palette, and its timestamps.

That makes an add cost a subprocess rather than a file write, which is the price of not
being a second writer of a format the desktop app already owns. A board the desktop has open
needs no telling: the app watches its file and reloads.

Notes are keyed by the canonical id — they belong to the repo, as the dooit todos do.

## Push — `pt`

`src/lib/push.ts` and `src/lib/push-command.ts`, read by the Push tab.

- `pt push config`, with cwd set to the project — the pick-list: the servers with their ssh
  hosts, the targets pt discovers from the `push-*` tags in the project's ansible playbooks, the
  `push_scope` keys, and which servers a push with none named would go to. A word rather than a
  `--json` flag, since it answers a different question than a push does.
- `pt push [server...] [target...] [scope N]` — the deploy: `git push`, then
  `ansible-playbook` limited to those servers with the matching tags.

Nothing here reads the ansible tree or repeats pt's default-server rule. The argument line is the
only thing this app builds, and it lives in `push-command.ts` — pure, so the tab can preview the
exact command before running it and the route can check a selection against the same pick-list.

A deploy outlives the request that started it, so it goes through the CLI job runner
(`src/lib/cli-jobs.ts`) as a detached process logging to
`~/.local/share/gitmob/cli-jobs/push-{projectId}.log`. The tab can be left and come back to a
push still running. One job id per project means a new push replaces the last one's log, and a
push already running is refused rather than raced.

The tab shows nothing about sudo. Passwordless sudo is the Sudo tab's subject and a push does
not depend on it — the playbooks carry their own `ansible_become_pass` — so putting it on the
server chips only suggested a prerequisite that is not one.

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

`rv open <projectId> --focus-ide` is the other call, made by the session launch below: it switches
the desktop to the project and opens its workspaces when they were closed. Whether the project was
already open is rv's question to answer, so this app calls it unconditionally. `--focus-ide` leaves
the IDE focused, which is what decides where the window `claudex kitty` spawns next lands.

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
- `claudex kitty --detach --press-enter --mode <mode> --directory <path> "/remote-control <name>"`
  — opens a new session.

claudex owns the session registry, the kitty remote sockets and the i3 lookup, so this app only
ever handles window ids and never talks to X itself.

"New" is those last two commands in order: `rv open` first, so the desktop is on the project and
the window i3 spawns lands on one of its workspaces, then `claudex kitty`. `--detach` hands that
window to i3, so it outlives a gitmob restart the way a child process would not. The mode picker
is `claudex`'s own — `auto`, `edit`, `yolo` — not a `claude --permission-mode` value. The session
is named after the project folder and submits `/remote-control <name>` on startup; this app never
sees the URL that publishes, because the Claude app lists the session by that name.

The Desktop section's "Remote" types `/remote-control <name>` into a session that already has a
window; "Exit" types `/exit` into one.

"Send Keys" is the keyboard for a session with nobody at its desktop. Its text box goes out as
`send --force --paste`: `--force` because the empty-prompt check `send` normally applies would
refuse the dialogs this exists to answer, and `--paste` so a multi-line box arrives as multiple
lines instead of submitting at every newline. Its key buttons are `keys`, listed in
`src/lib/desktop-keys.ts` — the client component cannot import `desktop.ts` for them, since that
one reaches for child_process. The launch modes live in `src/lib/desktop-modes.ts` for the same
reason.

There is no session file on either side: every window on the list comes from claudex's own lookup,
so a session this app never started is still listed, and one it started is still listed after it
forgets. The window id is the whole handle — claudex reaches a window through the kitty socket the
window itself carries, not through its session registry — so a session resumed into a window drives
the same as a fresh one. `session_id` and `cwd` come from that registry and are the two fields that
can be null on a live session; nothing here may treat a null as a session it cannot reach.

## Usage — `claudex usage`

`src/lib/claude-usage.ts`, read by the dollar badge beside the GitMob title.

- `claudex usage show --json` — today's Claude Code API spend plus the latest rate-limit windows
  (`five_hour`, `seven_day`), each with its used percentage and reset time.

The statusline feeds that ledger and claudex keeps the day totals and the rate-limit snapshot, so
this app asks it for them rather than reading its caches and redoing the date check. It rides along
on `/api/projects` as `claudeUsage` — one more sweep in that route's `Promise.all`, null when
claudex cannot answer, and the badge simply does not render then.

Clicking the badge opens `src/app/UsagePanel.tsx` under the title: a bar per window with its
percentage and how long until it resets. The windows come from one snapshot claudex captured when
Claude Code last reported, so the panel says how old that reading is.
