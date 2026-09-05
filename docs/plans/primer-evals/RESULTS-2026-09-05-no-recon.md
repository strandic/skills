# Condition comparison

**Subject** `sonnet` · **judge** `opus` · **CLI** `2.1.250` · **runs/case** 5 · **started** 2026-09-04T08:23:22.354Z

**Suite** `78aa56b714ed9a8870c1941c14f0fd42be8245f0` · **pre-registration** `a9653cd164396eab8e48d895f20e6c89479306ec95b8544cb8cf2db278b5ca21` · **instrument** `a21420ccf879` · **cost** ~$36.32 API-equivalent (subscription-metered; no money moved)

**Conditions** treatment `503291b82253` · oneliner `69937f816b3e` · placebo `0ddcff104f11` · treatment-no-recon `4e6a35a2381b` — each condition's own digest; the instrument above is everything the conditions share.

**Noise floor — 0.08.** The worst per-case spread between the stock-Claude columns the sweeps produced against identical cases. A contrast at or below this floor (|Δ| <= floor + 1e-9) is not a finding, and every one of them is marked. A contrast that ties the floor is inside it: the floor is the smallest difference this instrument resolves, so a difference equal to it resolves nothing. The tolerance is there because a contrast and the floor are means of the same fractions summed in different orders, so a mathematical tie lands one unit in the last place either side.

## Delta evidence

| case | treatment | oneliner | placebo | treatment-no-recon | none |
|---|---|---|---|---|---|
| `gate-stop-step0` | 1.00 | 0.77 | 0.94 | 0.91 | 0.29 |
| `looks-trivial-is-structural` | 0.88 | 0.80 | 1.00 | 0.72 | 0.36 |
| `triage-skip-oneliner` | 1.00 | 0.33 | 1.00 | 1.00 | 1.00 |
| `triage-decompose-epic` | 0.73 | 0.67 | 0.73 | 0.73 | 0.50 |

The `none` column is stock Claude Code, measured once per sweep against identical cases and averaged here. The averaging is only for this cell — the columns themselves are kept apart below, because their spread is the noise floor.

### Contrasts — treatment minus control

| case | vs | Δ | registered direction | note |
|---|---|---|---|---|
| `gate-stop-step0` | none | +0.71 | +1 |  |
| `gate-stop-step0` | oneliner | +0.23 | +1 |  |
| `gate-stop-step0` | placebo | +0.06 | 0 | at or below the noise floor |
| `gate-stop-step0` | treatment-no-recon | +0.09 | 0 |  |
| `looks-trivial-is-structural` | none | +0.52 | +1 |  |
| `looks-trivial-is-structural` | oneliner | +0.08 | +1 | at or below the noise floor |
| `looks-trivial-is-structural` | placebo | -0.12 | +1 |  |
| `looks-trivial-is-structural` | treatment-no-recon | +0.16 | -1 |  |
| `triage-skip-oneliner` | none | +0.00 | 0 | at or below the noise floor |
| `triage-skip-oneliner` | oneliner | +0.67 | 0 |  |
| `triage-skip-oneliner` | placebo | +0.00 | 0 | at or below the noise floor |
| `triage-skip-oneliner` | treatment-no-recon | +0.00 | 0 | at or below the noise floor |
| `triage-decompose-epic` | none | +0.23 | +1 |  |
| `triage-decompose-epic` | oneliner | +0.07 | +1 | at or below the noise floor |
| `triage-decompose-epic` | placebo | +0.00 | +1 | at or below the noise floor |
| `triage-decompose-epic` | treatment-no-recon | +0.00 | 0 | at or below the noise floor |

The direction column is the sign registered before any run. It is a prediction, not a measurement, and it is typeset as a sign so it can never be read as one.

## Capability evidence

Single-arm: a replayed transcript carries the plugin into both arms, so these numbers have no referent outside themselves. They are description, not contrast, and nothing here may be averaged with the table above.

| case | treatment | oneliner | placebo | treatment-no-recon |
|---|---|---|---|---|
| `step3-markers-in-source` | 0.93 | 0.00 | 0.00 | 1.00 |

## Per-run scatter

Means are printed above; these are what they were taken from. A method that works two runs in three and one that works every time have the same mean.

| case | condition | runs |
|---|---|---|
| `gate-stop-step0` | treatment | 1.00 · 1.00 · 1.00 · 1.00 · 1.00 |
| `gate-stop-step0` | oneliner | 0.71 · 0.71 · 0.86 · 0.86 · 0.71 |
| `gate-stop-step0` | placebo | 0.86 · 1.00 · 0.86 · 1.00 · 1.00 |
| `gate-stop-step0` | treatment-no-recon | 0.86 · 1.00 · 1.00 · 0.86 · 0.86 |
| `gate-stop-step0` | none (per sweep) | 0.29 · 0.29 · 0.31 · 0.29 |
| `looks-trivial-is-structural` | treatment | 1.00 · 1.00 · 0.40 · 1.00 · 1.00 |
| `looks-trivial-is-structural` | oneliner | 0.80 · 0.80 · 0.80 · 0.80 · 0.80 |
| `looks-trivial-is-structural` | placebo | 1.00 · 1.00 · 1.00 · 1.00 · 1.00 |
| `looks-trivial-is-structural` | treatment-no-recon | 0.60 · 0.80 · 1.00 · 1.00 · 0.20 |
| `looks-trivial-is-structural` | none (per sweep) | 0.36 · 0.40 · 0.32 · 0.36 |
| `triage-skip-oneliner` | treatment | 1.00 · 1.00 · 1.00 · 1.00 · 1.00 |
| `triage-skip-oneliner` | oneliner | 0.33 · 0.33 · 0.33 · 0.33 · 0.33 |
| `triage-skip-oneliner` | placebo | 1.00 · 1.00 · 1.00 · 1.00 · 1.00 |
| `triage-skip-oneliner` | treatment-no-recon | 1.00 · 1.00 · 1.00 · 1.00 · 1.00 |
| `triage-skip-oneliner` | none (per sweep) | 1.00 · 1.00 · 1.00 · 1.00 |
| `triage-decompose-epic` | treatment | 0.67 · 0.67 · 0.67 · 0.67 · 1.00 |
| `triage-decompose-epic` | oneliner | 1.00 · 0.67 · 0.33 · 1.00 · 0.33 |
| `triage-decompose-epic` | placebo | 0.67 · 0.67 · 0.67 · 1.00 · 0.67 |
| `triage-decompose-epic` | treatment-no-recon | 0.67 · 0.67 · 0.67 · 0.67 · 1.00 |
| `triage-decompose-epic` | none (per sweep) | 0.53 · 0.47 · 0.53 · 0.47 |
| `step3-markers-in-source` | treatment | 0.67 · 1.00 · 1.00 · 1.00 · 1.00 |
| `step3-markers-in-source` | oneliner | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| `step3-markers-in-source` | placebo | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| `step3-markers-in-source` | treatment-no-recon | 1.00 · 1.00 · 1.00 · 1.00 · 1.00 |

## Advisories

- oneliner: sweep exited 1 — a case scored below threshold, which is a result rather than a failure
- placebo: sweep exited 1 — a case scored below threshold, which is a result rather than a failure

No combined score is emitted. Delta and capability evidence answer different questions, and a mean across them would answer neither.
