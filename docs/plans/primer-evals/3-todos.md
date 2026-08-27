# Step 3 — to-dos

Artifact: 38 files under `scripts/` and `evals/seven-steps-primer/`, carrying 98
markers. Every file has at least one.

**This document does not list the sites.** The enumeration is the grep — that is
the entire reason the markers live in the source rather than in a plan:

```bash
grep -rn 'TODO' scripts evals          # every site
grep -rn 'TODO(seam)' scripts evals    # the ones that block step 6
```

What follows is only what a grep cannot tell you: the convention, and the
decisions taken while placing them.

## Marker convention

| Marker | Means |
|---|---|
| `TODO:` | An implementation site. Step 6 writes onto it. |
| `TODO(seam):` | Blocked on an open seam. **Must not survive step 4.** |

The second form makes the step-2 rule mechanical: *no un-provided dependency
reaches a later step unflagged* stops being a promise and becomes
`grep -rn 'TODO(seam)'` returning nothing.

Four are outstanding — the three named in step 2, plus one that only became
visible once the case files existed:

| Seam | Where |
|---|---|
| `EvalCommand` — which executable, and its env | `scripts/run-evals.mjs` |
| `ResultsLocator` — where the harness wrote the document | `scripts/run-evals.mjs` |
| `PreRegistrationDigest` — blob sha or content hash | `scripts/merge-results.mjs` |
| The `history_file` transcript for case 5 | `step3-markers-in-source/case.yaml` |

## Decisions taken while placing markers

**The convention comment matched its own grep.** The first draft explained
`TODO(seam):` inside a source header, so the enforcement grep returned five hits
where four were real. Moved here. A check that reports a site which is not a site
is the same defect as a grader that matches everything — it just fails in the
flattering direction rather than the alarming one.

**Sweeps run sequentially.** Marked as such in `run-evals.mjs` rather than left to
step 6: three concurrent sweeps would contend on the single `_condition/` path and
silently evaluate whichever condition won the race.

**The placebo has to match the treatment on more than shape.** Length, section
count and imperative density are all marked as requirements, because the placebo
controls for *"any long gated instruction"* — a shorter one measures length
instead, and would hand the treatment a delta it did not earn.

**The one-liner's frontmatter description is a control-validity risk.** It has to
be plausible enough that the model loads the skill, but a description long enough
to carry method content turns the control into a second treatment. Marked, not
resolved.

**The inverted placebo stays out of scope.** Same shape, but with the recon step
replaced by *"verify by reading the source; a live run is wasteful"* — it would
pass every gate grader and fail only the recon one, which is the sharpest available
test of whether the cases discriminate at all. Recorded in
`conditions/placebo/SKILL.md` as a marker so the idea is not lost, but Tier 1 does
not build it.

## One question the markers surfaced that the plan had not

`triage-decompose-epic` asks the method to refuse an epic and propose a split. Its
grader cannot be written until someone decides whether **proposing a split and then
starting on the first child** counts as a pass or a failure. The plan asserts the
behaviour without settling it.

It is marked in the grader file rather than answered here. It is a product
question, and answering it in a planning document is how a decision gets made by
whoever writes the code instead of by whoever owns the method.

## What is deliberately not marked

No markers for CI wiring, cross-model sweeps, or the Tier 2 designs. Marking a site
for work the plan puts out of scope would make the grep dishonest — every marker
here is something step 6 is expected to complete.
