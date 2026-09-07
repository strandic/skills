# Condition comparison

**Subject** `sonnet` · **judge** `opus` · **CLI** `2.1.250` · **runs/case** 10 · **started** 2026-09-07T12:08:48.904Z

**Suite** `3751eae386e454702816b9efb4d27c7311a15a1f` · **pre-registration** `643a63f2dc12422cb3d4bb085536a387a6ea0219e972ee191912ca170fbd69db` · **instrument** `3572841ebaac` · **cost** ~$37.93 API-equivalent (subscription-metered; no money moved)

**Conditions** treatment `503291b82253` · placebo `0ddcff104f11` · run-oneliner `fb85d01885a6` — each condition's own digest; the instrument above is everything the conditions share.

**Noise floor — unmeasured.** The worst per-case spread between the stock-Claude columns the sweeps produced against identical cases. A contrast at or below this floor (|Δ| <= floor + 1e-9) is not a finding, and every one of them is marked. A contrast that ties the floor is inside it: the floor is the smallest difference this instrument resolves, so a difference equal to it resolves nothing. The tolerance is there because a contrast and the floor are means of the same fractions summed in different orders, so a mathematical tie lands one unit in the last place either side.

## Delta evidence

| case | treatment | placebo | run-oneliner | none |
|---|---|---|---|---|
| `step4-seeded-defects` | 0.12 | 0.21 | 0.14 | 0.07 |

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

| condition | score | runs | errored | excluded | refused |
|---|---|---|---|---|---|
| treatment | 0.01 | 10 | 0 | 0 | 0 |
| placebo | 0.17 | 10 | 0 | 0 | 0 |
| run-oneliner | 0.00 | 10 | 0 | 0 | 0 |
| none (per sweep) | 0.00 · 0.00 · 0.00 | 10 · 10 · 10 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |

Runs present, runs that errored, runs excluded because a cost ceiling skipped their paid graders, and runs whose kept trace named the fence. All four are registered reported figures: an errored run counts and is not replaced, and a refused run counts and is not dropped.

| vs | Δ | registered direction | floor | none range | 2×SE | pooled SD | runs T | runs C | note |
|---|---|---|---|---|---|---|---|---|---|
| none | +0.01 | +1 | 0.01 | 0.00 | 0.01 | 0.01 | 10 | 30 | at or below this contrast's floor |
| placebo | -0.16 | -1 | 0.05 | 0.00 | 0.05 | 0.05 | 10 | 10 |  |
| run-oneliner | +0.01 | 0 | 0.02 | 0.00 | 0.02 | 0.02 | 10 | 10 | at or below this contrast's floor |

The floor is per contrast: the larger of the range of the `none` means and 2 × the standard error of the contrast, with the standard deviation pooled over the two cells entering it. Both parts are printed so the floor can be recomputed rather than taken. A contrast at or below its own floor is published and marked, never a finding.

| condition | runs |
|---|---|
| treatment | 0.08 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| placebo | 0.08 · 0.17 · 0.25 · 0.08 · 0.17 · 0.25 · 0.25 · 0.17 · 0.08 · 0.17 |
| run-oneliner | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| none (sweep 1) | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| none (sweep 2) | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |
| none (sweep 3) | 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 · 0.00 |

### `step4-seeded-defects` · manipulation checks

Graders the case scored that no registered group names: the guards, and any grader that measures whether the run produced the observable at all. They are reported with their numbers and no held-or-failed verdict — they measure compliance with an instruction, which is a behaviour, and the trace they read includes the reply, so they are not independent of the group above.

| grader | treatment | placebo | run-oneliner |
|---|---|---|---|
| `liveness-read` | 1.00 | 1.00 | 1.00 |
| `service-started` | 0.60 | 0.00 | 1.00 |
| `skill-fired` | 1.00 | 1.00 | 1.00 |

## Per-run scatter

Means are printed above; these are what they were taken from. A method that works two runs in three and one that works every time have the same mean.

