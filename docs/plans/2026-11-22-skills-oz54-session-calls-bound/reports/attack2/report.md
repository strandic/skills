## Attack lane report, round 2: skills-oz54 (the known working directory is forgotten on a failed call)

**Setup.** I made a scratch tree `.worktrees/oz54-attack2` (f1ed7f4 with sketch.patch applied) and a base tree `.worktrees/oz54-attack2-base` (f1ed7f4). I removed both at the end. I did not touch the spike tree or any tracked file. The `git status` entries for `.beans/*`, `sketch.patch`, `option-forget.patch`, `plan.md` and `decisions.md` were made by the planner, not by me.

All probes and outputs are in `/Users/jonathan/Documents/strandic-skills/docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/attack2/`:
- B1 probe: `b1.tsx`; raw output `b1-patched.txt`; analysis script `b1an.py`; analysis `b1-analysis.txt`
- B2–B5 probe: `b2345.tsx`; outputs `b2345-base.txt`, `b2345-b3-patched.txt`, `b2345-round1sketch.txt`
- B3 probe: `b3.tsx`
- shard scripts: `mk.sh`, `mk1.sh`

**Plain suite on the patched tree:** `296 pass / 0 fail` (`plain-patched.txt`).

Some probe runs printed "(fail) the file ran to its end": 6 times in the B1 run and once in the base B2–B5 run. Each time the text was `$.state.get refused: no hooks module … loaded`. This is the same test-kit artefact as in round 1, and the change does not cause it.

### Oracle checks
- **B1 control.** The control is the same patched code, with every cwd answer instant. It shares the code with the run it grades. So a fault common to both cannot show up in the diff. I added an independent oracle: the current tree should be the tree that holds the session's working directory at that step. B1 is graded against both.
- **B2 and B4.** The base tree and the truth oracle are independent of the change.
- **B3.** The README text is independent.

### B1: every sequence of up to 3 steps
- Steps: {Bash, turn end, 15 s check} × cwd answer {instant, 3 s late, never, rejects} × a move ROOT→WT before at most one step.
- 6912 runs (every length-3 sequence × 4 move positions). That gives 7368 unique step rows, with 0 disagreements between duplicate prefixes.
- Results against the control:

| Reading | Rows |
|---|---|
| equal | 2156 |
| **absence** (patched draws nothing, control draws) | **5164** |
| **`other tree:` label differs** | **48** |
| drawn where the control draws nothing | 0 |

- **All 48 label diffs have the same shape:**
  - an earlier step, so that the 15 s check fires during step 3;
  - then a move to WT;
  - then a turn end whose cwd answer is late or never.
  - Example: `check:instant,bash:instant,MV+turn:late`.
  - Patched: `{m: own, w: other}`, so it shows "other tree: w" while the session is in WT. Control: `{w: own, m: other}`.
  - Mechanism (from the code): the turn end's 739 gives up, then discover's 398 gives up, and the refresh throws. That sets `lastListed = null` and writes `[]`. The check that is already running then sees a changed signature and calls `refresh($, lastTrees)`. `lastTrees.own` is still ROOT from before the move, so it draws rows labelled by ROOT.
  - Not run: whether the round-1 sketch gives the same 48 rows.
- **Absences by last step:**
  - 614 each for Bash late / never / reject, and for turn reject
  - 550 each for turn late / never
  - 402 for each check answer
- **An absence is never recovered by the 15 s check.** In all 402 rows of each check answer (instant included) where the band was empty after a forget, it stayed empty. The empty refresh called `watch(false)`, which cancels the check. Only the next main Bash call or turn end with an instant answer redraws it (402/402 each).
- **Truth oracle** (rows drawn with the wrong tree as current): patched 444, control 900.
  - The control's 900 are the known gap: a check after a move keeps `lastTrees.own`.
  - The patched run "fixes" 504 of those only by drawing nothing; in 0 of them does it draw the correct labels.

### B2: the cwd call after a Bash call rejects, no move
| Case | Patched | Base |
|---|---|---|
| only 721 rejects | rows kept: 398 asks again and gets an answer (10 session calls) | rows kept |
| every cwd call in that update rejects (708, 721, 398) | before `[m, other tree: w]`, after `[]` | all equal `[m, other tree: w]` |
| 721 never answers | same as "only 721 rejects" | holds (round 1) |
| every cwd call never answers | same as "every cwd call rejects" | holds (round 1) |

When every cwd call fails, the rows stay gone through a re-render and two 15 s checks (the check is cancelled). They come back at the next main turn end, the next main Bash call, or a subagent's Bash call. After a subagent's call they come back with the wrong labels (see B4).

### B3: README "at most eight things … at most 16 seconds"
Hand count with the forget in effect (patched line numbers):

