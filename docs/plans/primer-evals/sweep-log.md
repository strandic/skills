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

## Pending

One full sweep of the three registered conditions, about $27, once the judge model is
healthy. Probe first:

```bash
CLAUDE_CODE_WALNUT_SPIRE=1 ~/.local/share/claude-pinned/2.1.250 -p "Reply with the single word ok." --model opus
```

Then, from a terminal with `CLAUDE_CONFIG_DIR` pointing at the logged-in directory:

```bash
EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 node scripts/run-evals.mjs
```

The runner will now stop a condition at the first thrown grader, so a judge outage costs
one case, not a sweep.
