## Fix review 3a for skills-oz54: pre-fix b3e6c4e against fix 29f8f15

**Result:** the fix closes V16 and V17, but it adds one new lasting wrong outcome. I call it G1 (`own`). It was found by executed probes, and nothing in the B1 enumeration or the sweep covers it. There were no other findings: the fix adds no other wrong label, no hold past the README limit and no error that reaches a caller.

**How I ran it:** I copied each commit's mod folder with `git archive` into a scratch folder and ran `claude plugin test` on each copy. The scratch folder is now removed. I made no commit and no stash, and touched no index. All runners, probes, readings and the grader `classify.py` are in `docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview3/`. The graded summary is in `classified.txt`.

### Liveness (the unpatched control first, then a probe only the fix can pass)
- **V16's sequence (P1, `t.tail.tsx`):** the cwd read rejects or never answers, then the probe reads tick1.
  - Pre-fix: `[m, other tree: w]`.
  - Fix: `[]`.
  - All-instant control: rows.
  - Only the fix passes.
- **V17's sequence (P2b, `t3.tail.tsx`):** the probe reads the pane at 4.5 s.
  - Pre-fix: `shawarma: p: plan dir outside its tree (/lnk/r/.shawarma/active-p)`.
  - Fix: the brief `**p** · plan 1 … Recap`, which is not false.
  - Control: `**p — inside** · plan 1 …`.
  - Only the fix passes.

### Finding G1 (`own`; new in 29f8f15; lasting)
A lost cwd read at a main turn end now drops that turn's call spans and folders before they were placed against the new worktree list. A worktree the session made and wrote earlier in that turn is then never claimed.

- **Cause:** `readMainCwd` no longer sets `lastTrees = null`. `turn.complete` then still finds the trees of an earlier refresh and runs `if (isMain && lastTrees?.isFromGit === true) { turnFolders.splice(0); turnWindows.splice(0) }`. This turn end's own refresh threw before it listed anything.
- **Minimal reproduction** (`g.tail.tsx` G1 and `g1w.tail.tsx` G1w):
  1. The session is in /repo, which is claimed.
  2. Call 1 writes the marker `/repo/.worktrees/x/.shawarma/active-k`. G1 does this with Bash `mark`, G1w with a Write. Git does not list x yet.
  3. 70 more writing calls follow, 3 s apart. In G1w each one writes into its own folder.
  4. Git lists x just before the turn ends.
  5. The turn end's `session.cwd` rejects or never answers.
  6. The probe reads after the next Bash call, after a 15 s check, and after a later instant turn end.
- **Readings** (r1, r2 and r3 are all the same):
  - Fix, reject and never: `[m, 1 run in another worktree]`.
  - Pre-fix, reject and never: `[m, other tree: k]`.
  - Control: `[m, other tree: k]`.
  - With 10 calls in the turn, all three sides give `other tree: k`. Under 64 calls the kept lists still hold the span and the folder.
- **Earlier evidence:** the fix review's own P3c reproduces it too (`p3-*.txt`). With 70 calls and a rejecting turn end, the fix gives `1 run in another worktree`, while pre-fix and the control give `other tree: k`. This is the behaviour of 1a6d0cc returning. The earlier lane's report credited 3391a63 with closing it.
- **Possible fix, tested only on G1 and G1w:** `if (isMain && !isCwdLost && lastTrees?.isFromGit === true)` (`try.diff`). It gives `other tree: k` in all 18 probe runs (`try-g1.txt`). I did not run the suite with it.

### 1. Call sites
Every code call site is in `mods/shawarma-companion/hooks/register.tsx` at 29f8f15. Elsewhere in the tree the names appear only as words in beans, docs, `model.ts` (`stale:`) and scripts, and in tests.

**`readMainCwd`** (:621; no longer nulls `lastTrees`):
- :688, the check when the cwd is lost: the same calls as before. fix-n `lost` gives 3 calls and 5 999 ms on both sides.
- :695, the check when the trees are known: now followed by the new :697.
- :776, `tool.call` (main session only): `lastTrees` is now kept. The pane effect is V17 (above).
- :794, `turn.complete` (main session only): `lastTrees` is now kept. This is G1.

