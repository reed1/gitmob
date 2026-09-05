# Architecture

## Layout

- `src/lib` — core logic (`git.ts`, `run.ts`, `projects.ts`, `files.ts`, `cli-jobs.ts`,
  `notifications.ts`, `recall.ts`)
- `src/app/api` — API routes (projects, cli jobs, pinboard, dooit todos)
- `src/app/app` — the GitMob PWA; `src/app/pinboard` — the pinboard PWA
- `src/components` — UI both PWAs draw (`PinboardNote.tsx`, the note card and its modals)
- `src/app/app/p/[projectId]/components` — project views (FileBrowser, ChangesView, CommitView,
  RunView, CLIView, DooitView, ClaudeView, PushView, SudoView, WtmanView)
- `src/proxy.ts` — host-based routing between the two PWAs, see [pwas.md](pwas.md)

## Projects

Projects are loaded from `~/.cache/rlocal/rofi-vscode/projects.generated.json`, plus the worktrees
open on the desktop — see [cli-integrations.md](cli-integrations.md). A worktree project carries
`canonicalId` and `worktreeName` as fields, published by rworkspaces: how an id encodes them is
rworkspaces' business, and nothing here parses one.

## Per-project state belongs to its CLI

Sudo, runs and desktop sessions belong to the CLI that owns them — `pt`, `rv`, `claudex`. Shell out
to those commands and surface their failures; never read their caches or redo their lookups here.
Contracts in [cli-integrations.md](cli-integrations.md).

## Detached jobs

CLI commands and deploys run as detached processes through `src/lib/cli-jobs.ts`, output to
`~/.local/share/gitmob/cli-jobs/{jobId}.log` — they outlive the request and the tab that started
them. A job with `notify` set pushes its result to every subscribed browser; see
[notifications.md](notifications.md).

## A resent request must not run twice

The phone's connection drops, and a browser that loses one mid-POST resends it byte for byte. The
resend happens below `fetch`, so the client never hears about it: what reaches the server is a
second `claudex kitty`, a second commit, a second push.

`src/lib/duplicate-guard.ts` catches those in `src/proxy.ts`, ahead of every `/api` route rather
than inside each handler — so an endpoint is covered by the shape of its request, and a new one is
guarded the day it is written. Non-GET only. It keeps the last five requests that got through, one
history for the whole API rather than one per URL, and answers 400 to a sixth that matches on
method, path, query and a hash of the body.

Nothing in that comparison separates a resend from a repeat that was meant, so it only holds for
two seconds: a connection that dies on the way out is resent at once, a second tap is slower. What
is genuinely meant to repeat faster than that is exempt by path, in `REPEATABLE` — Send Keys, which
is a keyboard, where pressing Down twice is one request sent twice. That is why a key press has its
own route, `/api/projects/[id]/desktop/keys`, instead of being another action on `/desktop`: the
exemption is read off the path, and `launch` on the endpoint next to it stays guarded.

Reading the body in the proxy costs the handler nothing: Next hands it the original request, not
the one the proxy drained.

## Parked work from the desktop

`claudex handoff` parks a briefing here instead of opening a window when `am-i-afk` says nobody is
at the desktop: `~/.local/share/gitmob/pending-handoffs`, one file per handoff, announced at the top
of the front page — above the project list, whichever project it names — to edit and launch from
there. The same trade gg makes when it sends a commit message to the Commit tab rather than a review
overlay nobody is sitting in front of. Contracts in [cli-integrations.md](cli-integrations.md).

## The Claude tab holds sessions of both kinds

Three views behind one tab, chosen by query parameter: the windows open at the desktop, `?recall=1`
searching the sessions that came before, and `?session=<id>` reading one of them back. Past sessions
live there rather than on a page of their own because they answer the same question the list does —
what is going on with this project — and a search scoped to the project's path needs no project
picker of its own. Each view is a `push`, so back walks them the way the screen view already does,
and the list stops polling while a search box or a transcript is up: a five-second refresh under an
input box is a keystroke lost every five seconds.

Resuming one is `claudex kitty` again, with the session id after `--`. Contract, and the refusal
when the conversation is already open in a window, in [cli-integrations.md](cli-integrations.md).

## One session modal

Starting a Claude session goes through the same modal as everything else sent to one: mode, opening
prompt and dictation are composed together, then launched. The tab's button only opens it. A
launcher that fired on its own click had nowhere to dictate into. There is exactly one such modal —
`src/app/app/NewSessionModal.tsx`, opened by both the Claude tab and the project card's menu on the
front page, sharing the dialog shell in `src/app/app/Modal.tsx`. A second copy of it on the front
page is what left half the app without a Speak button.

## Dictation

The Speak button in the Claude tab's modals dictates into the textarea, POSTing Opus straight to
`rvoice-stt.zerotail.r-mulyadi.com/transcribe` — not through `/api`. Caddy already answers CORS on
every portman route, so the audio takes one hop instead of two. It sends the project's **canonical**
id as `autocorrect`, which is what makes the server layer that project's phrase table over the
global one; a worktree id would match no table. `MediaRecorder` only offers Opus in WebM (Chrome) or
Ogg (Firefox), and needs a secure origin — the button is dead on the plain HTTP fronts. Contract in
[cli-integrations.md](cli-integrations.md).
