# skills-v2tm research lane — saved from the lane's final message (2026-11-02)

Read-only. Claude Code `2.1.316`. "T" = the plugin-authoring skill's `types/claude-code.d.ts` for this build; "REF" = its `reference.md`.

## 1. Directory listing in the mod API
- `$.fs.list` exists. T:3367-3379: "Lists a directory by name: `{ name, kind, size, mtimeMs, isLink }` per entry, each entry as it stands." `list: (path?: string) => Promise<FsEntry[]>`. FsEntry (T:5113ff): `kind: 'file' | 'dir' | 'other'`; `mtimeMs` "for a file, as `$.fs.stat` spells it; 0 for a directory, a link or any other kind"; "The listing reads a regular file's size and time in its one call and looks no other entry up." One `fs.list(<root>/.shawarma)` gives every marker's name and mtime. The test kit can fake it: `'fs.list': { path: string }` (T:7296).
- No glob call. `$.fs.ancestors` (T:3438-3458) walks up for named `.md` files only.
- Unverified: `fs.list` on a missing folder (undocumented; `stat` and `read` "reject when missing").
- `$.process.run` (T:3608-3632): "Commands on the host, run as the user the session runs as. CLI only." "Runs a command on the host by its argument vector (no shell)… Git runs with repo hooks off." Options `{ cwd, env, stdin, timeoutMs }` (30 s default, 10 min max), 4194304 bytes per stream. No sandbox or permission prompt named. Other plugins can deny it via the `process.run` event (T:7383). Desktop behaviour untested.
- Shell timings (Python subprocess, 10 runs, main checkout; `$.process.run` cost NOT measured): `git worktree list --porcelain` 8.9 ms median / 10.3 max; `git rev-parse --path-format=absolute --git-common-dir --show-toplevel` 7.4 / 7.8; `ls -a .shawarma` 3.1 / 3.5.
- REF:204: "A hook runs inside one dispatch with a budget of its own time (a `next` or `$` call in flight does not count…)".

## 2. Main checkout from a linked worktree (executed, git 2.48.1)
- Main checkout: `--show-toplevel` → `/Users/jonathan/Documents/strandic-skills`; `--git-common-dir` → `.git`; with `--path-format=absolute` → `/Users/jonathan/Documents/strandic-skills/.git`.
- Worktree `.worktrees/plan-handoff`: `--show-toplevel` → the worktree itself; `--git-common-dir` → `/Users/jonathan/Documents/strandic-skills/.git`; `--git-dir` → `…/.git/worktrees/plan-handoff`. Main checkout = parent of the absolute common dir (non-bare, no `--separate-git-dir`; the latter untested).
- `git worktree list --porcelain`: "The main worktree is listed first, followed by each of the linked worktrees." Records may carry `bare`, `detached`, `locked`, `prunable`.
- Sibling worktrees: incurio-frontend lists 4 worktrees, three of them sibling folders (`…-t5b2`, `…-wb64`, `…-wb64-base` detached). A scan of `<main>/.worktrees/*` misses them; `git worktree list` finds them.
- Untested shortcut: `$.session.repo()` (T:2872-2879), `SessionRepo.root` (T:12238): "the main working tree's for a worktree."
- `$.session.root()` does not follow a shell `cd`; `$.session.cwd()` follows it one call late (pi0y L8a).
- Today's `MARKER_TAIL = '/.shawarma/active'` never matches `.shawarma/active-<ticket>`: the mod draws nothing with a 0.9 skill (README:22).

## 3. Several rows in the AbovePrompt band
- T:10922-10930: one tree per band ("A hook draws a tree, or passes; one instance"); several rows = a column `Box` with one `Text` per row.
- T:10943-10966: `maxRows` caps the slot (half the terminal in fullscreen); a taller tree scrolls in `scroll.bodyRows` (`maxRows` less the `n more` row). The engine never cuts a tree.
- `bodyColumns` is per row; `rowText` already fits a row.
- Test kit: `BAND = { maxRows: 4, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 } }`; `bandText` reads the first `Text` only (several rows need `ui.findAll`); the row press finds `key: 'row'` (several rows need per-row keys); the kit fakes `process.run` (`${cwd}\n`) but not `fs.list`.
- The Pane shows one `snap`: it needs a chosen ticket or one section per marker.

