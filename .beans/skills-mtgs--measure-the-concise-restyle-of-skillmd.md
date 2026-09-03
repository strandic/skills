---
# skills-mtgs
title: Measure the Concise restyle of SKILL.md
status: todo
type: task
priority: normal
created_at: 2026-09-01T11:04:48Z
updated_at: 2026-09-01T11:04:48Z
---

SKILL.md was written under Claude Code's default output style; the repo has since moved to Concise. Frozen until the suite baselined the current text — which it now has, so this is measurable.

The 2026-09-01 sweep is the number to beat: `gate-stop-step0` 0.91, `looks-trivial` 0.88, `triage-skip-oneliner` 1.00, `triage-decompose-epic` 0.80, `step3-markers` 0.47.

One result sharpens the stake. The placebo — same eight gates, arbitrary contents — scored 0.71 on `gate-stop-step0` against the treatment's 0.91. So roughly a fifth of that case's score is carried by the primer's actual prose rather than its structure, and a restyle preserves structure by definition while changing exactly that. It could destroy that fifth and read perfectly well to a human.

Direction genuinely unknown: the current text's density may be doing work.

- [ ] restyle SKILL.md in the Concise register
- [ ] one sweep as treatment (~$10, ~35 min), compare per case against the 2026-09-01 baseline
- [ ] record the result in `docs/seven-steps-primer/pending-changes.md` #1 either way — including if it regresses