**`isCwdLost`:**
- Set at :624 and cleared at :747 (`session.start`): unchanged.
- Read at :634 (the throw in `refresh`) and :688: unchanged.
- Read at :686 (`|| isCwdLost`): new. P0 gives the same reading on both sides, `[w, other tree: m]`.
- Read at :697: new. This is V16 / P1.

**`lastTrees`:**
- Set at :635: unchanged.
- Read at :686 and :691: these now see trees found before the loss. Execution always takes the lost branch, so no behaviour changes (B1, sweep).
- Read at :798: changed. This is G1.
- Read at :896 (the pane's `reals`): changed. This fixes V17 (P2b).

**`stale`:**
- Called only from :665, the check timer. Its catch is unchanged. The new branch returns `refresh`, which never throws.

**`refresh`:**
- :697 is a new caller.
- :689, :719, :756, :785 and :795 are unchanged. What they see changes only through `lastTrees` (G1 and V17).

### 2. Attacks
- **B1 enumeration** (6 912 runs per side, 41 472 reads, 0 failing tests, no unhandled rejection):

  | | wrong labels that differ from the control | wrong labels equal to the control | absences |
  |---|---|---|---|
  | pre-fix | 0 | 2 228 | 26 064 |
  | fix | 0 | 1 160 | 29 376 |

  - All 3 312 of the fix's reads that differ from pre-fix are absences.
  - The readings are identical to the earlier lane's F and variant C runs.
- **Sweep** (3 500 runs per side, 17 500 reads, 0 failing tests; I re-split it into 25 shards per side after load timeouts):
  - Wrong labels that differ from the control: pre-fix 208, fix 196.
  - All 196 equal pre-fix's same read. They are reads taken during an in-flight Bash call whose cwd answers late or never.
  - The fix has 0 such reads that do not equal pre-fix's read.
  - All 464 of the fix's reads that differ from pre-fix are absences.
  - The readings are identical to the earlier F and C runs.
- **G2** (the check's read lost, then a main Bash call during the check's discover wait, with and without a move): pre-fix and fix give equal readings. The only wrong read is the in-flight lag also seen in the sweep.
- **G3** (a flapping cwd across Bash calls, turn ends and checks, with a move): no wrong label on either side, only absences.
- **Holds** (`fix-n-*.txt`, 80 runs per side, 0 failing, no unhandled rejection):

  | state before the tick | pre-fix | fix |
  |---|---|---|
  | normal | 3 calls, 6 000 ms | 2 calls, 4 000 ms |
  | lost | 3 calls, 5 999 ms | 3 calls, 5 999 ms |
  | changed | 4 calls, 7 999 ms | 4 calls, 7 999 ms |

  - P5: the lost branch makes 5 calls on both sides.
  - Every reading is within "eight … 16 seconds".
- **Errors:** none reached a caller. The only test failures in the reused `t.tail.tsx` (P2 mount, P7 faulty sub timeout) are harness problems. They are the same on both sides and in the earlier lane's runs.

### 3. Docs
- **README, the paragraph with "gives up after 2 seconds":**
  - True in my readings: "When the working directory cannot be read after a tool call, at a turn end or in the 15-second check, the mod forgets the one it knew and draws nothing until the working directory is read again: …". P1 now gives `[]` at tick1. "It then finds the worktrees again from the folder it reads" is true (P1 tick3, P0). The "eight … 16 seconds" sentence holds.
  - False under the fix: "a call that gives up claims nothing that update." G1 shows a turn end's give-up claims nothing ever: r3, after a later instant turn end, still shows `1 run in another worktree`.
  - False under the fix (README :37): "It checks the folders of the last 64 files the session wrote at each update, so a worktree made and written in the same turn is claimed once git lists it." G1w shows otherwise.
  - False under the fix (README :35): "a marker in it was written during one of the session's own … Bash calls … This catches a marker a Bash command writes into another worktree." G1 (Bash) shows otherwise.
- **CHANGELOG 0.3.4:** every sentence held in my readings, including "draws nothing until it reads it again, at the main session's next tool call or turn end, at the next 15-second check, or at a session start" (P1, V9, V13 sequences). One small wording point: at a session start the mod takes the folder from the start event; it does not read it. The entry does not mention G1.
