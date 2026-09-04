---
# skills-2q2k
title: 'Triage section costs the stop on looks-trivial-is-structural: decide what to change'
status: todo
type: task
priority: normal
created_at: 2026-09-04T12:56:34Z
updated_at: 2026-09-04T12:56:34Z
---

Finding from ablation 1 (PRE-REGISTRATION.md, results section for treatment-no-triage, 2026-09-04): with the '## Does this earn the gates?' section the agent names the shared counter 5/5 (does-not-skip passes) but 2/5 runs then implement the change in the same turn (no-source-edits, source-untouched, liveness fail). Without the section 5/5 stop. Δ −0.20, outside the 0.13 floor, registered 0.

The rules themselves are applied correctly; the cost is that answering 'run it' reads as permission to run the whole method now. Candidates: (a) end the section with an explicit 'then produce step 0 and stop at its gate'; (b) move the triage into step 0's artifact rather than before it; (c) drop the section (the ablation says nothing is lost on Tier 1). Any change to the shipped SKILL.md changes the treatment digest and needs a treatment re-sweep (~$9) to measure; the controls stand.

- [ ] decide a, b or c
- [ ] if a or b: change SKILL.md, regenerate conditions, amendment, treatment-only sweep, merge
- [ ] if c: same, and the ablation becomes the treatment