| case | condition | runs |
|---|---|---|
| `step4-seeded-defects` | treatment | 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.07 · 0.07 · 0.07 · 0.14 · 0.14 |
| `step4-seeded-defects` | placebo | 0.14 · 0.21 · 0.29 · 0.14 · 0.21 · 0.29 · 0.29 · 0.21 · 0.14 · 0.21 |
| `step4-seeded-defects` | run-oneliner | 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 · 0.14 |
| `step4-seeded-defects` | none (per sweep) | 0.07 · 0.07 · 0.07 |

## Advisories

- treatment: sweep exited 1 — a case scored below threshold, which is a result rather than a failure
- placebo: sweep exited 1 — a case scored below threshold, which is a result rather than a failure
- run-oneliner: sweep exited 1 — a case scored below threshold, which is a result rather than a failure

No combined score is emitted. Delta and capability evidence answer different questions, and a mean across them would answer neither.

---

# Reading the report

Everything above this line is the merger's output, written from the three records under
`records/2026-09-07-defects/` at suite `3751eae`, and rewritable from them. Everything
below is the owner's reading, written the same day.

## The three registered predictions

The registered quantity is the `reported` group: the fraction of the twelve planted
defects a reply names, per run, averaged over ten runs.

| Contrast | Registered | Δ | Floor | Outcome |
|---|---|---|---|---|
| treatment vs placebo | −1 (treatment names fewer) | −0.16 | 0.05 | **held**. Three times the floor. |
| treatment vs run-oneliner | 0 (no difference) | +0.01 | 0.02 | **held**. Inside the floor, as registered. |
| treatment vs none | +1 (treatment names more) | +0.01 | 0.01 | **not held**. Inside the floor. The treatment did not name more than no instruction at all. |

Two of three registered directions held. The one that did not is the one the method's
own case rests on: given the text, the agent named no more planted defects than stock
Claude given nothing.

## What the runs did

| | treatment | placebo | run-oneliner | none |
|---|---|---|---|---|
| runs that started the service | 6 of 10 | 0 of 10 | 10 of 10 | 0 of 30 |
| runs that named at least one defect | 1 of 10 | 10 of 10 | 0 of 10 | 0 of 30 |
| defects named, total over ten runs | 1 | 20 | 0 | 0 |
| turns per run, mean | 35 | 16 | 25 | 22 |

Every run that started the service named nothing. The one treatment run that named a
defect was one of the four that did not start it. The placebo never started the service
and named between one and three defects in every run. The one-liner started it every
time and named nothing.

The treatment's with-arm runs did what the primer's step 4 says: they built the per-user
limiter as a spike on the seven markers, ran it (six started the standalone service and
drove it with real requests; the other four ran the test suite and in-process probes),
reported on the plan, reverted, and stopped at gate 4. Eight of ten reported that no
defect surfaced against the plan, the types or the signatures. One found a drift in its
own spike and one found the `resetsAt` type mismatch the confirmation run had found, and
both corrected their own documents. All of that is about the feature's path. The planted
defects sit in the body parser, the error handler, the store's owner filter and the
router, beside the feature and not on its path. A run exercises the path. A read covers
the neighbourhood.

Which defects were named, over ten with-arm runs per condition:

| defect | treatment | placebo | run-oneliner |
|---|---|---|---|
| body-limit-too-small | 0 | 9 | 0 |
| owner-case-folded | 0 | 5 | 0 |
| owner-prefix-leak | 1 | 3 | 0 |
| body-buffer-shared | 0 | 2 | 0 |
| echo-bypass | 0 | 1 | 0 |
| the other seven | 0 | 0 | 0 |

The placebo names the defects that sit in the two files its read-through opens for the
feature, `src/middleware/index.js` and `src/store.js`, and calls them "pre-existing
issues in the neighbourhood, staying untouched". Nothing in `src/routes/notes.js` or the
error handler was named by anyone.

## The guards and the fence

- `liveness-read` passed in every run of every arm.
- `skill-fired` passed in every with-arm run: the text was loaded every time.
- `service-started` is in the table above. It is a monitor, not a score.
- **Refused runs: 0.** No kept trace named the ledger, the shipped skill, or the Tier 1
  fixture. The placebo run recon flagged (a `find /` that listed the shipped skill) did
  not recur.
- Errored runs: 0 of 60. Excluded runs: 0. Every record carries ten runs per arm.

## The claim ceiling, and what these numbers say under it

Registered before the sweep:

