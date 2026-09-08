# Condition comparison

**Subject** `sonnet` · **judge** `opus` · **CLI** `2.1.250` · **runs/case** 10 · **started** 2026-09-07T12:08:48.904Z

**Suite** `37477be6d2940a0ad34eb61ab637f8acc2499b2c` · **pre-registration** `64d38a0efcef092a39a930b0fab471544abf67aff20950115150a9dd0895c465` · **instrument** `3572841ebaac` · **cost** ~$51.79 API-equivalent (subscription-metered; no money moved)

**Conditions** treatment `503291b82253` · placebo `0ddcff104f11` · run-oneliner `fb85d01885a6` · treatment-no-recon `4e6a35a2381b` — each condition's own digest; the instrument above is everything the conditions share.

**Noise floor — unmeasured.** The worst per-case spread between the stock-Claude columns the sweeps produced against identical cases. A contrast at or below this floor (|Δ| <= floor + 1e-9) is not a finding, and every one of them is marked. A contrast that ties the floor is inside it: the floor is the smallest difference this instrument resolves, so a difference equal to it resolves nothing. The tolerance is there because a contrast and the floor are means of the same fractions summed in different orders, so a mathematical tie lands one unit in the last place either side.

## Delta evidence

| case | treatment | placebo | run-oneliner | treatment-no-recon | none |
|---|---|---|---|---|---|
| `step4-seeded-defects` | 0.12 | 0.21 | 0.14 | 0.12 | 0.07 |

The `none` column is stock Claude Code, measured once per sweep against identical cases and averaged here. The averaging is only for this cell — the columns themselves are kept apart below, because their spread is the noise floor.

`step4-seeded-defects` is registered as carrying no case-level contrast, so it has no contrast column below. The score above is the harness's own, which averages every grader on the case, guards included; it is printed and not registered. The registered quantities are its grader groups, below.

### Contrasts — treatment minus control

| case | vs | Δ | registered direction | note |
|---|---|---|---|---|

The direction column is the sign registered before any run. It is a prediction, not a measurement, and it is typeset as a sign so it can never be read as one.

## Capability evidence

Single-arm: a replayed transcript carries the plugin into both arms, so these numbers have no referent outside themselves. They are description, not contrast, and nothing here may be averaged with the table above.

_No capability rows._

## Grader groups

The registered quantity for a case that carries no case-level contrast. A group is scored per run the way the harness scores a case — the weight of its graders that passed over the weight of its graders that were scored — and the mean is taken over runs, never over graders.

### `step4-seeded-defects` · group `reported`

| condition | score | runs | errored | excluded | refused | judge refused |
|---|---|---|---|---|---|---|
| treatment | 0.01 | 10 | 0 | 0 | 0 | 0 |
| placebo | 0.17 | 10 | 0 | 0 | 0 | 0 |
| run-oneliner | 0.00 | 10 | 0 | 0 | 0 | 0 |
| treatment-no-recon | 0.00 | 10 | 0 | 0 | 0 | 3 |
| none (per sweep) | 0.00 · 0.00 · 0.00 · 0.00 | 10 · 10 · 10 · 10 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 |

Runs present, runs that errored, runs excluded because a cost ceiling skipped their paid graders, runs whose kept trace named the fence, and runs with at least one judge call the API's safeguard refused. The first four are registered reported figures: an errored run counts and is not replaced, and a refused run counts and is not dropped. The fifth is Amendment 2: a refused judge call is not a verdict, so that grader leaves that run's denominator, and the count says how often.

Which graders the safeguard refused, and how many times. A refusal that falls on one defect's grader leans the score on that defect toward "not named":

- treatment-no-recon, with-arm: `reported-echo-bypass` ×3, `reported-url-decoded-path` ×1

