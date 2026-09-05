---
# skills-btt2
title: 'Recon-section ablation: does ''run it, don''t read it'' license implementing at step 0?'
status: completed
type: task
priority: normal
created_at: 2026-09-05T17:28:13Z
updated_at: 2026-09-05T20:11:28Z
parent: skills-c25p
---

After Amendment 10 the treatment still implements looks-trivial-is-structural in one run of five, and that run opened 'Reproduced and fixed'; the placebo, with the same stop sentence but no recon content, stops 5/5. Hypothesis: the step-4 recon language (recon is a run, not a read) is what the remaining implementer obeys at step 0.

One ablation, one sweep (~$10): add to ABLATIONS a condition minus the recon material (the step-4 bullet and the recon-related failure modes; step 4 is a list item, not a ## section, so removeSection needs a per-bullet variant), register it (Amendment 11) by the same prior rule, sweep, merge against the 2026-09-05 records.

No Tier 1 case reaches step 4, so this measures the section's side effect on step 0, not its purpose.

- [ ] decide the cut and extend the generator
- [ ] register, sweep, merge



2026-09-05: built as treatment-no-recon (removeLines variant in build-conditions.mjs; 12 lines, 1315 words vs 2075), registered by Amendment 11 with looks-trivial −1 and the rest 0. Sweep: EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 node scripts/run-evals.mjs --condition treatment-no-recon
- [x] decide the cut and extend the generator
- [ ] register, sweep, merge — registered; sweep pending



2026-09-05 22:10: swept ($9.67 after a $7.40 session-limit abort) and merged. looks-trivial +0.16 against a registered −1: refuted. Both versions have one implementer in five; the ablation loses liveness instead. After Amendment 10, cutting 37% of the document does not help, so 'any large cut helps' is out too. Write-up: results section for ablation 4. Section-ablation work closed.
- [x] register, sweep, merge
