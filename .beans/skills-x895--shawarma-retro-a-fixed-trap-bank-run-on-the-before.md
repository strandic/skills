---
# skills-x895
title: 'shawarma retro: a fixed trap bank, run on the before-text and the draft'
status: todo
type: task
priority: normal
created_at: 2026-09-24T15:53:50Z
updated_at: 2026-10-09T05:59:34Z
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

- [ ] case format written (ticket, base commit, rulings file, trap items)
- [ ] at most 6 cases assembled in the host project, one per failure class
- [ ] retro-workflow.js runs the bank on both arms, re-running only disagreeing cells
- [ ] noise calibration read once and recorded

## Round 6 (2026-10-09, bigbrain docs/retros/2026-10-08-shawarma-round-6/, skill v0.6.0 0f5fa13)

Not done: a one-off replay ran instead (2 tickets, rubric committed first, draft only — not before-text vs draft). Its two cases (a config flag contradicting the disk; error-surface 'unchanged' claims and dependency default limits) are bank candidates.
