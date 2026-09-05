---
# skills-2q2k
title: 'Triage section costs the stop on looks-trivial-is-structural: decide what to change'
status: completed
type: task
priority: normal
created_at: 2026-09-04T12:56:34Z
updated_at: 2026-09-05T15:48:25Z
---

Finding from ablation 1 (PRE-REGISTRATION.md, results section for treatment-no-triage, 2026-09-04): with the '## Does this earn the gates?' section the agent names the shared counter 5/5 (does-not-skip passes) but 2/5 runs then implement the change in the same turn (no-source-edits, source-untouched, liveness fail). Without the section 5/5 stop. Δ −0.20, outside the 0.13 floor, registered 0.

The rules themselves are applied correctly; the cost is that answering 'run it' reads as permission to run the whole method now. Candidates: (a) end the section with an explicit 'then produce step 0 and stop at its gate'; (b) move the triage into step 0's artifact rather than before it; (c) drop the section (the ablation says nothing is lost on Tier 1). Any change to the shipped SKILL.md changes the treatment digest and needs a treatment re-sweep (~$9) to measure; the controls stand.

- [ ] decide a, b or c
- [ ] if a or b: change SKILL.md, regenerate conditions, amendment, treatment-only sweep, merge
- [ ] if c: same, and the ablation becomes the treatment



2026-09-05, after ablations 2 and 3: the over-eagerness on looks-trivial is not owned by the triage section. Every ablation improves the case (no-failure-modes 0.84, no-triage 0.92, no-setup 1.00, placebo 0.92, treatment 0.72), so option (c) 'drop the triage section' would fix one cell, not the mechanism. Reframe the decision: what in the whole document makes two runs in five implement a structural change in one turn, and does the 'stop at the gate' instruction need to be stronger than everything else combined? A candidate: put 'One step per turn … stop at the gate' last as well as first, or make step 0's gate line explicit in the steps list. Any change needs a treatment-only re-sweep (~$10) and regenerating the three ablations (~$30 if re-measured).



Decided 2026-09-05: option 1, strengthen the stop and cut nothing. SKILL.md step 0 now ends 'The plan is this turn's whole deliverable: write it, change no source, and stop — however obvious the fix now looks', and a closing block restates the gate rule. Placebo matched with the same scaffolding in its own words. Amendment 10; ablation conditions withdrawn from the active list. Re-sweep pending: treatment + placebo (~$20).
- [x] decide: option 1
- [x] change SKILL.md, regenerate conditions, amendment
- [ ] treatment + placebo sweep, merge, results section
