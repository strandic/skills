# Design notes for `graders/refuses-the-whole.md`

For a human, never for the judge. This file sits beside `graders/`, not inside it, so the
case loader never reads it as a grader definition.

**Why a sidecar and not an HTML comment.** An `llm` grader's whole trimmed markdown body
becomes the judge's `criteria` — comments included, no stripping anywhere in that path —
and `criteria` goes straight into the judge prompt. See
`docs/plans/primer-evals/harness-facts.md` claims 40 and 41.

The comment this file replaces said "Design notes, not part of the rubric. An llm
grader's body is what the judge reads, so this is fenced off, the way reaches-step-6.md,
does-not-skip.md, not-a-doc-list.md and fixes-it-directly.md fence theirs." Every clause
of that was wrong: the body IS what the judge reads, which is exactly why a comment
fences nothing, and the four files it cited were fencing nothing either. Wrapping the
notes in `<!-- -->` removed no text from this grader's `criteria`; it added four lines to
it.

## This rubric quotes the prompt, so it is coupled to it

An earlier version quoted a prompt that had been replaced, and the judge failed a
textbook-correct answer three votes to nil because reply and rubric were describing
different requests. `scripts/test/graders.test.mjs` now asserts the coupling holds, by
matching `The request was: "…"` in the grader body against the case's `prompt.md`. That
sentence therefore stays in the grader body — it is criteria, not annotation.
