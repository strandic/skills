---
# skills-x895
title: 'shawarma retro: a fixed trap bank, run on the before-text and the draft'
status: todo
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-09-24T15:53:50Z
updated_at: 2026-11-11T11:36:35Z
parent: skills-sp16
blocking:
    - skills-jk6n
    - skills-p4oc
---

Replace per-retro replay tickets with a fixed bank that every revision is run against.

- The bank: at most 6 past tickets of the host project, one per failure class. Each case carries its base commit, the recorded rulings the proxy answers from, and trap-only rubric items written in domain words (did the plan catch the defect the real run missed?), never items graded in the method's own vocabulary. A new trap enters only by replacing one of its class. The cases name private tickets, so the bank's data stays in the host project; the skill defines the format and runs it.
- `retro-workflow.js` runs every case on the before-text and on the draft. Pass rule: the draft loses no trap the before-text caught; every loss is read and ruled. A tripwire list, not a score.
- Calibrate once: re-run 2-3 cells on the same text. If traps flip between identical runs, re-run only the cells where the two arms disagree.
- The scorer's used / ignored / misread sentence lists accumulate across the bank; they drive the size cut (sibling bean).
- Budget: about 1.5x one retro's replay round today (3.8M tokens for 8 cells).

Lands at the next retro (skill files change only there); the bank's data can be assembled before it.

- [x] case format written (ticket, base commit, rulings file, trap items)
- [x] at most 6 cases assembled in the host project, one per failure class
- [ ] retro-workflow.js runs the bank on both arms, re-running only disagreeing cells
- [x] noise calibration read once and recorded

## Round 6 (2026-10-09, bigbrain docs/retros/2026-10-08-shawarma-round-6/, skill v0.6.0 0f5fa13)

Not done: a one-off replay ran instead (2 tickets, rubric committed first, draft only — not before-text vs draft). Its two cases (a config flag contradicting the disk; error-surface 'unchanged' claims and dependency default limits) are bank candidates.

## Round 7

Bank built in bigbrain (6 cases, 14 traps), run on both arms by a separate replay workflow, then the disagreeing cases re-run: the before-text flips three traps on identical text (noise ±0.5 per trap); no reproducible loss. Remaining: retro-workflow.js runs the bank itself; a wave-rules-only and a lanes-only case (critic note).

## Round 8 note (2026-10-19)

The bank ran outside retro-workflow.js again, six runs (scripts in bigbrain bigbrain docs/retros/2026-10-18-shawarma-round-8/ replays/wf/scratch/, gitignored). For round 9:
- **63at T2 is the case to watch.** Pooled T2 at 1: before 5/8, draft 5/15 (Fisher one-sided p ≈ 0.18). The scorer is noisy too: the same reference output was scored down on T1 and T2 once each.
- **Planner git must not reach the shared config.** In run 6 a planner wrote core.worktree into the main checkout's .git/config (worktrees share it), and the main checkout read its scratch tree until the line was removed. Give each arm its own clone (git clone --local), not a worktree, or at least diff the main .git/config after each replay.
- A one-off ±0.5 reading needs ≥ 6 runs per arm to read; two runs misled round 8's R7–R9.



**Round 9 (2026-11-02): carried to round 10** (disposition D4).


## Ruling of 2026-11-11

The owner ruled one bounded check: can the bank tell the method from no method? The full text against no skill text, on the four cases that hold the five traps able to show a loss, three runs with the skill text and three without, with the reading rule, thresholds and models committed first, one optional extension, then stop. If the bank cannot see the method, it stops deciding cuts. The protocol goes to the owner before any run.

From the review, not ruled: bank repairs (neutral folder names for scoring, the case that never reaches a brief) can wait for that reading; and the trap that reads 1 every time is worth keeping, because it is the bank's best loss detector.
