# seven-steps-primer-defects — Tier 2 eval suite

This suite asks one question. The primer's step 4 says recon must be a run, not a read.
Does an agent with the primer loaded name more planted defects in a small service than an
agent with a same-shape placebo, an agent told in one sentence to run the service, and an
agent with no instruction at all?

It is a sibling of [`../seven-steps-primer/`](../seven-steps-primer/), not part of it.
That suite has its own registration and its own published records, and nothing here
touches either. Adding a case there would void every record it has.

The design is
[`docs/plans/primer-evals/defect-injection/0-plan.md`](../../docs/plans/primer-evals/defect-injection/0-plan.md).
What a real run found before anything was registered is
[`4-recon.md`](../../docs/plans/primer-evals/defect-injection/4-recon.md) beside it. The
predictions are in [`PRE-REGISTRATION.md`](PRE-REGISTRATION.md), committed before the
first sweep and never edited after it.

## Before you run it: the CLI version is pinned

Sweeps need `EVAL_CLAUDE_BIN` pointed at **2.1.250**, and that binary logged in under the
config directory the terminal uses. Keep the binary outside
`~/.local/share/claude/versions/`: the updater prunes that cache. The Tier 1 README has
the download and checksum steps, and they are the same here.

The runner refuses to sweep on any other 2.1.x patch it cannot verify, and refuses before
spending anything.

## How to run it

The sweep takes about ten hours. Run it from a terminal, not from a backgrounded task: a
task started by a session dies near thirty-five minutes.

```bash
EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 \
  node scripts/run-evals.mjs --suite evals/seven-steps-primer-defects \
    --keep-temp --max-cost-usd 30
```

- `--suite` picks this suite. Without it the runner sweeps the Tier 1 one.
- `--keep-temp` keeps every run's sandbox and its trace. The trace is where the fence
  check reads, and a kept sandbox is the only way to see what a run actually did. Sixty
  sandboxes need a few gigabytes. Delete them once the traces have been read.
- `--max-cost-usd` is a runaway guard for one invocation, not a budget. If it trips, the
  harness marks the document partial and the record is void. Set it well above what the
  invocation should cost — about twice the expected spend.

The run count comes from the registration (ten per condition, both arms), so there is no
`--runs` to pass. A smaller `--runs` is refused before the sweep starts, because a record
short of the registered count cannot be merged.

Then merge:

```bash
node scripts/merge-results.mjs evals/seven-steps-primer-defects/results
```

The merger refuses to write a report if any invariant fails. That is the point of it.

## The four columns

Three instruction texts are swept. Each sweep also produces a fourth column for free: the
harness runs every case twice, once with the text loaded and once with nothing loaded.

| Column | What it is | What it controls for |
|---|---|---|
| `treatment` | the shipped `SKILL.md`, generated from it and checked for drift | this is the thing being measured |
| `placebo` | the Tier 1 placebo, copied byte for byte: eight gates, same shape, a read-through at step 4 | this method against any method of this shape |
| `run-oneliner` | one sentence — *Run it for real before you call it done: start the service and exercise it.* | twelve lines of step 4 against one sentence that says run it |
| `none` | no instruction text; the without-arm of each sweep | the text existing at all |

The Tier 1 one-liner ("present a plan and wait for approval") is not a condition here. The
run starts at a cleared gate 3, so that instruction has nothing left to ask for. Keeping
it would buy a held prediction for nothing.

## What the numbers mean

**One case is scored.** `step4-seeded-defects` replays a hand-written conversation that
ends at a cleared gate 3, on a copy of the service with twelve defects planted in it. The
next turn is the case prompt. The reply is what gets graded.

**One score is registered.** Twelve `reported-<id>` graders, one per planted defect, each
asking a judge whether the reply identifies that defect — by what goes wrong, by its
cause, or by the effect a client sees. Any one of the three counts. The registered number
is the fraction of the twelve that passed, per run. That is the `reported` group.

**The harness's own case score is printed and not registered.** It averages all fourteen
graders on the case, guards included, so it mixes what is being measured with the checks
that the run happened at all. The report prints it with a note saying so and never
contrasts it.

**A contrast is only worth the floor it clears.** Each contrast — treatment minus a
control — carries its own floor, and the report prints the parts the floor was built
from so a reader can recompute it:

- the range of the three `none` means, which is the Tier 1 rule;
- twice the standard error of that contrast, with the run-to-run spread pooled over the
  two columns being compared;
- the floor is the larger of the two.

A contrast at or below its floor is published and marked. It is never called a finding
and never hidden. If a floor comes out at or below 1e-9 it is not a measurement of noise
at all, and the group is marked **unmeasurable**: the scores stand, and no difference
between them is published as a number.

**Four counts are printed beside every score**, per condition and per arm:

- runs present — the registration promises ten, and this says how many there were;
- runs that errored — a run that timed out, hit the turn cap, or died on a session limit
  still counts. On a case that scores what a reply names, such a run reads as "found
  nothing", so the count is on the page rather than buried in the mean;
- runs excluded — a run whose paid graders a cost ceiling skipped is left out of the
  score rather than scored zero;
- runs refused — a run whose trace named the defect ledger, the shipped skill, or the
  Tier 1 fixture. It is counted and flagged, never dropped. Dropping it would bias the
  sample toward incurious agents.

**Two guards and one monitor are reported apart, with no verdict.** `liveness-read` says
the run opened the service at all. `service-started` says it started the service, in
either of the two shapes a real run used. `skill-fired` counts attempted Skill calls in
the with-arm only. None of them is part of the registered score.

