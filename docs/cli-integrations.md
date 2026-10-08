# CLI integrations

Each of these CLIs owns state this app only displays. Shell out, map the JSON, and let failures
reach the user — never read their caches or redo their lookups here. What each command does and
returns is in the CLI's own docs, linked per section; this page only says what this app calls it
for. Paths under `rlocal/` are in `~/.dotfiles`.

## Worktrees — `rw-msg`

`src/lib/workspaces.ts`, `src/lib/worktree.ts` — project list.
Docs: `rlocal/app/rworkspaces/CLAUDE.md`, `rlocal/lib/python/rworktree/README.md`.

- `rw-msg get_state` — which projects and worktrees are open on the desktop, and their warnings.

## Worktrees on disk — `wtman`

`src/lib/wtman.ts` — Wtman tab, and the session modal's Worktree toggle.
Docs: `rlocal/app/wtman/CLAUDE.md`.

- `wtman status --json <repo>` — the worktree list.
- `wtman remotes --json <repo>` — the remote branches list.
- `wtman open <repo> --branch <branch>` — Open on a worktree; Check out on a remote branch.
- `wtman new <repo> <branch>` — Create, and a session in a new worktree.
- `wtman rebase [--abort] <repo> <branch>` — Rebase, Abort rebase.
- `wtman sync <repo> <branch>` — Merge sync.
- `wtman --interactive merge <repo> <branch> [--squash]` — Merge, Squash merge.
- `wtman --interactive remove <repo> <branch>` — Remove worktree and branch.

## Pinboard — `rv pinboard`

`src/lib/pinboard.ts` — Pinboard tab, `/pinboard` overview.
Docs: `rlocal/app/rofi-vscode/docs/pinboard.md`.

- `rv pinboard list|add|edit|delete --project-id <id> ...` — a project's notes.

## Push and sudo — `pt`

`src/lib/push.ts`, `src/lib/push-command.ts`, `src/lib/sudo.ts` — Push tab, Sudo tab, project list.
Docs: `rlocal/app/push_tool/CLAUDE.md`.

- `pt push config` — the Push tab's servers and targets.
- `pt push check [...] --json` — what a push would deploy, previewed as it is typed.
- `pt push [...]` — Deploy, as a detached CLI job.
- `pt sudo list [--all-projects] --json` — the Sudo tab, and the project list's sweep.
- `pt sudo <target> on|off|status` — the Sudo tab's toggles.

## Env checks — `rpass`

`src/lib/env-check.ts` — project list.
Docs: `rlocal/app/rpass/CLAUDE.md`.

- `rpass env check --json` — the orange key on a project card.

## Run and desktop projects — `rv`

`src/lib/run.ts`, `src/lib/desktop.ts` — Run tab, project menu, session launch.
Docs: `rlocal/app/rofi-vscode/CLAUDE.md`, `rlocal/app/rofi-vscode/docs/run.md`.

- `rv run start|stop|restart|status|logs -p <id> ...` — the Run tab.
- `rv open <id> [--focus-ide]` — Open on the project menu, and before every session launch.
- `rv close <id>` — Close on the project menu.

## Sessions — `claudex`

`src/lib/desktop.ts`, `src/lib/handoffs.ts`, `src/lib/claude-usage.ts` — Claude tab, project
list, front page handoffs, usage badge.
Docs: `rlocal/app/claudex/CLAUDE.md`.

- `claudex desktop list [<id>|--all]` — the session list; `--all` before a resume.
- `claudex desktop count` — the sparkle count on project cards.
- `claudex desktop screen|send|keys <windowId> ...` — a session's screen and keyboard.
- `claudex kitty --detach --submit --mode <mode> --directory <path> ...` — New session, resume,
  and handoff launch.
- `claudex models` — the custom model picker.
- `claudex purgatory send --window <id> --pid <pid>` — closing the session after a commit.
- `claudex gitlock release --repo <path>` — after a parked commit is accepted or rejected.
- `claudex usage show --json` — the usage badge and panel.
- Handoffs parked by `claudex handoff` in `~/.local/share/gitmob/pending-handoffs` — the front
  page's handoff list. Writer: `rlocal/app/claudex/claudex-handoff`.

## Past sessions — `recall`

`src/lib/recall.ts` — Search on the Claude tab.
Docs: https://github.com/zippoxer/recall.

- `recall search|list -s claude --cwd <path> ...` — search results and recent sessions.
- `recall read <sessionId>` — the transcript view.

## Commits — `gg kitty-commit`

`src/lib/pending-commits.ts` — Commit tab, front page.
Docs: `rlocal/app/gg/CLAUDE.md`. Writer: `rlocal/app/gg/gg-kitty-commit`.

- Parked commits in `~/.local/share/gitmob/pending-commits` — the message the Commit tab loads.

## Cloning — `gh`

`src/lib/clone.ts` — Clone on a project's menu.
Docs: https://cli.github.com/manual/gh_repo_clone.

- `gh repo clone <repo> <path>` — a checkout missing on this machine, as a detached CLI job.

## AFK — `am-i-afk`

`src/lib/afk.ts` — the badge on the front page.
Docs: `rlocal/bin/am-i-afk`.

- `am-i-afk` — whether the badge shows.
- touching `/tmp/rlocal/am-i-afk-forced.flag` — tapping the badge.

## Shared files — `rbak`

`src/app/api/files/rbak/route.ts` — "Move all to rbak" on the Files page.
Docs: `rlocal/app/rbak/CLAUDE.md`.

- `rbak move <paths...>` — the folder's entries, as one rbak entry.

## Dictation — rvoice STT server

`src/app/app/SpeakButton.tsx` — the Speak button; called from the browser, not the server.
Docs: `rlocal/app/rvoice/stt_server/README.md`.

- `POST https://rvoice-stt.zerotail.r-mulyadi.com/transcribe` (`file`, `language`,
  `autocorrect=<canonical id>`) — dictated text.

## The agent's browser — `claude-in-chrome`

`src/lib/browser.ts` — `/app/browser`.
Docs: `rlocal/bin/claude-in-chrome`.

- `claude-in-chrome cdp tabs|shot|click|scroll|text|key|navigate|back|forward|reload|open|close|activate`
  — the page's tabs, screenshots and input.

## Diff exclusions — `~/.config/git/diff-exclude.yaml`

`src/lib/diff-exclude.ts` — the review page.
Docs: `rlocal/app/gg/CLAUDE.md`.

- The globs whose files show as a row with no diff.
