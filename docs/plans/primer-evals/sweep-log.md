# Sweep log

Every harness run that spent money, in order, with what it bought. The raw records under
`results/` are gitignored and have been lost once (2026-09-03, with a worktree), so this
is the durable list. Costs are the harness's API-equivalent estimate.

| date | what | conditions | cost | outcome |
|---|---|---|---|---|
| 2026-08-31 | recon probe sweeps (five) | treatment | $0.28 | design facts, see `4-recon.md` |
| 2026-09-01 | first full sweep | treatment, oneliner, placebo | — | published, then **withdrawn** by Amendment 4 (instrument defects) |
| 2026-09-03 | re-sweep after Amendment 4 | treatment, oneliner, placebo | $27.07 | published, `RESULTS-2026-09-03.md`; raw records later deleted with the worktree |
| 2026-09-03 | step3 read, treatment only, 5 runs | treatment | $1.40 | not mergeable; `step3-read-2026-09-03.md`, led to Amendment 6 |
| 2026-09-03 | step3 smoke of Amendment 6, 1 run | treatment | $0.38 | case loads with 3 graders and cap 20; judge call hit API 529 |
| 2026-09-03 | full sweep after Amendments 5 and 6, started 16:00 | treatment (complete), oneliner (2 of 5 cases) | $11.37 | **aborted at 16:57**: the Opus judge returned `API Error: 529 Overloaded` on 35 of 45 treatment judge calls and 10 of 10 in the oneliner's first case. Both records are void under I1c. Nothing published. The runner now stops at the first thrown grader (7a004ec) |

| 2026-09-04 | runner smoke with the re-fetched 2.1.250 binary, 1 run | treatment | $0.59 | judge healthy again; pinned binary works |
| 2026-09-04 | full sweep, started 09:00 | treatment (1 case) | $2.87 | **aborted by the runner**: the smoke above was still writing into `results/` when this started, two new result directories appeared during one invocation, and the runner refused to attribute either. Operator error (the assistant's) |
| 2026-09-04 | full sweep, started 09:37 | treatment, oneliner, placebo | $26.76 | **published**, `RESULTS-2026-09-04.md`; records committed under `records/2026-09-04/` |

| 2026-09-04 | ablation 1, `treatment-no-triage`, started 14:01 | treatment-no-triage | $10.63 | **published**, `RESULTS-2026-09-04-no-triage.md`; merged against the three records above with nothing re-run; 3 of 4 registered zeros held, `looks-trivial-is-structural` −0.20 |

| 2026-09-04 | ablation 2, `treatment-no-failure-modes`, started 15:13 | treatment-no-failure-modes | $9.99 | **published**, `RESULTS-2026-09-04-no-failure-modes.md`; 4 of 4 registered zeros held |

| 2026-09-04 | ablation 3, `treatment-no-setup`, started 16:29 | treatment-no-setup (1 case + part) | $2.91 | **stopped by the runner** at the second case: the subscription usage limit was hit, 10 of 10 graders threw, the new thrown-grader stop ended it. Nothing published |
| 2026-09-05 | ablation 3 rerun, started 16:21 | treatment-no-setup | $9.68 | **published**, `RESULTS-2026-09-05-no-setup.md`; 2 of 4 held; `plan-exists` 4/5 → 0/5 as predicted but +0.09 inside the floor; `looks-trivial` −0.28 |

Six-condition suite total: **$57.06** of published sweeps.

| 2026-09-05 | Amendment 10 re-sweep, started 17:49 | treatment, placebo | $18.60 | **published**, `RESULTS-2026-09-05.md`; looks-trivial 0.72 → 0.88, gate-stop 0.94 → 1.00, guardrail intact; placebo looks-trivial 0.92 → 1.00 |

Published total: **$75.66**.

| 2026-09-05 | ablation 4, `treatment-no-recon`, started 19:55 | treatment-no-recon (3 cases) | $7.40 | **stopped by the runner**: session limit hit on the last judge call of the third case; nothing published |
| 2026-09-05 | ablation 4 restart, started 21:21 | treatment-no-recon | $9.67 | **published**, `RESULTS-2026-09-05-no-recon.md`; 2 of 4 held; `looks-trivial` +0.16 against a registered −1: the recon hypothesis is refuted |

Published total: **$85.33**.

## Pending

Nothing registered, and no further Tier 1 sweep on this fixture is planned: the
section-ablation work is closed (results section for ablation 4). Probe the judge first
before any future sweep:

```bash
CLAUDE_CODE_WALNUT_SPIRE=1 ~/.local/share/claude-pinned/2.1.250 -p "Reply with the single word ok." --model opus
```

Then, from a terminal with `CLAUDE_CONFIG_DIR` pointing at the logged-in directory:

```bash
EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 node scripts/run-evals.mjs --condition <ablation-id>
```

The runner will now stop a condition at the first thrown grader, so a judge outage costs
one case, not a sweep. Never run anything else against the suite while a sweep is going:
the runner attributes results by "exactly one new directory", and a concurrent smoke
voids the invocation it overlaps.
