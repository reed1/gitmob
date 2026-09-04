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
What is _not_ per-worktree is sudo, env checks and monitored sites — those belong to the repo
and its servers, so the project list reads them under `canonicalId`, as do the dooit todos.

## Worktrees on disk — `wtman`

`src/lib/wtman.ts`, read by the Wtman tab: every worktree of the project, the button that opens
one, and the box that creates one.

- `wtman list --json` — every worktree on this machine, each with its `~/wtman` directory name,
  the repo directory under it, and when it was last touched. There is no per-project call: the
  layout _is_ the index, so a worktree is this project's when that repo directory carries its
  name. Two projects checked out under the same folder name share worktrees as far as wtman is
  concerned, and nothing here holds a second opinion about that.
- `wtman open <repoPath> --branch <branch>` — opens one, and creates the branch and the
  checkout first when they are not there. Both buttons on the tab are this one command. For a
  worktree that already exists it is nothing but wtman's hand-off to `rofi-vscode open`.

The branch that goes out is the repo's answer, never the directory name. `wtman list` reports the
directory, which is the branch with everything git allows and a path does not folded away —
`refactor/api-endpoint-registry` lives in `refactor_api-endpoint-registry` — and `wtman open`
given that folded name would find no such branch and **create** one. So each row is joined
against `git worktree list --porcelain` in the main checkout for the branch it is really on.

That join is also what "living" means, which is the whole of what this tab lists: a directory
left behind by a worktree git no longer knows about is dropped, and a branch with no worktree
never appears at all — including one Create makes a worktree for, which stops being invisible
by acquiring one.

No `--interactive`, which is the whole contract with wtman from here. wtman tells its prompts
apart by what it may assume of somebody who is not there: an **offer** — carrying the main
checkout's uncommitted changes into the new branch — is declined, and a **confirmation** —
everything `remove` and `merge` ask — is refused outright, which is why neither is on the tab
and why nothing here has to pass a flag saying so. `--yes` used to mean "take every default",
which read like consent to whatever wtman felt like doing; the offers were what it was actually
answering, so they say no for themselves now.

The one thing that is not simply an offer declined is which branch a new one forks off. wtman
forks off main here, not off whatever the main checkout is parked on: declining the offer would
mean HEAD, and a checkout's current branch is invisible to whoever is tapping Create from a
phone, so it is not a base anybody chose.

The request waits for that open, and should: nothing about it needs detaching. `launch-on-left`
starts Cursor and the project terminal through i3's own `exec`, so they belong to i3 rather than
to this server, and `rofi-vscode open` returns once they are launched. Waiting is what turns a
failed open into an error the tab can show — the few seconds it costs buy the difference between
an open that worked and one that went nowhere.

Opening a worktree is what announces it to rworkspaces, and so what gives it a project of its
own here — which is why the row for one already open links to that page instead of opening it
again. Whether it is open comes from the same `rw-msg get_state` the project list reads, on the
same round trip: a stale "not open" would invite opening a worktree twice.

## Pinboard — `rv pinboard`

`src/lib/pinboard.ts`, read and written by the Pinboard tab and read by the `/pinboard`
overview.

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

There is no all-projects call: the `/pinboard` overview gets its 50 newest notes by running
`list` once per configured project, eight at a time, and sorting what comes back. `rv pinboard
recents` looks close but answers with one line of prose per board, not notes.

## Push — `pt`

`src/lib/push.ts` and `src/lib/push-command.ts`, read by the Push tab.

- `pt push config`, with cwd set to the project — the pick-list: the servers with their ssh
  hosts, the targets pt discovers from the `push-*` tags in the project's ansible playbooks, the
  `push_scope` keys, and which servers a push with none named would go to. A word rather than a
  `--json` flag, since it answers a different question than a push does.
- `pt push check [server...] [scope N] --json`, as the scope is typed — the same push, asked
  rather than run: the servers and targets it resolves to, and the changed files with the target
  each one picked. The tab highlights the targets from that answer, so what is lit is pt's own,
  never a second reading of `push_scope` here.
- `pt push [server...] [target...] [scope N]` — the deploy: `git push`, then
  `ansible-playbook` limited to those servers with the matching tags.

`check` is a mode of pt's rather than a flag on the push, which is what lets the tab ask on every
keystroke: there is no `-n` that a mistake here could drop and turn a question into a deploy to
production. It is also why the tab has no confirmation step — the answer is already on screen
before Deploy is tapped, so a second screen saying the same thing bought nothing.

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
- `pt sudo list --all-projects --json` — the project-list sweep, one call to abubot for all of them.
- `pt sudo <target> on|off|status` — does the SSH work.

