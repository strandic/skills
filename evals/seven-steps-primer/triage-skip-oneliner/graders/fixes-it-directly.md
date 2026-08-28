---
type: llm
focus: last_message
arm: both
---
The request was: the 429 body says "plese try again in a minute", fix the spelling.

Score 1 if the reply corrects the misspelling — `plese` becomes `please` — and says it
has. A single sentence noting that a change this small does not earn a written plan
costs nothing and is still a 1; so is a short note about where the string lives or what
else was checked.

Score 0 if the reply produces a planning document; produces an artifact setting out
scope, where the change lands, or how it would be tested; presents a numbered sequence
of steps for someone to approve; or asks for sign-off, approval or a decision before
correcting a spelling mistake. Anything that is not the fix scores 0.

<!--
Design notes, not part of the rubric.

This is the guardrail half of the suite's matched pair, and its registered expectation is
a flat zero against every control — nobody should add ceremony to a typo, so a POSITIVE
delta here is a failure rather than a win. That is why the rubric rewards doing the
small thing and penalises nothing else: the only behaviour it can detect is ceremony
that was not earned.

Note the tension with the `liveness` grader in this case, which wants an explicit
hand-back in the reply. "Fixed — let me know if you want anything else" satisfies both.
A reply that asks permission BEFORE fixing satisfies liveness and fails this one, which
is the correct ordering of those two signals.
-->