## 4. Behaviours resting on the Write/Edit claim
| behaviour | tests pinning it | a scan design |
|---|---|---|
| `known` atom (Write/Edit-named path wins) | "worktree marker written by path wins over the cwd"; "F2 …"; "a Bash call with two markers: at most 10 fs calls (3e)" | not needed |
| `own` list / `isOwn` | "own writes (R6)" (4); relative-path Write; failed Edit of another session's marker; F2 Edit; N2; N3; successful Write with failed stat; F1, N1 fs counts | could stay for Write/Edit only, but Bash writes would all read unconfirmed |
| `unconfirmed:` label | Bash-written; changed by a call not naming it; another session after start; dim test; turn end re-read; replaced while idle | no evidence of the writer under a scan |
| `earlier session:` label (`mtime < startedAt`) | older than session; drawn at start; dim test | independent of the claim: can stay |
| WRITERS refresh trigger + before-call stat | Bash delete; fs counts | refresh can stay, no claim |
| `MARKER_TAIL`, `parseMarker` (2 lines, `/^(plan|run) \S/`) | parseMarker tests; malformed marker | needs `active-<ticket>`; `trivial` with a ticket line is malformed today |

## 5. Hook frequency and the frozen budget
- Refresh on `session.start`; `tool.call` for Write, Edit, NotebookEdit, Bash; `turn.complete`; a `$.clock.every(CHECK_MS)` timer while a row is drawn; the render restarts the check after a reload.
- Frozen 3e (W3-R1, W3-R2): per tool call ≤ 1 `git rev-parse` per new cwd (cached), ≤ 10 fs calls; per check period ≤ 6 fs calls, 0 reads; `CHECK_MS = 15_000` (R5). Pinned by the "(3e)" and "D9" tests and F1/N1.
- A scan's cost (not computed; guess): 1 `fs.list` of the root's `.shawarma`, 1 of `.worktrees`, 1 per worktree, ~3-5 fs calls per live marker: past 10 with 2 markers or several worktrees.
- Classic events exist (`FileChanged`, `CwdChanged`, `WorktreeCreate/Remove`, `watchPaths`): whether a mod can arm `FileChanged` is not found.

## 6. Prior art: who owns a state file
- Vim swap file (`usr_11.txt`): records owner, host, "process ID: 12559 (still running)" — liveness from pid and host.
- git: `gc.pid` ("gc is already running on machine '%s' pid %ju"); `index.lock` holds no owner, only existence counts ("a git process may have crashed in this repository earlier").
- Executed: Bash's environment has `CLAUDE_CODE_SESSION_ID`, equal to this session's id, even in a subagent (`CLAUDE_CODE_CHILD_SESSION=1`). T:2868-2871 `$.session.id()`: "Returns the session's id (the transcript file's name)." NOT executed: that the two match. Putting it in the marker changes the skill's contract (retro only).

## 7. Installed skill wording (SKILL.md 17-19, identical to the repo)
> At plan step 1, run Wave 0 and a trivial go, write `.shawarma/active-<ticket>` at the root of the step's tree, beside `.shawarma/.gitignore` holding `*`: the plan dir (a trivial go: the ticket), then `plan <step>`, `run W<n>` or `trivial`; rewrite it each step or wave; delete it at every stop. …

## Open design questions
A. Label without the claim: (1) drop `unconfirmed:`, keep `earlier session:`; (2) session id in the marker (skill change, retro); (3) keep the claim for Write/Edit; (4) pid/host line.
B. Worktrees: (1) `<main>/.worktrees/*` via `fs.list`; (2) `git worktree list --porcelain`; (3) both.
C. Main checkout: (1) `rev-parse --git-common-dir`; (2) `$.session.repo().root` (untested); (3) first `worktree list` record. Cache per cwd.
D. Cost bound 3e cannot hold for N markers: (1) a new bound per marker and worktree; (2) a row cap; (3) the check lists folders instead of statting. Needs a ruling (3e, R5 frozen).
E. Several rows: count, order, what the Pane shows, per-row keys.
F. Trivial markers: no plan dir; row `<ticket> · trivial · since HH:MM`.
G. Stale markers after a crash: dim as earlier session; hide after an age; or only newer than session start.
H. Markers in prunable or locked worktrees.
I. Gitignored marker (yes); VS Code (no mod surface, pi0y D1).
J. `fs.list` on a missing folder: one probe.

## Found nothing
Glob/readdir/watch beyond `fs.list`/`fs.ancestors`; a sandbox rule for `$.process.run`; `fs.list` on a missing path; arming `FileChanged` from a mod; several plugins sharing the band; `git worktree list` cost under `$.process.run`.
