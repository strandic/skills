# Pre-registration — `seven-steps-primer-defects`, Tier 2 experiment 2

Committed **before the first sweep** of this suite, and not edited after it. Every merged
report records this file's sha256; a report whose digest disagrees with the committed
file is void (I2), and a dirty tree produces no report (I8). The whole file is frozen,
prose included. Say what you mean the first time.

This suite is the second one. The Tier 1 suite, `evals/seven-steps-primer/`, has its own
registration and its own records, and neither is touched by anything here. The design is
`docs/plans/primer-evals/defect-injection/0-plan.md` as corrected at step 4; what recon
found is `4-recon.md` beside it, and this file registers what that evidence predicts.

## The question

The primer's step 4 says recon must be a run, not a read. With gates 0 to 3 already
cleared on a plan the agent did not write, does the agent with the primer loaded name
more of the planted defects in a small service than a same-shape placebo whose step 4 is
a read-through, a one-sentence instruction to run the service, and no instruction?

Recon showed that the class this experiment was first designed around, a defect a run
reveals and a read does not, is empty on a service this size: three cold readers named
every planted defect. So no class is registered. The score is the fraction of all
accepted defects the reply identifies, and the placebo's read-through is the comparison
that answers the question.

## The conditions

Three authored conditions, one variable. Prompt, transcript, fixture and graders are
identical across them; only the instruction text differs.

| Condition | What it is | What it strips |
|---|---|---|
| `treatment` | the shipped `SKILL.md`, `disable-model-invocation` stripped, generated from the skill and drift-checked | — this *is* the treatment |
| `placebo` | the Tier 1 placebo, copied byte for byte and drift-checked against it: eight gates, same shape, a read-through at step 4 | this method vs any method of this shape |
| `run-oneliner` | one sentence: *Run it for real before you call it done: start the service and exercise it.* | the twelve lines of step 4 vs one sentence saying run it |
| `none` | no instruction text; the harness's own without-arm, measured once per sweep | the text existing at all |
| `treatment-no-recon` (Amendment 1) | the treatment minus every line that says recon is a run: step 4's eight sub-bullets and four failure modes, the same line-prefix cut as Tier 1's Amendment 11, generated and drift-checked | the recon text, with the rest of the method kept |

The Tier 1 one-liner is not a condition here. At gate 3 its plan is already approved, so
it implements; a direction against it would be a held prediction bought for nothing.

All three carry identical frontmatter and are copied to the same `_conditions/current`
path, so no condition is identifiable by name.

## The case, and every grader that scores it

One scored case, `step4-seeded-defects`, and one control-tagged diagnostic.

**The scored case.** A replay: eight hand-written records that end at gate 3 with the
markers placed, resumed on the seeded service, with the prompt *Gate 3 cleared. Proceed.
If a documented method for this kind of change is available to you, follow it. Put what
you find in your reply, not only in a file.* Record 0 opens with the same neutral line.
Record 1 names the record home. The transcript is written so both the treatment's and the
placebo's steps 1 to 3 are satisfied. The case declares `evidence: delta` and
`ablation: with-without`: it runs both arms, and recon showed the skill fires in every
with-arm run and in no without-arm run.

**The fixture.** `fixtures/notesvc-seeded/`: the Tier 1 service with the step-3 markers
placed, `PORT ?? 0`, and twelve planted defects. The ledger beside it, withheld from the
workspace and hashed into the instrument, holds per defect the patch, the signature, the
detection script, the description, the cause, the criterion, four probe replies, the
neighbour, and both reviewer tallies.

**Graders.** Twelve `reported-<id>` llm graders over `last_message`, each an isolated
author's criterion that scores 1 when the reply identifies that defect by what goes
wrong, by its cause, or by the effect a client sees; every one passed its five-reply
judge probe. Two guards, `liveness-read` (`tool_used` Read ≥ 2, both arms) and
`service-started` (`tool_used` Bash, anchored to a `node … server.js` command in either
of the two shapes recon observed, both arms). One monitor, `skill-fired`, which the
harness demotes under with-without. No `surfaced-*` grader: the class it belonged to is
empty.

**The diagnostic.** `step4-read-only`, tagged `control`, is the same case with Bash,
Write and Edit not granted. It is excluded from every sweep by tag and reaches no table.
Its use is a by-hand comparison at step 7.

## The registered score

The harness's case score averages fourteen graders including the guards. It is printed
and not registered; the case is registered as carrying no case-level contrast. The
registered score is one grader group:

| group | graders | per run |
|---|---|---|
| `reported` | the twelve `reported-*` graders | the fraction of them that passed |

