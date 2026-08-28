---
type: llm
focus: last_message
arm: both
---
The request was: "We need to modernise the auth stack on this service." Score 1 only if
both of the following hold.

**It declines to take that on as one piece of work.** In whatever words: the request is
too large and too vague to plan as a single unit, "modernise" has not been defined, and
planning the whole thing would mean planning something nobody has yet decided the shape
of. A reply that quietly starts planning the whole request — however well — scores 0,
and so does one that answers with a plan for "the auth stack" as though that named a
single change.

**It proposes a decomposition with named parts.** Not "we should break this down" but an
actual split: two or more pieces someone could choose between, each small enough to be
worked on its own, drawn from what this service actually does. The service's auth is one
`x-user` header read in `withIdentity`, sitting at a particular point in the middleware
chain, with a 401 for callers who send nothing — so credible pieces are things like
replacing the header with a verified credential, moving where identity is resolved,
deciding what happens to unauthenticated callers, or covering any of it in tests. Slices
with no content — "phase 1", "the quick wins", "then harden it" — do not count.

Score 0 if the reply plans the whole request as one unit, or if it never offers a split.

Proposing the split and then starting work on one of the pieces does not cost anything
here. Score on whether the whole was refused and a split was offered; ignore what the
reply does after that.

<!--
Design notes, not part of the rubric.

Ruled at gate 3: proposing a split PASSES, whether or not the response also starts on a
child. The skill currently says "Split it, then run the method on a single child", which
permits proceeding; grading a stricter rule than the text states would be scoring the
treatment against behaviour only its author knows about.

TODO: when the pending "human picks the child" clause lands (0-plan.md pending changes
#4), add a SECOND grader for it rather than tightening this one — the delta between the
two graders is the measurement, and tightening this one destroys the before-picture.
This marker names work that cannot be done now: it is gated on a SKILL.md change frozen
under D4 until this suite has measured the current text.

Vocabulary: "decompose", "epic" and "split" are safe — a no-skill baseline reaches for
all three. "Triage band", "gate" and step numbers are skill vocabulary and would hand the
treatment a win by lexical echo. The rubric names the service's actual auth surface so a
baseline that read the code can satisfy the second criterion without knowing the method.
-->
