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

## Pending

Nothing. The next paid runs are the section-ablation conditions (bean skills-fqdf), one
sweep each, merged against the 2026-09-04 records. Probe the judge first:

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