| vs | Δ | registered direction | floor | none range | 2×SE | pooled SD | runs T | runs C | note |
|---|---|---|---|---|---|---|---|---|---|
| none | +0.01 | +1 | 0.01 | 0.00 | 0.01 | 0.01 | 10 | 40 |  |
| placebo | -0.16 | -1 | 0.05 | 0.00 | 0.05 | 0.05 | 10 | 10 |  |
| run-oneliner | +0.01 | 0 | 0.02 | 0.00 | 0.02 | 0.02 | 10 | 10 | at or below this contrast's floor |
| treatment-no-recon | +0.01 | -1 | 0.02 | 0.00 | 0.02 | 0.02 | 10 | 10 | at or below this contrast's floor |

The floor is per contrast: the larger of the range of the `none` means and 2 × the standard error of the contrast, with the standard deviation pooled over the two cells entering it. Both parts are printed so the floor can be recomputed rather than taken. A contrast at or below its own floor is published and marked, never a finding.

| condition | runs |
|---|---|
| treatment | 0.08 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| placebo | 0.08 · 0.17 · 0.25 · 0.08 · 0.17 · 0.25 · 0.25 · 0.17 · 0.08 · 0.17 |
| run-oneliner | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| treatment-no-recon | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| none (sweep 1) | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| none (sweep 2) | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| none (sweep 3) | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| none (sweep 4) | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |

### `step4-seeded-defects` · manipulation checks

Graders the case scored that no registered group names: the guards, and any grader that measures whether the run produced the observable at all. They are reported with their numbers and no held-or-failed verdict — they measure compliance with an instruction, which is a behaviour, and the trace they read includes the reply, so they are not independent of the group above.

| grader | treatment | placebo | run-oneliner | treatment-no-recon |
|---|---|---|---|---|
| `liveness-read` | 1.00 | 1.00 | 1.00 | 1.00 |
| `service-started` | 0.60 | 0.00 | 1.00 | 0.70 |
| `skill-fired` | 1.00 | 1.00 | 1.00 | 1.00 |

## Per-run scatter

Means are printed above; these are what they were taken from. A method that works two runs in three and one that works every time have the same mean.

| case | condition | runs |
|---|---|---|
| `step4-seeded-defects` | treatment | 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.07 · 0.07 · 0.07 · 0.14 · 0.14 |
| `step4-seeded-defects` | placebo | 0.14 · 0.21 · 0.29 · 0.14 · 0.21 · 0.29 · 0.29 · 0.21 · 0.14 · 0.21 |
| `step4-seeded-defects` | run-oneliner | 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 |
| `step4-seeded-defects` | treatment-no-recon | 0.14 · 0.07 · 0.07 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.07 |
| `step4-seeded-defects` | none (per sweep) | 0.07 · 0.07 · 0.07 · 0.06 |

## Advisories

- treatment: sweep exited 1 — a case scored below threshold, which is a result rather than a failure
- placebo: sweep exited 1 — a case scored below threshold, which is a result rather than a failure
- run-oneliner: sweep exited 1 — a case scored below threshold, which is a result rather than a failure
- treatment-no-recon: sweep exited 1 — a case scored below threshold, which is a result rather than a failure
- step4-seeded-defects: fence: treatment/with/1: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/2: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/3: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/4: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/5: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/6: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/7: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/8: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/9: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/with/10: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/1: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/2: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/3: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/4: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/5: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/6: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/7: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/8: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/9: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: treatment/without/10: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/1: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/2: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/3: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/4: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/5: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/6: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/7: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/8: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/9: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/with/10: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/1: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/2: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/3: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/4: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/5: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/6: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/7: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/8: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/9: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: placebo/without/10: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/1: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/2: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/3: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/4: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/5: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/6: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/7: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/8: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/9: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/with/10: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/1: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/2: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/3: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/4: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/5: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/6: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/7: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/8: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/9: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk
- step4-seeded-defects: fence: run-oneliner/without/10: verdict carried from the merge of 2026-09-07 (RESULTS-2026-09-07-defects.md: refused 0 in every cell), transcribed 2026-09-08 after the kept sandboxes had been deleted — the trace is no longer on disk

No combined score is emitted. Delta and capability evidence answer different questions, and a mean across them would answer neither.

---

# Reading the report

Everything above the line is the merger's output from the four records under
`records/2026-09-07-defects/` (three from 2026-09-07, `treatment-no-recon` from
2026-09-08). This is the owner's reading, written the same evening.

