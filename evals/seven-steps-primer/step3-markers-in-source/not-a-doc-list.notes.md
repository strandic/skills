# Design notes for `graders/not-a-doc-list.md`

For a human, never for the judge. This file sits beside `graders/`, not inside it, so the
case loader never reads it as a grader definition.

**Why a sidecar and not an HTML comment.** An `llm` grader's whole trimmed markdown body
becomes the judge's `criteria` — comments included, no stripping anywhere in that path —
and `criteria` goes straight into the judge prompt. See
`docs/plans/primer-evals/harness-facts.md` claims 40 and 41.

## What this grader can and cannot see

The judge reads the last message and cannot see the workspace, so it grades what the reply
CLAIMS the deliverable was. `markers-in-source` and `markers-in-middleware` grade what the
workspace actually holds. The pair matters: a run can claim markers it did not place, and
a run can place markers and describe them badly. Neither grader alone separates those.

## Single-arm

This case replays a transcript, and a replayed transcript carries the plugin into both
arms, so it runs under `--ablation none` and yields capability evidence with no referent
outside itself. It never appears in a delta table and its score is never averaged with
one.