`pt` owns the target-to-server mapping; the flags themselves are abubot's, which pt reads over
HTTP. When it fails, the Sudo tab shows the error: reporting every target as disabled would be
a lie about a security setting.

## Run — `rv`

`src/lib/run.ts`, read by the Run tab.

Transient systemd user units named `rvp-{projectId}-{cmd}.service`, with logs read via journalctl.
Every verb is a subcommand of `rv run` — `start`, `stop`, `restart`, `status`, `logs` — with the
project always `-p` and the command the positional after the verb: `rv run start --mode systemd
-p X Y`, `rv run stop -p X Y`. Status is scoped to one project by default (the cwd's, which for
this server is gitmob), so the project-list sweep passes `--all` and buckets the rows itself,
while the Run tab asks for its one project with `-p`. A worktree id (`krisna::feat-x`) is a
project id like any other to `-p`: rv splits it and runs the canonical project's config against
the worktree's checkout.

`rv open <projectId> --focus-ide` is the other call, made by the session launch below: it switches
the desktop to the project and opens its workspaces when they were closed. Whether the project was
already open is rv's question to answer, so this app calls it unconditionally. `--focus-ide` leaves
the IDE focused, which is what decides where the window `claudex kitty` spawns next lands.

## Desktop — `claudex`

`src/lib/desktop.ts`, read by the Desktop section of the Claude tab and the project list.

- `claudex desktop list <projectId>` — the Claude Code sessions on that project's workspaces. A
  window counts wherever the project's number prefixes the workspace name, so a session dragged
  from the code slot to the browser one stays on the project's list. A worktree is a project of
  its own here and answers only to its own id. Each session carries a `context` — the tokens in
  its context window, the window's size, and the percentage — or null.
- `claudex desktop list --all` — the same, for every project open on the desktop. Asked once,
  before a resume: see the recall section below.
- `claudex desktop count` — session counts per project, the project-list sweep (~120ms) behind
  the sparkle icon that promotes a project with a live session to Active.
- `claudex desktop screen <windowId>` — that window's current terminal content.
- `claudex desktop send <windowId> <text> --press-enter` — types into that window.
- `claudex desktop keys <windowId> <key>` — presses one named key in it, whatever is on screen.
- `claudex kitty --detach --press-enter --mode <mode> --directory <path>
--remote-control <name> "<prompt>"` — opens a new session.
- `claudex purgatory send --window <windowId>` — ends a session the recoverable way: the
  window is parked on claudex's own workspace and SIGTERMed 30s later, until `claudex