> Gates 0 to 3 are already cleared on a plan the agent did not write. From there, on this fixture, the primer's step 4 was predicted to name fewer of the planted defects than the same-shape placebo's read-through, as many as a one-sentence instruction to run the service, and more than no instruction. This holds for one fixture, one feature and twelve planted defects that three cold readers could each see, and says nothing about whether the software that comes out is better.

What the numbers say, and no more: on this fixture, the primer's step 4 names fewer
planted defects than the placebo's read-through, as many as a one-sentence instruction
to run the service, and as many as no instruction. The prediction that it would beat no
instruction was wrong. Twelve read-visible defects beside the feature's path are found
by reading beside the path, and neither the primer's run nor the one-liner's run reads
there. Nothing here says the run finds nothing: two treatment runs found real defects in the
agent's own plan by running it, and no without-arm run found one. Those are not planted
defects, so they are not scored. That asymmetry is what recon predicted at gate 4, and
the sweep confirms it.

## Incidents

- The first `run-oneliner` sweep hit the session limit at its first run
  (2026-09-07 16:44, $0.28, seven runs recorded as errors). Void under I1c. Re-run whole
  at 17:38, complete at 18:41, $11.47.
- All three sweeps exited 1. The harness exits 1 when a case scores below the threshold,
  which every run of every condition did. The merger records it as a result.
- Cost: $37.93 for the three records, $0.28 for the void attempt, $2.89 for the two
  confirmation runs. Subscription-metered.

## Confirmation runs

Recorded in `defect-injection/7-runbook.md`, "What happened". Both conditions did on the
final transcript what recon saw them do.

## Human agreement on the judge

Thirty `reported-*` verdicts were drawn at random across the three with-arm records
(seed 20260907, pool of 360), and written to `defect-injection/7-verdicts-blind.md` with
condition and verdict stripped. The judge passed one of the thirty, which is the base
rate: 20 passes in 360. A supplementary sheet, not registered, holds the other nineteen
passes and ten more fails, so the judge's passes can be checked at all
(`7-verdicts-supplementary-blind.md`).

**Protocol note.** The registration says the labels are taken before the merged table is
read. The labeller had not read the table, but the session reported the three group
means to them in a message before the sheets were drawn. The sheets carry no condition,
so a mean cannot be mapped to a verdict; the order is still recorded here as broken.

*Labels: pending.*

## The read-only diagnostic

`step4-read-only` is the scored case with Bash, Write and Edit not granted, tagged out of
every sweep. It was run by hand under the treatment on 2026-09-07 at 20:47, five runs per
arm, from a copy of the suite (`evals/diag-read-only/`, deleted afterwards) with the
transcript and the twelve `reported-*` graders generated from the ledger added, so the
suite's own instrument digest did not move. Cost $3.58, 22 minutes, no errors. The
harness record is `records/2026-09-07-defects/diagnostic-step4-read-only.json`.

| arm | runs | named a defect | what every run did |
|---|---|---|---|
| with (treatment) | 5 | 0 of 5 | loaded the skill, tried to write the spike or run the tests, was denied, and stopped: "an environment that blocks the run is itself a finding, not license to fall back to reading the source". Each asks the human for the grant or a narrower task. |
| without | 5 | 0 of 5 | tried to write the implementation, was denied, and stopped, offering the diffs as text. |

This is the one comparison that varies running while holding the text fixed, and it
answers a different question from the one it was built for. Denied the run, the
treatment does not read instead: the primer says inspection is not recon, and the agent
obeys that to the letter, so it names nothing either way. The placebo's read-through is
what names defects on this fixture, and the primer's step 4 has no read-through in it.
Nothing here is a contrast against the sweep: a different tool grant is a different
case.

## Where the numbers stop

- One fixture, one feature, twelve planted defects that three cold readers could each
  see. No defect here was run-only, so nothing here measures the class the experiment
  was designed for.
- The `reported` score is a judge's verdict on a reply. The agreement figures above
  bound it.
- Sixty runs at temperature the harness sets, one model as subject, one as judge.
- The one-liner and the primer both ran and both named nothing; the placebo read and
  named one to three. Whether a method that reads *and* runs would name more is not
  measured here.
