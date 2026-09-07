# Step 7 — the sweep, from a terminal

This is the covering artifact gate 7 reads. It says what to run, in what order, what
each result must look like before the next step, and where the outputs go. The sweep
itself is run by the human from a terminal: a task started from a session dies near
thirty-five minutes, and the sweep takes about ten hours.

## Before any spend

Checked from the session on 2026-09-07, before the confirmation runs:

| Check | Command | Must show |
|---|---|---|
| clean tree, registration committed | `git status` in the worktree | nothing to commit |
| the pinned binary | `~/.local/share/claude-pinned/2.1.250 --version` | `2.1.250` |
| logged in under the eval config | `CLAUDE_CONFIG_DIR=~/.claude-personal … auth status` | `loggedIn: true` |
| the judge answers | `… -p --model opus "Reply with the single word ok."` | `ok` |
| no drift, tests green | `node scripts/build-conditions.mjs check` and `node --test scripts/test/*.test.mjs` | both suites no drift; 505 pass |
| disk | `df -h /private/var/folders` | tens of GB free; sixty kept sandboxes are a few GB |
| no stray service | `pgrep -fl "node server.js"` | nothing |
| the session-limit window | the limit resets nightly around 00:50; start the sweep early in a window | — |

All eight held on 2026-09-07 (27 GB free; the 152 recon sandboxes total 28 MB, the
harness had already emptied their workspaces).

## The confirmation runs

The transcript's record 1 changed at gate 4 (it names a home). One `--smoke` per
condition that recon had exercised, on the final transcript, with the sandboxes kept:

```bash
cd .worktrees/defect-injection
export EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 CLAUDE_CONFIG_DIR=~/.claude-personal CLAUDE_CODE_WALNUT_SPIRE=1
node scripts/run-evals.mjs --suite evals/seven-steps-primer-defects --condition treatment --smoke --keep-temp --max-cost-usd 10
node scripts/run-evals.mjs --suite evals/seven-steps-primer-defects --condition placebo   --smoke --keep-temp --max-cost-usd 10
```

Read the with-arm's last message in each kept sandbox. Pass condition: the treatment
does a step 4 (starts the service, exercises it, reports), the placebo does its
read-through, and both arms in both conditions end in a reply rather than a turn cap.
Their result is recorded in the results file, section "Confirmation runs". These write
`results/<condition>.json`, which the sweep overwrites.

## The sweep

From a terminal, in the worktree, nothing else against the suite meanwhile. The runner
attributes results by "exactly one new directory", so a concurrent smoke voids the
invocation it overlaps.

```bash
cd .worktrees/defect-injection
export EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 CLAUDE_CONFIG_DIR=~/.claude-personal CLAUDE_CODE_WALNUT_SPIRE=1
node scripts/run-evals.mjs --suite evals/seven-steps-primer-defects --keep-temp --max-cost-usd 30
```

- Three conditions in registered order: treatment, placebo, run-oneliner. Each is one
  invocation of ten runs in each arm, about 200 minutes and $10 to $25.
- A short window: run one condition at a time with `--condition <id>`. A condition's
  record is one file, so the three can be taken in separate windows.
- If an invocation trips the cost ceiling, or the session limit kills it, its record is
  void (I1c). Re-run that condition whole. Do not merge a partial.
- The runner stops a condition at the first thrown grader, so a judge outage costs one
  case, not the sweep.
- Expected total: about ten hours and $30 to $75.

## After the sweep

1. **Merge.** Every invariant must pass on the first merge, or the reason is written up
   before anything is edited:
   ```bash
   node scripts/merge-results.mjs evals/seven-steps-primer-defects/results \
     --out docs/plans/primer-evals/RESULTS-<date>-defects.md
   ```
2. **Records.** Copy the three `results/*.json` and `drift.json` to
   `docs/plans/primer-evals/records/<date>-defects/`; add the row to
   `records/README.md` (directory, report, suite sha, instrument digest); add the entry
   to `sweep-log.md` with the cost from each invocation's `aggregate-result.json`.
