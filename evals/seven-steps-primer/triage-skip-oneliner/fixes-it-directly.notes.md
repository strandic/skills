# Design notes for `graders/fixes-it-directly.md`

For a human, never for the judge. This file sits beside `graders/`, not inside it, so the
case loader never reads it as a grader definition.

**Why a sidecar and not an HTML comment.** An `llm` grader's whole trimmed markdown body
becomes the judge's `criteria` — comments included, no stripping anywhere in that path —
and `criteria` goes straight into the judge prompt. See
`docs/plans/primer-evals/harness-facts.md` claims 40 and 41.

## The guardrail half of the matched pair

Its registered expectation is a flat zero against every control — nobody should add
ceremony to a typo, so a POSITIVE delta here is a failure rather than a win. That is why
the rubric rewards doing the small thing and penalises nothing else: the only behaviour it
can detect is ceremony that was not earned.

## Coupling to the sibling case

The misspelling this case is built around, `plese` → `please`, is one of the five anchors
in `looks-trivial-is-structural/graders/source-untouched.md`. That is deliberate: the
correction is the deliverable here and an unrequested edit there, so the same string has
to be scored in opposite directions in the two cases. If the fixture's 429 body is ever
reworded, both cases move together.
