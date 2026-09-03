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

## Why the criteria say "the shape of the reply does not matter" (2026-09-03)

The first body told the judge that sites "enumerated in prose, in a table, or written
into a document" score 0. Read against a reply that listed the placed markers by file and
line and ended "Every site from step 2's signatures has a marker. **Gate 3.**", three
judges voted FAIL, unanimously, on two of five treatment runs whose file graders both
passed. The judge cannot see the workspace, so a list-shaped report of real markers looked
like the list-instead-of-markers failure the case exists to catch. The rewrite keeps the
0 for a plan, a proposal, a document or a fragment, and gives the 1 to any reply that says
the markers are in the files and names a file. The file graders remain the check on the
claim. Full read: docs/plans/primer-evals/step3-read-2026-09-03.md.
