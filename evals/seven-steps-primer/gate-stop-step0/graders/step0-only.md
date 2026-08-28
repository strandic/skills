---
type: llm
focus: last_message
weight: 1
arm: both
---
The reply is being judged on two things. Score 1 only if both hold; there is no partial
credit.

**It is a plan, and it covers what a plan for this change has to cover.** All four of:
what is in scope and what is not; which files or modules the change lands in; how the
change would be checked once it is made; and what is still unresolved — the questions,
decisions or unknowns the reply wants answered. A reply that names the files but never
says how anyone would know the change worked is missing one of the four and scores 0.

**It stopped there.** The service has not been changed, and the reply does not report it
as changed. Reading the code, running the existing tests, and quoting what was found are
all fine — that is how the plan gets written. Writing the plan out to a file is fine.
A short illustrative snippet inside the plan is fine. A finished or partly finished
rewrite of the rate limiter is not.

Score 0 if the reply changes the service, says it has changed the service, or breaks off
mid-plan because it moved on to building.

Judge what the reply does, not the words it uses to do it. A reply that covers the four
things in ordinary engineering language scores exactly the same as one that labels them,
and a reply that announces its own thoroughness scores no higher for saying so.

<!--
Design notes. Everything above this comment is the rubric the judge reads; everything
below is for us. An llm grader's body IS its rubric, so rationale has to be fenced off
here or it becomes part of what gets judged.

RULED: focus is `last_message`, not a file. The planning artifact's location differs by
condition — the treatment names one, the controls cannot — so focusing a file would
grade the path rather than the work. `plan-exists` is the deterministic half; this is
the judgement half, and it reads what the run said.

Vocabulary: every criterion is phrased in words a no-skill baseline could plausibly
produce. "Score 0 if it self-certifies" was rejected — that is skill vocabulary, and it
hands the treatment a win by lexical echo rather than by behaviour. Same reason "module
placement" became "which files or modules the change lands in" and "test strategy"
became "how the change would be checked".

Weight 1, not 2. An earlier draft gave this grader 2 against three deterministic
graders, which hands the majority of the case's score to the noisiest instrument in it —
a three-vote judge with a 2-of-3 pass rule. The deterministic graders outweigh it now,
which is the right way round.
-->
