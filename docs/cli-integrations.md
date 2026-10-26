# CLI integrations

Each of these owns state this app only displays. Shell out, map the JSON and let failures reach the
user — never read their caches or redo their lookups here. What a command does is in the CLI's own
docs; how it is called is in the module. Paths under `rlocal/` are in `~/.dotfiles`.

| CLI                               | Used for                                      | Module                                                 | Docs                                        |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `rw-msg`                          | which projects and worktrees are open         | `src/lib/workspaces.ts`, `worktree.ts`                 | `rlocal/app/rworkspaces/CLAUDE.md`          |
| `wtman`                           | worktrees and branches                        | `src/lib/wtman.ts`                                     | `rlocal/app/wtman/CLAUDE.md`                |
| `rv pinboard`                     | project notes                                 | `src/lib/pinboard.ts`                                  | `rlocal/app/rofi-vscode/docs/pinboard.md`   |
| `pt`                              | push, deploy, sudo                            | `src/lib/push.ts`, `push-command.ts`, `sudo.ts`        | `rlocal/app/push_tool/CLAUDE.md`            |
| `rpass`                           | env checks                                    | `src/lib/env-check.ts`                                 | `rlocal/app/rpass/CLAUDE.md`                |
| `rv`                              | run commands, opening projects on the desktop | `src/lib/run.ts`, `desktop.ts`                         | `rlocal/app/rofi-vscode/CLAUDE.md`          |
| `claudex`                         | sessions, handoffs, models, usage             | `src/lib/desktop.ts`, `handoffs.ts`, `claude-usage.ts` | `rlocal/app/claudex/CLAUDE.md`              |
| `claudex ask`                     | Claude's questions while the user is away     | `src/lib/desktop.ts`                                   | `rlocal/app/claudex/claudex-ask`            |
| `recall`                          | past sessions                                 | `src/lib/recall.ts`                                    | https://github.com/zippoxer/recall          |
| `gg kitty-commit`                 | parked commits                                | `src/lib/pending-commits.ts`                           | `rlocal/app/gg/CLAUDE.md`                   |
| `gg hold`                         | the hold on autopush and auto-pull            | `src/lib/gg-hold.ts`                                   | `rlocal/app/gg/gg-hold`                     |
| `gh`                              | cloning a missing checkout                    | `src/lib/clone.ts`                                     | https://cli.github.com/manual/gh_repo_clone |
| `am-i-afk`                        | the AFK badge                                 | `src/lib/afk.ts`                                       | `rlocal/bin/am-i-afk`                       |
| `rbak`                            | "Move all to rbak" on the Files page          | `src/app/api/files/rbak/route.ts`                      | `rlocal/app/rbak/CLAUDE.md`                 |
| rvoice STT server                 | dictation, called from the browser            | `src/app/app/SpeakButton.tsx`                          | `rlocal/app/rvoice/stt_server/README.md`    |
| `claude-in-chrome`                | the agent's browser                           | `src/lib/browser.ts`                                   | `rlocal/bin/claude-in-chrome`               |
| `~/.config/git/diff-exclude.yaml` | files the review page shows without a diff    | `src/lib/diff-exclude.ts`                              | `rlocal/app/gg/CLAUDE.md`                   |
