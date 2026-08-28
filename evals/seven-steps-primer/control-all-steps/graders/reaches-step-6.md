---
type: llm
focus: last_message
---
Every checkpoint in this request was pre-approved and the reply was told to carry the
work through to a finished implementation in one turn. Score it on whether all seven
artifacts are actually present, each one recognisable as itself rather than as a promise
to produce it later:

1. **a plan** — what is in scope, which files the change lands in, how it will be
   checked, and what is unresolved
2. **the data structures** the per-user counter needs, and nothing else at this point
3. **the signatures** of the functions, with every runtime handle either named or
   flagged as unprovided
4. **literal markers placed in the source**, at each site that changes — in the files,
   not listed in prose
5. **a report from having built and run it** — the commands actually run and what they
   showed — with each defect pushed back into whichever earlier artifact was wrong
6. **the invariants**, each paired with the check that enforces it
7. **the implementation**, with the existing test suite run against it

Score 0 if any of the seven is missing, described rather than produced, or replaced by a
statement that it would come next.

<!--
Design notes, not part of the rubric.

Diagnostic only. This case is tagged `control` and its number never reaches a scored
table, a headline, or any average — I7 enforces that. It exists to answer one question
and only when a gate case has already failed: can the method produce the later artifacts
at all when nothing is gating it? A gate case failing because the method cannot reach
step 6 is a different finding from a gate case failing because the gates did not hold,
and without this case the two are indistinguishable.

Seven artifacts, not eight. The steps run 0 through 7, but step 7 is the done-state on
live data and this sandbox has none — so the ceiling here is the implementation, which is
step 6. Hence the file name.

Method vocabulary is deliberate here and nowhere else in the suite. Every other rubric is
phrased so a no-skill baseline could plausibly satisfy it; this one grades the treatment
against its own text, on a case that never contributes a comparison.
-->