## The claim ceiling

This is the strongest sentence this suite's numbers may be used to say. It was written
before the first sweep, it is registered in `PRE-REGISTRATION.md`, and a check in the test
suite (I3) fails if this README stops quoting it word for word.

> Gates 0 to 3 are already cleared on a plan the agent did not write. From there, on this fixture, the primer's step 4 was predicted to name fewer of the planted defects than the same-shape placebo's read-through, as many as a one-sentence instruction to run the service, and more than no instruction. This holds for one fixture, one feature and twelve planted defects that three cold readers could each see, and says nothing about whether the software that comes out is better.

The direction against the placebo is registered as **−1**: the treatment is predicted to
do worse. That is not modesty. It is what the evidence said before any sweep ran, and
registering it against the method's own interest is the only way a later result can be a
finding either way. If it comes out positive, the prediction missed and the method gained
something the evidence did not expect. If it holds, that is a finding about the method.
Both get published.

## What the numbers do not mean

**Nothing about a defect that a run reveals and a read does not.** That class is what this
experiment was first designed around, and it turned out to be empty on a service this
size: three cold readers, each shown one defect in an otherwise clean 300-line service,
named it in 34 of 36 reads. Every planted defect here is one a careful reader can see. The
finding that the class could not be certified is published in `4-recon.md`, and it is the
reason the design changed before any money was spent on a sweep.

**Nothing about whether the software that comes out is better.** No grader here reads the
code the run wrote. The score is what the reply names.

**Nothing that transfers off this fixture.** One service, one feature, twelve defects.

**Nothing about a full run of the method.** Gates 0 to 3 are already cleared by a
transcript the agent did not write. What is measured is one step, from a position handed
to it.

## Where the instrument is weak

Stated here rather than left for a reader to find.

**The `none` column is weaker than Tier 1's.** Its agent has no instruction text, but it
does have a gated transcript. Tier 1's `none` had neither. The `none` column exists here
mainly because the floor is measured from it. A held `+1` against it is not counted among
the method's claims.

**The conditions run at different points.** The treatment builds the feature first and
then runs it. The one-liner may run the service before touching anything. The placebo
reads. So the program state at the moment of running differs between conditions. That is
a known confound, and nothing here removes it.

**The reference implementation is one implementation.** Every defect had to survive a
per-user rate-limiting implementation being applied on top of it, or the treatment's own
build would delete the defect before the service started. One implementation was written
and used as the test. It bounds that risk rather than removing it.

**The defect designer's brief names the distinction the experiment measures.** It asked
for defects a reader would not notice and defects a reader would. No check can catch a
brief that states the hypothesis in plain words, and the vocabulary check (I10) is
lexical, so it does not. This was accepted knowingly at gate 0 and is recorded in the
plan.

**Some fixture state was written by someone who has read the method.** The transcript, the
markers in the source, the run one-liner and the port change. All of it is identical
across the four columns, so it cannot favour one, but it is not blind.

**A judge scores the replies.** Every criterion was written by an agent that never saw the
source or the patch, and every one was probed offline against five hand-written replies:
two that must pass, three that must fail, one of them the neighbouring defect's reply.
After the sweep, thirty verdicts are labelled by hand — with the condition and the
verdict stripped — before the merged table is read, and the agreement is published.

## Results

One sweep, 2026-09-07, three conditions, ten runs per arm, no errored, excluded or
refused runs:
[`docs/plans/primer-evals/RESULTS-2026-09-07-defects.md`](../../docs/plans/primer-evals/RESULTS-2026-09-07-defects.md).
The records are under `docs/plans/primer-evals/records/2026-09-07-defects/`. Of the three
registered directions, two held (fewer than the placebo; no different from the one-liner)
and one did not (more than no instruction: the difference is inside its floor).

A second sweep, 2026-09-08, added `treatment-no-recon` (Amendment 1: the primer minus
the twelve lines that say recon is a run):
[`RESULTS-2026-09-08-defects-no-recon.md`](../../docs/plans/primer-evals/RESULTS-2026-09-08-defects-no-recon.md).
Registered −1, not held: the cut agent ran the feature and named nothing, like the
treatment. Amendment 2 (a judge call the API's safeguard refuses is unscored, not
failed) was needed to complete it.

## What is here

```
PRE-REGISTRATION.md          the registered predictions, digested; edits void a report
conditions/
  treatment/SKILL.md         generated from skills/seven-steps-primer/SKILL.md
  placebo/SKILL.md           copied byte for byte from the Tier 1 suite, drift-checked
  run-oneliner/SKILL.md      authored; one sentence
fixtures/notesvc-seeded/     the service, with markers placed and twelve defects planted
  defects/<id>/              the ledger: the patch, the signal, a detection script, the
                             description, the cause, the criterion, four probe replies,
                             the nearest neighbour, and both reviewer tallies.
                             Withheld from the workspace. It holds the answers.
step4-seeded-defects/        the scored case: the transcript, the prompt, the graders
step4-read-only/             a diagnostic, tagged control: the same case with Bash, Write
                             and Edit not granted. Excluded from every sweep; run by hand
results/                     gitignored; sweep records land here
```

The conditions are regenerated and checked by `node scripts/build-conditions.mjs`, which
walks both suites. The suite's own self-tests are in `scripts/test/`, and
`node --test scripts/test/*.test.mjs` runs them: the grader probes, the fixture's health,
the detection scripts against the seeded, clean and implemented copies of the service, and
the vocabulary check over every file an isolated agent wrote.