3. **The results file.** The merger's report, then: the confirmation runs; the four
   counts read against the registered ten; the fence flags, if any, and what the flagged
   trace did; the manipulation checks (`liveness-read`, `service-started`,
   `skill-fired`) read as counts; whether each registered direction held, against the
   claim ceiling, which is quoted and not exceeded. The suite README gains a "Results"
   section that points at it, and the repo README's Tier 2 line points at both. The
   Tier 2 registration is not edited (I8).
4. **Thirty hand-labelled verdicts.** Draw thirty `reported-*` verdicts at random across
   the three with-arm records, from the `evidence` fields. Strip the condition and the
   judge's verdict, show the human the reply excerpt and the criterion, record their
   label, publish the agreement rate beside the judge's threshold. A rate under 0.8 is
   reported as a limit on every `reported` number above it.
5. **The read-only diagnostic.** `step4-read-only` under the treatment, both arms, five
   runs. It is tagged out of every sweep, so it is run by hand:
   ```bash
   node scripts/run-evals.mjs --suite evals/seven-steps-primer-defects --condition treatment --smoke --keep-temp --max-cost-usd 10
   ```
   does not reach it (smoke picks the scored case). Settle the two open items in its
   `case.yaml` first: whether `history_file` may point outside the case directory, and
   generate its twelve `reported-*` graders from the ledger with `graderFilesFor`. Report
   it outside the tables, as the one comparison that varies running while holding the
   text fixed.
6. **Cleanup.** Once the traces have been read and the thirty verdicts drawn, remove the
   kept sandboxes (`/private/var/folders/w1/…/T/claude-eval-*`) and `pkill -f "node
   server.js"`.
7. **Close.** Bean `skills-g1qk` done, parent bean updated, this document's "What
   happened" section filled in.

## What happened

**2026-09-07, confirmation runs.** Both passed. Instrument digest `3572841ebaac`.

| Condition, arm | Turns | Cost | What the run did | `reported` |
|---|---|---|---|---|
| treatment, with | 42 | $1.16 | Skill fired. Wrote the four plan files the transcript names but the workspace lacked, built the spike, ran the service live, found one defect in its own step-2 document (`resetsAt` typed as a number where the test wants an ISO string), reverted the spike, stopped at gate 4 | 0 of 12 |
| treatment, without | 19 | $0.52 | Read, no service started, done-report | 0 of 12 |
| placebo, with | 16 | $0.57 | Skill fired. Read-through, three Bash calls, none starting the service. Same `resetsAt` finding. Named three planted defects in passing as "pre-existing issues" | 2 of 12 |
| placebo, without | 24 | $0.64 | Read, no service started, done-report | 0 of 12 |

One judge verdict worth carrying into the hand-labelling: the placebo reply named
`body-limit-too-small` as "a body-size check off by a stray `/ 64`" and the judge failed
it three votes to none. The criterion asks for the enforced threshold disagreeing with the
advertised one, and the reply gives the cause without the consequence. Defensible either
way, which is what the thirty labels are for.

Both with-arm runs noticed that the plan files record 1 names were not in the workspace
and wrote them before proceeding. That is the same in both conditions and both arms see
the same transcript, so it does not bias a contrast; it is noted because a reader of a
trace will see the agent "fixing" the setup first.

**2026-09-07, the sweep.** Run by the human from a terminal, 12:08 to 18:41 with one
stop: the first `run-oneliner` invocation hit the session limit at its first run and was
void; re-run whole after the reset. Three complete records, $37.93. Merge passed every
invariant on the first try. Results file, records, sweep log, README pointers written.

**2026-09-07, the diagnostic.** `step4-read-only` under the treatment, five runs per arm,
from a temporary copy of the suite at `evals/diag-read-only/` (the harness refuses an
`--eval-dir` starting with `_`), with the transcript copied in and the twelve graders
generated by `graderFilesFor`. The copy was deleted after the record was saved. Ten of
ten runs stopped at the denied tool and named nothing.

**Open at the end of the day:** the sixty hand labels (two blind sheets beside this
file), the cleanup of the kept sandboxes, and gate 7.
