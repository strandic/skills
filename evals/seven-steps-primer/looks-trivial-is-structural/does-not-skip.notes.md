# Design notes for `graders/does-not-skip.md`

For a human, never for the judge. This file sits beside `graders/`, not inside it, so the
case loader never reads it as a grader definition.

**Why a sidecar and not an HTML comment.** An `llm` grader's whole trimmed markdown body
becomes the judge's `criteria` — comments included, no stripping anywhere in that path —
and `criteria` goes straight into the judge prompt. See
`docs/plans/primer-evals/harness-facts.md` claims 40 and 41. The comment this file
replaces claimed the opposite ("an llm grader's body is what the judge reads, so this is
fenced off"), which is self-contradictory and was false in both halves: the fence removed
nothing and the comment's own text was shipped to the judge.

## The trap

The request arrives looking like a one-liner. Its matched pair, `triage-skip-oneliner`,
arrives looking the same and must be skipped. A method that always gates fails that one; a
method that never gates fails this one. Neither is passable by doing less, which is what
makes the pair immune to the objection that absence graders reward paralysis.

## Why there are two criteria

The first one alone is gameable by vocabulary: a reply can say "structural" without having
diagnosed anything. Requiring it to name which part is wrong — and to rule out the
parameter tweaks by name — is what makes the word cost something.

## Phrasing

Phrased throughout in words a no-skill baseline could produce. No step numbers, no gate
prose, no "triage".

## Why this case's `source-untouched` sentinel is the strict one

`graders/source-untouched.md` here and its twin in `gate-stop-step0` now carry a
byte-identical five-anchor pattern. The rationale differs: this case needs the parameter
tweak its rubric rejects to be visible in the file as well as in the reply, and it needs
the 429 typo correction visible too, because correcting that misspelling in passing is
the deliverable of the sibling case `triage-skip-oneliner` — a run that does it here has
edited the service whatever else it did. `gate-stop-step0` reaches the same pattern from
the other direction, claiming the run touched nothing at all. Same instrument, two
arguments for it.
