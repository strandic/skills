## Round 3 attack lane: the round-3 sketch

The six round-2 cases now read as intended. I still found five ways the session's own run gets hidden: C2a3/C2c4, C6a, C4a, C6b3 and C5d. One case is new: C6d, where the B6d fix does not cover the drawn row's own ticket.

**Setup**
- Command: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test <dir>`.
- Work folder: `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-attack-r3/`
  - `mod/tests/attack2.test.tsx` is round 2's file, unchanged. `mod/tests/attack3.test.tsx` holds the new tests.
  - Output: `run1.txt`, 387 pass and 4 fail. B2d1 and B2d2 are round 2's NOT RUN cases. C5a and C5a2 are NOT RUN, see below.
  - `mod2/tests/rerun.test.tsx` holds the fixed retries. Output: `run2.txt` and `run3.txt`.
- Oracles are literals, or the store Map read directly.
- Shorthand: M = `main-1 · trivial · since 14:00`, W1 = `wt-1 · trivial · since 14:00`.

### C1: round-2 cases re-run
- **B7a:** `[W1,"1 run in another worktree"]`, store `["/lnk/.worktrees/w"]`. Same as the B7a0 control.
- **B7b:** under git and under the fallback, both read `[M,"other tree: "+W1]`. The store holds both spellings: `["/lnk","/lnk/.worktrees/w","/repo","/repo/.worktrees/w"]`.
- **B4a2:** `[M,"other tree: n-1 · trivial · since 14:02"]`, store `["/repo","/repo/.worktrees/n"]`.
- **B2e:** `[M,"other tree: wt-1 · … 14:02"]`, store `["/repo","/repo/.worktrees/w"]`.
- **B7f:** `[M,"1 run in another worktree"]` during the subagent call and after it. Store `["/repo"]`.
- **B6d:** `"…In other worktrees: **bold**, a b, c [31mred, ls x, n l, r r, tab t, x ### Fake heading, z z…"`. The line breaks are gone. `**bold**` is still Markdown.

### C2: spellings of the roots and the cwd
- **C2a** (git spells the roots through a link, cwd real WT): `[W1,"1 run in another worktree"]`, store `[/lnk/.worktrees/w]`.
- **C2a2** (same, cwd ROOT): `[M,"1 run…"]`, store `[/lnk]`.
- **C2a3** (C2a, with one failed stat of `/lnk/.worktrees/w`):
  - First refresh and the rest of the turn: `[M,"1 run in another worktree"]`. The own run is folded and main is shown as current.
  - After the turn end: `[W1,"other tree: "+M]`. Store `[/lnk, /lnk/.worktrees/w]`, so the main checkout is falsely claimed for good.
- **C2b** (git real, cwd and root through a link): `["2 runs in other worktrees"]`, the same after the turn end. Store `[]`.
- **C2c** (git lists `/repo/wl`, a link to `/x/w`; cwd `/x/w`): `[wt-1,"1 run…"]`, store `[/repo/wl]`.
- **C2c2** (same, cwd ROOT): `[M,"1 run…"]`, store `[/repo]`.
- **C2c3** (git lists `/lnkw`, a link to WT; cwd WT): `[W1,"1 run…"]`, store `[/lnkw]`.
- **C2c4** (C2c3, with one failed stat of `/lnkw`):
  - First refresh: `[M,"1 run…"]`, store `["/repo"]`.
  - After the turn end: `[W1,"other tree: "+M]`, store `[/lnkw, /repo]`.
- **C2d** (a link and its target both listed, in either order): `[W1,"2 runs in other worktrees"]`. The own run is drawn once and also counted once as another worktree's. The store holds whichever spelling git lists first.

### C3: false claims from the 2 s slack
Population: 48 of our calls in 30 min, seed 12345. Phases of the other sessions' rewrites: 3.1, 13.7 and 22.3 s.
- Store at the end: `["/o1","/o2","/o3","/repo"]`. All three were first stored 58.788 s after T0, at the end of our first call.
- Rows: `[M,"other tree: o1 …14:32","other tree: o3 …","other tree: o2 …"]`.
- My own arithmetic: each session's first rewrite (3.1, 13.7, 22.3 s) falls inside one of our spans even with no slack.
- Rewrites inside a span: 57/60, 59/60 and 59/60 with the 2 s slack; 51/60, 55/60 and 54/60 with none.
- So D1 claims every concurrent session with or without the slack.

### C4: the turn lists
| Case | Rows after the main turn end | Store | ms per write at 0…4999 | Turn-end ms |
|---|---|---|---|---|
| C4a: 5000 writes, distinct folders | `[M,"1 run in another worktree"]` | `["/repo"]` | 10.8, 6.1, 6.9, 7.2, 12.2, 8.1, 9.8 | 9 |
| C4b: 5000 writes, 8 folders | `[M,"other tree: n-1 …14:02"]` | claimed | 5.9–7.4 | 8 |
| C4c: 5000 distinct, subagent turn end at 2500 | claimed (n-1 is claimed at the subagent's turn end) | claimed | up to 17.3 | 39 |
| C4d: 3000 distinct, subagent turn end at 1500, NEW listed only at the main turn end | claimed | claimed | — | — |

- C4a: the own run is hidden past the 4096 cap.
- C4c: the claim happens at the subagent's turn end because it clears the worktree cache. Mid-turn readings: `[M,"other tree: n-1…"]`, store `[/repo, …/n]`.
- C4d: mid-turn reading `[M]`, store `[/repo]`. The subagent's turn end did not clear the lists.

### C5: first event after a reload
- **C5a and C5a2** (first event is the 15 s check): NOT RUN. Writing the plugin's `rows` atom from the test throws `TypeError: … 'state.get'`, so the kit cannot seed rows for the check to start on.
- **C5b** (first event a subagent turn end, main cwd ROOT): after it, `[M,"1 run…"]`; after a main call, the same. Store `[/repo]`.
- **C5b2** (main cwd /sib, subagent cwd WT):
  - After the subagent's turn end: `[M,"other tree: sib-1…","1 run…"]`. The own run is wrongly labelled.
  - After a main call: `[sib-1…,"other tree: "+M,"1 run…"]`.
- **C5c** (first event a main call, cwd WT): `[W1,"other tree: "+M]`, store `[/repo,…/w]`.
- **C5d** (first event a subagent call while `session.root` rejects):
  - After it: `[]`. Every row is gone, the own run included.
  - After a main call: `[M,"1 run…"]`.

### C6: free attacks
- **C6a** (55 worktrees spelled through `/lnk`; cwd real, in the 55th): `[M,"6 worktrees not scanned"]`, store `["/lnk"]`. The own run is hidden and main is falsely claimed. Control C6a0 with real spellings: `[w54-1…,"1 run in another worktree · 6 worktrees not scanned"]`.
- **C6b3** (sibling worktree made this turn, marker written by Write, 70 writes of 1 s each, git fails only at the turn end):
  - At the turn end: `[M]`.
  - Next turn, with git working: `[M,"1 run in another worktree"]`, store `[/repo]`.
  - With 20 ms or 100 ms calls it was claimed instead: the marker time sat within 2 s of a kept span (C6b, C6b2).
- **C6c** (our Bash writes our WT marker, file time behind the engine clock, no changed-files list):
  - 1500 ms behind: claimed.
  - 2500 ms and 3000 ms behind: `[M,"1 run in another worktree"]`, store `[/repo]`.
- **C6d** (an own-tree ticket holding a line break, drawn as the row):
  - Pane: `"**x\n### Fake heading** · trivial\n\nOther tickets: n l\n\nTrivial run: no brief."`
  - Band: `["x ### Fake heading · trivial · since 14:00","n l · …"]`.

## Findings: own run hidden
1. **C2a3, C2c4: one failed real-path stat at discovery.**
   - `byReal` falls back to the root's text, and an enclosing root's real path contains the cwd. So the main checkout is taken as current and claimed for good.
   - The own run stays hidden for the rest of the turn.
2. **C6a: own tree past MAX_TREES under link spelling.**
   - `discover` asks real paths only for `scanned(found)`, and `found.own` is null because of the text mismatch. The own tree is past the first 50, so it is never scanned or matched.
   - `/lnk` is claimed instead.
3. **C4a: the 4096 cap.** Past 4096 writes into distinct folders, the marker's folder and span both drop, as B4a2 did at 64.
4. **C6b3: the turn lists are cleared even when the turn-end refresh ran on the fallback.**
   - git failed at that refresh, so the fallback listing did not include the new sibling worktree, and the lists were cleared anyway.
   - Nothing restores the claim later.
5. **C5d: a subagent-first event now depends on `session.root()`.** `discover` does not catch its rejection, so all rows are blanked.
6. **C6c: the slack covers up to 2 s.** File times 2.5 s or more behind the engine clock still miss.

## Other findings
7. **C6d:** the B6d fix cleans the listed names but not `row.ticket` inside `**…**`. A line break in the drawn row's own ticket still opens a Markdown heading.
8. **C2d:** a link and its target both listed counts the own run again as "another worktree" (an extra +1).
9. **C2c4, C2a3:** the false claim of the main checkout stays in the store.
10. **C3:** D1 claims every concurrent session within the first call. The slack only adds 2–6 rewrites out of 60.

## Flags
- **C5a, C5a2 NOT RUN:** the kit cannot write a plugin atom from the test (`state.get`). The hot-reload check path stays untested.
- **B2d NOT RUN:** the kit refuses a negative clock advance, as in round 2.
- **C3 model limits:** one turn, no turn ends. Phases and durations come from a fixed seed. Our spans cover about 86% of the time, so the result says little about how wide the slack is.
- **C4 timings come from the fake fs,** a Map scanned linearly. They are not real engine costs.