A run in which no `reported-*` grader was scored has no group score; a run whose paid
graders a cost ceiling skipped is excluded, never scored zero. A run with a non-null
`error` (timed out, turn-capped, killed by a session limit) counts. A run the trace
check refuses counts. All four are published as per-cell counts beside the group scores.

## The registered directions

Treatment minus control on the `reported` group. A direction is a sign, never a number.

| contrast | direction | why this sign |
|---|---|---|
| vs `placebo` | **−1** | Recon: the placebo's step-4 read-through named things on the un-seeded skeleton; the treatment's step-4 run on the seeded fixture exercised the feature's own seams, met no planted defect, and reported none. The method's claim is +1. The evidence predicts the placebo, and that is what is registered. |
| vs `run-oneliner` | **0** | Both run the feature's path; neither meets the defects. |
| vs `none` | **+1** | No instruction implements the feature and stops. The `none` column exists because the floor is measured from it; a held +1 here is not counted among the method's claims. |
| vs `treatment-no-recon` (Amendment 1) | **−1** | The first sweep: the run text made every treatment run start the service or the tests and name nothing, and the placebo's read-through named one to three. Without the run text, step 4 is a step with a name and no method, and the evidence says an agent left to itself reads the neighbourhood. Registered against the method's interest, after the first sweep and before this condition was swept. |

**These are registered against the method's interest.** A −1 that comes out positive is a
miss and a finding for the method; a −1 that holds is a finding about the method. Both are
published.

## The noise floor

Per contrast, the larger of two quantities: the range of the three `none` means (Tier 1's
rule), and twice the standard error of the contrast, with the standard deviation of the
per-run group scores pooled over the two cells entering it and, for `none`, the three
without-arm columns taken together. The multiplier 2 is fixed here (`FLOOR_ERROR_MULTIPLIER`).
A contrast at or below its floor plus 1e-9 is published and marked, never a finding. A
floor at or below 1e-9 is not a measurement: the contrast is withheld and the group marked
unmeasurable. The second quantity exists because the first is degenerate when every
no-skill run scores zero, which recon makes likely.

## Pins, and what they are worth

- **Subject `sonnet`, judge `opus`**, as CLI aliases; the harness records what each
  resolved to and that is the number to quote.
- **Threshold 0.6.** Exit codes only.
- **Ten runs per condition, both arms.** Recorded as `runsPerCase: 10`; I1c refuses fewer.
  Measured in recon: a treatment with-arm run takes 26 to 31 turns, 154 to 298 s, $0.54
  to $0.74; the without-arm 17 to 20 turns, about $0.35; the placebo with-arm 9 to 12
  turns, about $0.25. Caps `max_turns` 60, `timeout_seconds` 900.
- **CLI 2.1.250**, series-compared, pinned outside the updater's cache. The sweep does
  not start on any other binary.
- **`--keep-temp`** on every invocation, and **`--max-cost-usd`** per invocation at
  twice the measured per-run cost times the invocation's runs across both arms, about $30
  at ten runs: a runaway guard, never a budget, since a trip voids the record under I1c.

## The undertaking

All four columns are published, whatever they show. `publishAllConditions` is literal
`true`. Every run's score is printed, not only the mean. Both reviewer tallies are
published beside the numbers as description. Thirty `reported-*` verdicts, drawn at
random across conditions with condition and verdict stripped, are labelled by hand before
the merged table is read, and the agreement is reported.

## Cost, registered as an estimate

An estimate, in the format of an estimate. Sixty agent runs at the measured rates: $20 to
$45. Twelve llm graders × three votes × sixty runs = 2,160 judge calls at Tier 1's measured
harness rate scaled by two to three: $10 to $30. Roughly **$30 to $75** at ten runs per
condition, and about ten hours of a terminal at ten minutes a run. The print-mode judge
probe already paid ($4.85) is not part of the sweep.

## The registered record

The merger reads this block and nothing else in this file.

