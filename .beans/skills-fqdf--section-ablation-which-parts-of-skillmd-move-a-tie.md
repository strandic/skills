---
# skills-fqdf
title: 'Section ablation: which parts of SKILL.md move a Tier 1 score'
status: todo
type: task
priority: high
created_at: 2026-09-03T09:32:25Z
updated_at: 2026-09-04T12:57:18Z
parent: skills-c25p
blocked_by:
    - skills-ccsx
    - skills-ie78
---

Tier 2's first experiment (`docs/plans/primer-evals/tier-2-backlog.md`, experiment 1). The 2026-09-03 sweep found a same-shape placebo ties the primer on every delta case and beats it on one, so Tier 1 cannot yet attribute any behaviour to the primer's content. This experiment removes one section at a time and re-runs the existing suite to see which sections, if any, move a Tier 1 score outside the noise floor (0.12). The placebo result says to bet on "none".

Conditions, each the treatment with one section deleted:

- triage section (skip / decompose / run it)
- failure-modes list
- setup section (artifact home, worktree, checkpoints)

Each is one sweep of that condition alone, about $9 and 45 minutes from a terminal, once skills-ccsx lands. Register each condition and its expected directions in an amendment before sweeping. Read the result per case against the current treatment column in `docs/plans/primer-evals/RESULTS-2026-09-03.md`.

- [ ] generate the three ablated conditions from SKILL.md (a script, so they track the source like the treatment mirror does)
- [ ] register them, with directions, in an amendment
- [ ] sweep each, merge, write up



Order note, 2026-09-03: needs the three base records re-established (one full sweep, ~$27) after skills-ie78 lands; then each ablation condition is one sweep (~$9) merged against them (Amendment 5).



2026-09-03 16:57: the full sweep was aborted — Opus judge 529 on most calls, records void under I1c, $11.37 spent. See docs/plans/primer-evals/sweep-log.md. Still pending: one full sweep when the judge is healthy.



2026-09-04: base records exist and are committed (docs/plans/primer-evals/records/2026-09-04/, report RESULTS-2026-09-04.md, instrument a21420ccf879). Each ablation condition is now one sweep (--condition <id>, ~$9) merged against them. Ready to start.



2026-09-04: treatment-no-triage built (generated, drift-checked), registered by Amendment 7 with all four directions at 0 (the placebo prior). Ready to sweep: EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 node scripts/run-evals.mjs --condition treatment-no-triage (~$9), then merge.
- [x] triage-section ablation built and registered
- [ ] triage-section ablation swept and merged
- [ ] failure-modes ablation
- [ ] setup-section ablation



2026-09-04 14:55: treatment-no-triage swept ($10.63) and merged. 3/4 zeros held; looks-trivial −0.20 (the section costs the stop, not the recognition). Follow-up decision: skills-2q2k. Next: failure-modes ablation.
- [x] triage-section ablation swept and merged



2026-09-04: treatment-no-failure-modes built and registered (Amendment 8, all four directions at 0). Sweep: EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 node scripts/run-evals.mjs --condition treatment-no-failure-modes
- [x] failure-modes ablation built and registered
- [ ] failure-modes ablation swept and merged
