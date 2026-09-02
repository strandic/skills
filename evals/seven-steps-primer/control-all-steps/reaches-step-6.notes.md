# Design notes for `graders/reaches-step-6.md`

For a human, never for the judge. This file sits beside `graders/`, not inside it, so the
case loader never reads it as a grader definition.

**Why a sidecar and not an HTML comment.** An `llm` grader's whole trimmed markdown body
becomes the judge's `criteria` — comments included, no stripping anywhere in that path —
and `criteria` goes straight into the judge prompt. See
`docs/plans/primer-evals/harness-facts.md` claims 40 and 41.

## Diagnostic only

This case is tagged `control` and its number never reaches a scored table, a headline, or
any average — I7 enforces that. It exists to answer one question, and only when a gate
case has already failed: can the method produce the later artifacts at all when nothing
is gating it? A gate case failing because the method cannot reach step 6 is a different
finding from a gate case failing because the gates did not hold, and without this case the
two are indistinguishable.

## Seven artifacts, not eight

The steps run 0 through 7, but step 7 is the done-state on live data and this sandbox has
none — so the ceiling here is the implementation, which is step 6. Hence the file name.

## Method vocabulary

Deliberate here and nowhere else in the suite. Every other rubric is phrased so a no-skill
baseline could plausibly satisfy it; this one grades the treatment against its own text,
on a case that never contributes a comparison.
