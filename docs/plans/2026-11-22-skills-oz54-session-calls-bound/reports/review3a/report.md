## 3a adversarial review, skills-oz54 (session calls bounded), head 873fec5, base control c3c525d

**Verdict:** there is one real finding (F1). On this head the band can again label the session's own tree as `other tree:`. The brief says that this path is closed. The cause is the rebase: the change now sits on PR 13 (skills-cm2l), which makes the 15 s check keep running after a failed refresh.

### Setup
- I made scratch worktrees `.worktrees/oz54-rv3a-head` (873fec5) and `.worktrees/oz54-rv3a-base` (c3c525d), and plain `cp` copies of the mod folder under the scratchpad for parallel shards. All of them are removed now. I made no commits, no stash, no edits to the oz54 or oz54-base worktrees, and reinstalled nothing.
- Each probe is the first 222 lines of `tests/band.test.tsx` (the `world` helpers, the same on head and base) plus my own tail. It runs as the only test file, with `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin test <mod>`. Readings are printed as `READ` lines.
- Everything is in `docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/review3a/`: the `*.tail.tsx` probes, `header.tsx`, the `*-head.txt` / `*-base.txt` outputs, `b1-classify.py` and `b1-classified.txt`. The `run.sh`, `b1-run.sh` and `b1r-run.sh` runners point at the scratch worktrees, which are now removed. Re-create them to re-run.
- R1 on head: `314 pass` / `0 fail` / `Ran 314 tests across 1 file.` (one run, `suite-head.txt`).
- Oracle checks: F1 and B1's truth oracle are hand-written label strings, so they do not depend on the code under test. B1's control oracle is the same kit engine with every answer instant, as §7 defines it. All engine behaviour is the kit's synthetic stand-in, as the brief already states (`DRY-RUN ON STAND-IN`).

### F1: the own tree drawn as `other tree:` (listed: A4 and B1; wrong label)
- **Probe P1** (`p1p2.tail.tsx`):
  1. Session start in `/repo`; a Bash call draws `[m, other tree: w]`.
  2. The session moves to `/repo/.worktrees/w`.
  3. A main Bash call whose cwd answers 3 s late, so it gives up.
  4. The 15 s check runs with the cwd answering at once.
- **Oracle:** rows labelled by the folder the session is in (w).
- **Head, late:** after the Bash `[]`. After the check `["m · trivial · since 14:00","other tree: w · trivial · since 14:00"]`. Still the same at the next tick (30 s). Correct only at the next main Bash.
- **Head, instant control:** `[w, other tree: m]` at every read.
- **Base c3c525d, late:** `[w, other tree: m]` at every read. The base waits 3 s but never gives up.
- **Why:** cm2l's `watch(... || (next.scan.status === 'failed' && check !== null))` keeps the check running after the lost refresh. On the next tick, `stale` calls `readMainCwd`, which clears `isCwdLost`. `lastListed === null` then forces `refresh($, trees, list)` with `lastTrees`, which still holds the trees found before the move. The lost refresh threw before `lastTrees = at`. On f1ed7f4 the empty refresh stopped the check, so this path did not exist when the plan was spiked.
- **Minimal reproduction:** `p1min.tail.tsx`, a test that expects the band not to equal `[m, other tree: w]`. Head: `(fail)`, `Expected: not [` / `Received: [`. Base: `(pass)`. A single rejecting cwd read reaches it too, with no slow engine (B1 rows such as `bash,bash,idle late,reject,instant 0`).
- **Not covered by the suite:** V10 keeps the cwd late during the check, so it stays green.
- **Candidate fix, own, lightly tested:** add `if (isCwdLost) lastTrees = null` in `readMainCwd` (diff in `fixtry.diff`). The suite plus the F1 test then read `315 pass` / `0 fail`. I did not re-run B1 on it.

### B1, re-run on the new base (listed enumerate; own timeline)
- **Design:** 27 sequences of 3 steps (bash, turn end, or idle) × 64 cwd modes per step (instant, 3 s late, never, rejects) × 4 move positions = 6 912 runs. In each step the event fires at 0 s, the band is read at 7 s, the check ticks at 8 s, and the band is read again at 15 s. That gives 41 472 reads per side.
- The kit kills a test file at 600 s, so the first pass lost some runs. I re-ran the missing ones from a list: 6 912 of 6 912 runs on each side.
- **Head against its instant control:** 270 reads in 222 runs differ in label. Every one is the F1 text `[m, other tree: w]` while the session is in w, and every one of those runs has an idle step, meaning the check recovered the directory. There are 25 272 absences.
- **Base against the same control:** 7 665 label differences (base keeps the old directory on a rejection, and holds on never).
- **Liveness:** the head readings are not equal to the base's, so the run is live.
- The brief's "0 label differences" no longer holds on this head.