| Path | Session calls | Max |
|---|---|---|
| main tool.call | 708, 721, 398, 419, 210, 219, 220, 587 | 8 |
| subagent tool.call | 708, 397 (+ its cwd fallback), 419, 210, 220, 587 | 7 |
| main turn end | 739, 398, 419, 210, 219, 220, 587 | 7 |
| subagent turn end | 397 (+ fallback), 419, 210, 220, 587 | 6 |
| 15 s check | 651, claim (210, 219, 220), refresh's claim (210, 219, 220), 587 | 8 |
| session.start | with `e.cwd`: 210, 220, 587 (+ 419) = 4 | 6 without `e.cwd` |
| render | 767 | 1 |

Measured (call order printed in `b2345-b3-patched.txt`):

| Case | Calls | Time |
|---|---|---|
| main Bash, cwd outside every tree, 721 never, the rest at 1999 ms | 8 | **16000 ms** (bound met, not exceeded) |
| same, but 721 rejects | 8 | 14000 ms |
| all at 1999 ms | 6 | 12000 ms |
| cwd ROOT, 721 never | 7 | 14000 ms |
| turn end, 739 never | 7 | 14000 ms |
| subagent, root#1 never | 7 | 14000 ms |
| session.start | 6 | 12000 ms |
| 15 s check, 651 never or rejects, the rest at 1999 ms, marker changed | 8 | about 16 s (inferred from call order; my end measure was spoiled by the overlap) |

- **The 15 s check overlap is new.** That check runs longer than 15 s, so the next tick starts while it is still running. The calls after the 8th (`cwd4`, `id3`, `root3`) belong to the second check.
- The README numbers hold by count. Its wording does not say that two checks can overlap.

### B4: "so it never labels the trees by a folder the session may have left"
All answers instant unless noted. Truth for a session in WT is `[w, other tree: m]`.

| Case | Patched | Base | Truth |
|---|---|---|---|
| a. `/cd` to WT with no tool call, then the 15 s check | `[m, other tree: w]` after 1 and after 2 checks | same | wrong |
| a2. same, plus a marker change that forces a refresh | still labelled by ROOT | same | wrong |
| b. `/cd`, then a subagent's Bash call | `[m, other tree: w]` | same | wrong |
| c. session.start with `e.cwd` = ROOT while the session is in WT | `[m, other tree: w]` | same | wrong |

For case c, I did not verify that the engine can send an `e.cwd` different from the session's cwd.

**d. New, caused by the forget.** The session is in WT and the band is correct. Then a forget happens: a Bash call or turn end with every cwd call rejecting, or a check whose cwd never answers or rejects. The next event is a subagent's Bash call or subagent turn end, with instant answers.
- Patched: `[m, other tree: w]` in **12 of 12 rows**.
- Base: `[w, other tree: m]`. Round-1 sketch (`.catch(() => mainCwd)`): `[w, other tree: m]`. Instant control: `[w, other tree: m]`.
- Cause: after the forget, `mainCwd` is null, so `discover(isSub)` falls back to the project root (397).
- After a forget, the next main Bash call or turn end is correct.

**Verdict on the class word "never": it does not hold.**
- The forget itself makes the band label by the project root, which the session may also have left (d).
- The race in B1 relabels by `lastTrees` from before the move.
- Cases a, b and c mislabel with no failed call at all.
- Possible narrower wording: "it does not keep labelling by the folder it last read".
- Beans skills-mizx and skills-laqh look like they cover a and b. I did not read them.

### B5: after a forget, the next writing call with an instant cwd
- Main Bash or turn end, from B1: **567/567 Bash rows and 567/567 turn-end rows equal the control.**
- Subagent call as the next event: **0/12 equal** (B4 d).
- The 15 s check as the next event: it stays empty while the control draws (402 rows per check answer in B1).

### Spike rules triggered and not applied
- **Rule 3, class words.** README:40 "never labels … by a folder the session may have left" has no enumerate row, and B1, B4 a–d are counterexamples. "at most eight" and "at most 16 seconds" have no test; my B3 counts confirm them.
- **Rule 3, non-zero precondition.** V10's assertion `seen.flat().filter(t => t.startsWith('other tree: w')) == []` is vacuous on an empty band.
  - Patched: seen = `[[],[],[]]`, so it passes by drawing nothing.
  - Base: passes, with the correct labels.
  - FAIL reading: on the round-1 sketch it gets `["other tree: w" × 3]`, so it does fail there.
  - But any fix that draws nothing passes it. It needs "a row is drawn" at some point, or a correct-label expectation.
- **Rule 2, partition.**
  - No V test pairs a forget with a following subagent event (B4 d).
  - No V test covers a forget followed by the 15 s check, where the check has stopped and the band stays empty.
  - No V test covers the turn-end give-up racing a running check (B1, the 48 rows).
  - No V test covers a check longer than 15 s overlapping the next tick.
- **Rule 5, follow the state.** The forget leaves `mainCwd = null` and, after an empty refresh, `watch(false)`. No V test follows either one through the next subagent read, or through the next check tick.

### Are the V1–V10 expected values independent of the sketch?
- V1, V5, V8 and V9 are hand counts. They agree with my count.
- V8's `band: []` is the Q1 ruling written as the expected value: the rule restated, not measured independently.
- V7 now has an `asked > 0` precondition (it is fixed).
- V10's weakness is above.
