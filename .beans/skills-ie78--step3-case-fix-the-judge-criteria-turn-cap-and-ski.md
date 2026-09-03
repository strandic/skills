---
# skills-ie78
title: 'step3 case: fix the judge criteria, turn cap and skill-fired grader'
status: completed
type: task
priority: high
created_at: 2026-09-03T09:53:49Z
updated_at: 2026-09-03T13:51:37Z
---

Follows from docs/plans/primer-evals/step3-read-2026-09-03.md (skills-mdg4).

Three instrument changes to evals/seven-steps-primer/step3-markers-in-source, to be applied together in one amendment, because each changes the instrument digest and voids the existing records (skills-ccsx must land first so the change does not also void the other cases):

- [ ] graders/not-a-doc-list.md: a reply that names the files it edited and says the markers are in them scores 1 whatever its shape (list, table, prose). Only a reply describing where markers *would* go, or a plan, scores 0. Two of five treatment runs lost this grader with the markers in place.
- [ ] case.yaml max_turns: 14 → 20. Two of five treatment runs were cut off after placing every marker, and the judge saw a fragment.
- [ ] graders/skill-fired.md: the seed turn names the skill, so it fires under every condition and floors the case at 0.25. with-only does nothing under --ablation none. Try weight: 0; if the harness rejects it, delete the grader and note it in the amendment. The case becomes three graders: controls 0.00.
- [ ] amendment in PRE-REGISTRATION.md (direction of the claim unchanged; I8), re-sweep this case in all three conditions (~$5) or fold into the next full sweep.



Order note, 2026-09-03: no longer blocked by skills-ccsx. Do these grader changes FIRST, then the one full sweep that re-establishes the three records (Amendment 5.3), so the ablation conditions can merge against records taken on the corrected instrument.



Done 2026-09-03 as Amendment 6: criteria rewritten (shape-agnostic, 1 for 'markers are in the files' + a file name; 0 for plan/proposal/document/fragment), max_turns 14→20, graders/skill-fired.md deleted (the registration's grader table never listed it; the case is now three graders, controls score 0.00). Test grader count 27→26. The re-sweep is the one full sweep Amendment 5.3 already requires; not run here.

- [x] not-a-doc-list criteria
- [x] max_turns 20
- [x] skill-fired removed (deleted rather than weight 0: the registered table lists three graders)
- [x] amendment (6); full sweep pending, see skills-fqdf order note