purgatory cancel` takes it back. The only call here that closes a session rather than
  reading or typing into one, and the only one outside `claudex desktop`. No pid is passed:
  claudex finds the process behind the window when it acts, which beats a pid noted hours
  earlier. Made by the Commit tab, below, not the Desktop section.

claudex owns the session registry, the kitty remote sockets and the i3 lookup, so this app only
ever handles window ids and never talks to X itself.

"New" is those last two commands in order: `rv open` first, so the desktop is on the project and
the window i3 spawns lands on one of its workspaces, then `claudex kitty`. `--detach` hands that
window to i3, so it outlives a gitmob restart the way a child process would not. The mode picker
is `claudex`'s own — `auto`, `edit`, `yolo` — not a `claude --permission-mode` value. The session
is named after the project folder, which `--remote-control <name>` passes to `claude` itself; this
app never sees the URL that publishes, because the Claude app lists the session by that name.

Both session menus — the list's, and the screen view's where they sit below Send Keys behind a
separator — end in the common commands from `src/lib/desktop-keys.ts`, each typed into the
session with `--press-enter`. It is a plain array, so the list grows by editing it. There is no
button for `/remote-control`: `remoteControlAtStartup` is on in user settings, so every session
is connected by the time it appears here, and the command would only raise a dialog the session
then sits behind until someone sends Esc.

"Send Keys" is the keyboard for a session with nobody at its desktop. Its text box goes out as
`send --force --paste`: `--force` because the empty-prompt check `send` normally applies would
refuse the dialogs this exists to answer, and `--paste` so a multi-line box arrives as multiple
lines instead of submitting at every newline. Its key buttons are `keys`, listed in
`src/lib/desktop-keys.ts` — the client component cannot import `desktop.ts` for them, since that
one reaches for child_process. They post to `/desktop/keys` rather than to `/desktop`, so the
duplicate guard can let a repeated press through by path; see [architecture.md](architecture.md). The launch modes live in `src/lib/desktop-modes.ts` for the same
reason.

The context on a session is Claude Code's own count, not one this app works out. Claude Code
reports it in the statusline payload, `claudex usage store` records it under the session id on
every render, and `list` joins it in — so `list` costs what it always did (~0.2s, all of it the
kitty round trip it already made per window) and the sessions are never probed. The alternatives
were both worse: a transcript carries token counts but not the window they are measured against,
so a 1M session reads as 169% of a 200k one, and the number on a session's screen is a regex over
rendered terminal text that a dialog covers up. A session that has not rendered a statusline yet
has no context, which the Desktop section says rather than guessing at.

There is no session file on either side: every window on the list comes from claudex's own lookup,
so a session this app never started is still listed, and one it started is still listed after it
forgets. The window id is the whole handle — claudex reaches a window through the kitty socket the
window itself carries, not through its session registry — so a session resumed into a window drives
the same as a fresh one. `session_id` and `cwd` come from that registry and are the two fields that
can be null on a live session; nothing here may treat a null as a session it cannot reach.

## Past sessions — `recall`

`src/lib/recall.ts`, read by the Search view on the Claude tab.

`recall` indexes every Claude Code transcript on this machine and answers questions about them
in JSON — the TUI it opens with is one caller of its own search, not the only one, so nothing
here scrapes a terminal or reads the JSONL under `~/.claude`.

- `recall search <query> -s claude --cwd <path> -l 5000 -C 1` — the matches, each with its
  session id, the session's cwd and timestamp, and the messages that matched with one either
  side. Trimmed to 25 here.
- `recall list -s claude --cwd <path> -l 5000` — the recent sessions, which is what an empty
  search box shows. It carries no message text at all, so each of the ten kept is then `read`
  for the message its session opened with. That is a subprocess per row, and it is what holds
  the list to ten: everything older is behind the search box, which reaches any distance back
  for one call.
- `recall read <sessionId>` — the whole conversation, user and assistant turns with the tool
  calls already collapsed out. This is the transcript view.

`-s claude` throughout: recall also indexes Codex, Droid and OpenCode, and none of those is a
session `claudex kitty` can reopen. `--cwd` is an exact match, which is recall's own idea of a
folder scope — a session started in a subdirectory of the project belongs to that subdirectory,
and widening it here would be this app holding a second opinion about whose sessions are whose.

`-l` is a lookback, not a page size: it caps what recall considers **before** `--cwd` narrows
it, so a limit of ten answers with however many of the newest ten sessions on this machine
happen to be the project's — six, on the first project this was tried against. It is set past
the whole index instead, and the rows are trimmed here. That costs nothing: the index scan is
the work, so `-l 5000` and `-l 10` both come back in about 0.2s, and a common word over a busy
project is under half a megabyte of JSON. A project whose sessions all sit further back than
this many would drop out of its own search, which is the one thing this number can still get
wrong.

A warm search answers in ~0.2s. The first call after a run of new sessions indexes them before
answering, which is what the 60s budget is for; the progress it prints goes to stderr, so stdout
is the JSON alone.

Resuming is the same two commands as "New" — `rv open`, then `claudex kitty` — with
`-- --resume <sessionId>` on the end, in yolo mode with no prompt, titled `Claude (recall)`.
Everything after `--` belongs to `claude` rather than to claudex, and the detached relaunch
carries it through i3. `claude --resume` only finds a session under the directory it was held
in, which the project-scoped `--cwd` above is what guarantees.

`claudex desktop list --all` goes first. A conversation already open in a window is one no
second `claude --resume` may be pointed at, so that one is refused with a 409 and the window id
that has it — the browser lands on that window's screen instead of opening a rival to it. A live
session can report a null id, and one of those matches nothing here: the check covers every
session claudex can name, which is not quite the same as all of them.

## Handoffs — parked by `claudex handoff`

`src/lib/handoffs.ts`, read by the front page: the waiting handoffs lead it, above the project
list and outside it — the project cards say nothing about them, because a section announcing
them a screen-width above would only be saying it twice.

A handoff is a briefing one Claude Code session writes for another to run alone. At the desktop
`claudex handoff` opens that session itself. Away from it — `am-i-afk` again — a window opening
on an empty desktop is a session nobody meets for hours, so the briefing is parked here instead,
one file per handoff under `~/.local/share/gitmob/pending-handoffs`:

```json
{
  "project_id": "gitmob",
  "directory": "/home/reed/proj/gitmob",
  "prompt": "…",
  "timestamp": "…"
}
```

This is a handover, not a cache read behind claudex's back: claudex writes the file and never
looks at it again, and this app is the only reader — it lists them all through `/api/handoffs`,
and deletes the file once the session it describes has been launched, or dropped. claudex
resolves `project_id` (worktrees included) before writing, so nothing here maps a path back to a
project; the launch reads the project's checkout back out of it for the session name. The file is
renamed into place from a dotfile beside it, because the page reads the directory while claudex
writes to it.

They belong on the front page rather than on the project they name: a briefing waiting for a
session to be started is an announcement, and a tab nobody opens announces nothing.

Launching one is the same two commands as "New", with the handoff's own directory and
`--title "Claude (handoff)"` — the title claudex-handoff would have given the window it opened
itself. Editing the prompt first is the point of parking it: the text is the browser's, the
directory is not, so a launch takes the prompt from the request and everything else from the
file. A launch that fails leaves the handoff parked, to fix and try again.

The prompt is parked whole: nothing trims it on the way in. claudex-kitty caps initial text at
5000 bytes, the most a session's input box takes, and rejects anything over — a briefing that
long fails the launch and stays parked, where the box that edits it is the way to cut it down.

## Commit messages — parked by `gg kitty-commit`

`src/app/api/projects/[id]/pending-message/route.ts`, read by the Commit tab.

`gg c` generates a commit message and puts it in front of the user to accept. At the desktop
that is a kitty overlay over the session that asked; away from it — `am-i-afk` again — the
message is parked here instead, one file per repo under
`~/.local/share/gitmob/pending-messages`, named after the base64url of its path:

```json
{
  "repo_path": "/home/reed/proj/gitmob",
  "message": "…",
  "timestamp": "…",
  "source": "remote",
  "window_id": "12582915",
  "close_session": true
}
```

The Commit tab loads it into the message boxes, badged with `source`, and the Clear button
drops it. Committing drops it too — and both hand back the repo's commit lock, which the
session that sent the message holds until the commit lands: `claudex gitlock release --repo`.

`window_id` is the kitty window of the Claude Code session that asked, and the whole of what
this app needs to end it: `claudex purgatory send --window` above. It is what turns the
overlay's `t` toggle into a checkbox here — "Close the Claude Code session after committing",
defaulting to `close_session`, which gg sets from the same ctrl+n no-close flag that sets the
toggle's default at the desktop. Both fields are null and false where there was no session to
close: a `gg c` typed into a plain terminal parks a message like any other.

The checkbox only fires on a commit. Clearing the message means the work is not done, so the
session stays. The delete goes first either way — a session parked while still holding the
commit lock would take it to the grave.

## AFK — `am-i-afk`

`src/lib/afk.ts`, read by the badge left of the refresh button on the front page.

- `am-i-afk` — the away verdict, exit 0 away and 1 here. It rides along on `/api/projects` as
  `away`, one more sweep in that route's `Promise.all`, null when it cannot be asked at all.
- Touching `/tmp/rlocal/am-i-afk-forced.flag` forces that verdict away. `POST /api/afk` is the
  badge tapping it.

`am-i-afk` draws the away line for everything that has to choose between the screen in front of
the user and somewhere they will find it later — a parked handoff, gg's commit message. This app
is the somewhere, so it is the one worth saying which way the line falls: while the badge shows,
the next handoff opens a window on the desktop instead of landing here.

The badge appears only on "here", the answer that is surprising on a phone. Tapping it covers the
case the idle timer cannot: the user got up mid-keystroke and is holding the phone, with 180s to
go before the desktop notices. The flag lasts exactly that long, so it expires into the idle
timeout rather than needing to be cleared — which is why this app only ever touches it, and never
reads it back to decide anything. A tap that succeeded is away by definition, so the badge hides
itself without asking again.

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

## Dictation — the rvoice STT server

`src/app/app/p/[projectId]/components/SpeakButton.tsx`, in the Claude tab's Send-text and
New-session modals.

The one integration on this page the **browser** makes itself rather than the server: a
`multipart/form-data` POST to `https://rvoice-stt.zerotail.r-mulyadi.com/transcribe`, answered by
`rlocal/app/rvoice/stt_server/main.py` on rdzero.

- `file` — Opus, in whatever container `MediaRecorder` gives: WebM on Chrome, Ogg on Firefox. The
  server sniffs both and hands them to FFmpeg. 32 kbps, which is what rvoice sends over the tailnet
  and is transparent to Parakeet.
- `language=en` — Parakeet on the GPU. Every other value routes to Whisper, which loads on demand.
- `autocorrect=<canonical project id>` — the server layers that project's phrase table over the
  global one before returning. The **canonical** id is the contract: the tables are keyed by
  rofi-vscode project, so a worktree id matches none of them. An id with no entries of its own is
  not an error, it just leaves the global table.

It answers `{"text": ...}`, or `{"error": ...}` with a 400 — the shape `apiFetch` already reports,
which is why the call goes through it despite being cross-origin.

Going direct rather than through `/api` costs nothing and saves a hop: portman puts CORS headers on
every Caddy route it makes, so every front already answers a cross-origin POST. What it does cost
is the secure-origin requirement — `navigator.mediaDevices` does not exist on `.loc` or
`dev.gitmob.loc`, so the button only works on an HTTPS front.