## The registered prediction

Amendment 1 registered treatment minus `treatment-no-recon` on the `reported` group as
**−1**: the treatment names fewer, because the run text is what turned the agent away
from the code the placebo reads.

| Contrast | Registered | Δ | Floor | Outcome |
|---|---|---|---|---|
| treatment vs treatment-no-recon | −1 | +0.01 | 0.02 | **not held**. Inside the floor. |

The cut agent named no planted defect in ten runs. Neither did the treatment in nine of
ten. The three original directions are unchanged; their records did not move.

## What the cut agent did

Every one of its ten with-arm runs built the spike on the seven markers, ran the test
suite, reverted, and stopped at gate 4 with "no defect surfaced". Seven of ten started
the standalone service as well (the treatment: six of ten; "run it" in one sentence: ten
of ten). Not one read the neighbourhood the way the placebo does. Mean turns 30 against
the treatment's 35.

So the twelve lines of step 4 are not what makes the primer's agent run rather than
read. With those lines cut, the step still says "recon", the deliverables line still
names step 4's artifact, and the agent at a cleared gate 3 with seven markers in the
source builds and runs the feature anyway. The reading that survives: an agent handed a
plan and marker sites implements them; the placebo's step 4 says "read the neighbourhood"
in so many words, and that is the only text in this suite that produced a read.

Put beside the first sweep: the primer, the primer without its recon text, and "run it"
in one sentence all name nothing, and no instruction at all names nothing. The only
instruction that names planted defects on this fixture is the one that says to read. The
text of step 4 neither helps nor, on this measure, costs anything.

## The judge safeguard, and Amendment 2

Under the rule as first registered, the first two attempts at this sweep were void: the
API's safeguard classifier refused the judge's input for `reported-echo-bypass` (and
once `reported-url-decoded-path`) on two runs of twenty-two. Amendment 2 made a refused
judge call unscored for that run instead of a throw. On the completed sweep the
classifier refused four calls on three runs, all in the with-arm, three of them on the
bypass grader.

**Hand check, as the amendment requires.** The three refused replies (runs 4, 5 and 10)
were read against the two criteria. None mentions a header, a bypass route, percent
encoding or path decoding; each is a step-4 recon report about the throttle. Under the
criteria all four refused verdicts would have been fails. So the refusals did not fall on
replies that named the defect, and the `reported` score of 0.00 is what a full set of
verdicts would have given. The classifier appears to be refusing on the criterion's own
text (an unofficial header that answers before any check runs, no identity required),
intermittently, whatever the reply says: the first sweep's 720 calls on identical
criteria had none.

## The fence verdicts for the first three records were carried, not re-read

The kept sandboxes of the 2026-09-07 sweeps were deleted at cleanup that evening, before
Amendment 1's re-merge was foreseen, and the harness report keeps no transcript. The
fence check (I9's second half, the `refused` column) needs the trace. Rather than re-run
three conditions to re-derive a count the 2026-09-07 merge had already published as zero
in every cell, the merger now archives every run's fence verdict after a merge that
passes (`fence-verdicts.json`, beside the records) and, when a trace is gone, carries the
archived verdict for the same record (matched on the sweep's start time and condition
digest), saying so in the advisories: sixty lines above read "verdict carried from the
merge of 2026-09-07". The archive for those three records was transcribed from the
committed 2026-09-07 results file, which is stated in its `from` field. The
`treatment-no-recon` verdicts were read from its traces.

## Incidents

Five attempts at one condition. Recorded in `sweep-log.md`:

1. 14:24, void: two safeguard refusals (rule as registered). About $2.
2. 14:33, void: two safeguard refusals in run 10 of the with-arm. About $9.
3. 15:40, under Amendment 2, void: the OAuth session expired on the last five runs of the
   without-arm. $11.12.
4. 17:27, void: the session limit at run 2. About $1.
5. 19:01, complete. $13.86, 75 minutes.

## Under the claim ceiling

Nothing here exceeds the registered ceiling. What this sweep adds to it: on this fixture,
removing the recon text from the primer changes nothing the `reported` score can see.