### B4, re-run with instant answers (listed)
- Cases: a `/cd` then the check, a move then a subagent call, a move then a session start naming the old folder.
- Head and base read the same in all three: `[m, other tree: w]` with truth w. These are the pre-existing gaps already filed (skills-mizx, skills-laqh). The change adds no new difference here.

### A3, reject against never per site (listed enumerate; own timeline)
- **Design:** the k-th `session.cwd`, `root` or `usage` call fails; every other call answers at once. In the all-instant run there are 13 cwd, 12 root and 23 usage calls. 47 pairs were reached on each side. I compared band reads and stored claims.
- **Head, cwd call 2** (the read after a Bash call): reject redraws the rows by the next read, never shows `[]`. This is timing, not a label: the rejection loses the directory at once, so the check tick at 15 s recovers it (F2). With never, that tick runs while the read is still pending, the late give-up marks it lost again, and the band stays empty until the next tick. Claims are equal.
- **Head, the drawing-time `usage` sites (k = 4, 8, 11–13, 17–21), never:** the test hit the kit's 5 s real-time limit, with reads `held` after the hung call. The base shows the same pattern. The cause is the kit's `advance`, which "resolves once … the event loop settled". So this is a liveness failure of my harness, neither a kill nor a pass. Those 10 pairs are NOT RUN.
- In isolation the drawing bound works: probe `rnd.tail.tsx` gives head draw `[]` at 2 s, base held, under 4 setups.

### Own attacks on §3's error surface and the README's wait numbers
- **Hold times on head** (every session call answers at 1 999 ms except the first cwd, which never answers):

  | path | held | session calls |
  |---|---|---|
  | main Write | 10 000 ms | 5 |
  | turn end | 4 000 ms | 2 |
  | subagent Bash | 8 000 ms | 4 |
  | the check | about 8 000 ms | 4 |

- On the base, the Write and the turn end hit my 60 s cap.
- These readings do not contradict "at most eight … 16 seconds", but I did not try to reach the worst case.

### F2: the 15 s check recovers a lost directory (own; wrong label in the docs, not a code fault)
- **Probe P2:** no move. One rejecting cwd read at a Bash call, then idle.
- **Head:** after the Bash `[]`. After the 15 s check `["m · trivial · since 14:00"]`, the rows back with no main event.
- **Base:** rows kept throughout.
- The behaviour itself fits cm2l's README line 81. It contradicts the oz54 sentences listed below.

### Sentences my readings make false
- **README line 40:** "the mod forgets the one it knew and draws nothing until a later tool call or turn end of the main session reads it again, so it does not go on labelling the trees by the folder it last read." False twice:
  - the check alone brings rows back (P2);
  - after a move it labels by the trees of the folder it last read (F1).
- The same README sentence also contradicts line 81: "The rows come back at the first check after the error clears."
- **CHANGELOG 0.3.4:** "the mod forgets it and draws nothing until the main session reads it again, so it does not label the trees by the folder it last read." The "does not label" clause is false (F1).
- **Brief §6:** "closed for a give-up by 2b (V9, V10, B1)". False on this head (F1).
- **Brief §2 B1 reading:** "6 912 runs, 0 label differences". This head gives 270 reads in 222 runs.
- **Brief §2 B5:** "the 15 s check stays stopped until a main event (the empty refresh stopped it)". False (P2).
- **Brief S2:** "it stays empty until a main call or turn end reads the directory, since the empty refresh stops the 15 s check". False (P2).
- **register.tsx doc comment on `isCwdLost`:** "so no row is labelled by a folder the session may have left". False (F1).
- **Brief §3, "every refresh draws nothing until a main read answers":** holds literally, but the check's read counts as a main read.
- **Brief §9 W0:** checked only that the hunks equal the sketch's. It did not re-run A3, B1 or B4 on the new base, and B1 is what fails.

### Findings summary
- **F1** (listed: A4 and B1 re-run on c3c525d): wrong label. Reproduction in `p1min.tail.tsx`. Head fails, base and the instant control pass. It persists until the next main event.
- **F2** (own): wrong label in docs only (README line 40, brief B5 and S2). Reproduction in `p1p2.tail.tsx`, P2.
- **A3, drawing-time `usage` never pairs:** NOT RUN (harness liveness failure; the base reads the same).
- No unbounded hold, and no new error reaching a caller, was found.