```json
{
  "conditions": ["treatment", "placebo", "run-oneliner", "treatment-no-recon"],
  "cases": [
    {
      "name": "step4-seeded-defects",
      "evidence": "delta",
      "ablation": "with-without",
      "tags": ["outcome", "scored"],
      "scored": true,
      "measures": "Resumed at gate 3 on the seeded service, the reply identifies the planted defects: the fraction of the twelve reported-* graders that pass.",
      "contrasts": "groups",
      "groups": [
        {
          "kind": "graders",
          "name": "reported",
          "graders": [
            "reported-body-buffer-shared",
            "reported-body-limit-too-small",
            "reported-body-type-passthrough",
            "reported-clienterror-code-leak",
            "reported-echo-bypass",
            "reported-method-gate-not-post",
            "reported-not-found-reflects-url",
            "reported-owner-case-folded",
            "reported-owner-prefix-leak",
            "reported-request-id-echo",
            "reported-title-coerced",
            "reported-url-decoded-path"
          ]
        }
      ]
    },
    {
      "name": "step4-read-only",
      "evidence": "capability",
      "ablation": "none",
      "tags": ["control", "diagnostic"],
      "scored": false,
      "measures": "Diagnostic only: the same case with Bash, Write and Edit not granted; run by hand at step 7 and never in a table."
    }
  ],
  "expectedDirection": {
    "step4-seeded-defects#reported/none": 1,
    "step4-seeded-defects#reported/placebo": -1,
    "step4-seeded-defects#reported/run-oneliner": 0,
    "step4-seeded-defects#reported/treatment-no-recon": -1
  },
  "floorErrorMultiplier": 2,
  "threshold": 0.6,
  "subjectModel": "sonnet",
  "judgeModel": "opus",
  "runsPerCase": 10,
  "claudeVersion": "2.1.250",
  "publishAllConditions": true,
  "claimCeiling": "Gates 0 to 3 are already cleared on a plan the agent did not write. From there, on this fixture, the primer's step 4 was predicted to name fewer of the planted defects than the same-shape placebo's read-through, as many as a one-sentence instruction to run the service, and more than no instruction. This holds for one fixture, one feature and twelve planted defects that three cold readers could each see, and says nothing about whether the software that comes out is better."
}
```

## The instrument, pinned

Twelve defects, every one read-visible by the registered rule (named by two or more of
three cold readers reviewing it alone), with the in-company tally beside it:

| defect | alone | in company |
|---|---|---|
| body-buffer-shared | 3/3 | 3/3 |
| body-limit-too-small | 3/3 | 3/3 |
| body-type-passthrough | 3/3 | 0/3 |
| clienterror-code-leak | 3/3 | 0/3 |
| echo-bypass | 3/3 | 3/3 |
| method-gate-not-post | 3/3 | 1/3 |
| not-found-reflects-url | 2/3 | 3/3 |
| owner-case-folded | 3/3 | 3/3 |
| owner-prefix-leak | 3/3 | 3/3 |
| request-id-echo | 2/3 | 0/3 |
| title-coerced | 2/3 | 0/3 |
| url-decoded-path | 3/3 | 3/3 |

Authoring transcript digests (sha256, first sixteen): designer `91d2f12689938090`,
criteria author `aa1eb06f85313e8d`; the thirty-nine reviewer transcripts read nothing
outside their directories and ran nothing. The instrument digest at sweep time covers the
fixture, the ledger, the transcript, the case and every grader.

## What is registered elsewhere, and deliberately

The claim ceiling is carried here as `claimCeiling` and quoted verbatim in this suite's
README, where I3's tripwire reads it with its own anchor. The Tier 1 registration is not
amended: it says Tier 2 registers nothing there, and that stands. The pointer lives in the
two READMEs, outside every instrument digest.

**Not claimed.** Nothing about a defect a run reveals and a read does not: that class
could not be certified on this fixture, and the finding that it could not is itself
published in `4-recon.md`. Nothing about whether the software that comes out is better.

## Amendment 1 — the recon ablation: `treatment-no-recon`

Recorded 2026-09-08, after the first sweep (`RESULTS-2026-09-07-defects.md`) and before
this condition is swept. The backlog's own follow-on ("Later: ablate recon"): the only way
to measure whether step 4's text matters on this fixture.

### 1.1 The condition

`treatment-no-recon` is the treatment minus every line that says recon is a run: the
eight sub-bullets under step 4 and the four failure modes about running, reproducing and
evidence from runs. The same line-prefix cut as Tier 1's Amendment 11, generated by
`scripts/build-conditions.mjs` from the shipped skill and drift-checked, so the two
suites' `treatment-no-recon` texts are byte for byte the same. Identical frontmatter,
same `_conditions/current` path. 1315 words against 2075.

### 1.2 The registered direction

Treatment minus `treatment-no-recon` on the `reported` group: **−1**. The three existing
directions do not move (I8), and the three existing records are not re-swept: each
condition carries its own digest and the shared instrument is unchanged, so the merge
adds one record to three.

### 1.3 What it would mean

If it holds, the twelve lines of step 4 are what turned the agent away from the code it
would otherwise have read, and "run it" in one sentence did the same. If it comes out
inside the floor, the cut agent names nothing either, and the text is not what decides.
If it comes out positive, the run text is what makes the agent look at the code at all.
Each reading is published as what it is.

### 1.4 What it costs

One sweep of one condition, both arms, ten runs each: about $12 and 75 minutes.
