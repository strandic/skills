# seven-steps-primer — pending changes

Changes we believe improve the skill, held until they can be **measured rather than
assumed**. The point of building an eval suite is that edits to the method stop
being matters of taste; this is the ledger that keeps that honest.

`skills/seven-steps-primer/SKILL.md` is frozen against these until the suite has
baselined the current text (`docs/plans/primer-evals/0-plan.md` D4). Rewriting the
thing under test while building the instrument means never learning whether the
rewrite helped, and doubles the contamination problem by having one author tune both
the skill and its graders.

Every entry carries a **prediction** before it is applied. A change with no
falsifiable prediction is a preference, and should be labelled one.

**Status key:** `queued` · `applied` · `measured` · `dropped`

---

## 1. The Concise restyle

**Status:** queued
**Source:** the skill was written under Claude Code's default output style; the
session switched to Concise partway through this work.

**Change.** Rewrite SKILL.md in the Concise register.

**Why.** Consistency with how the repo now reads. But note the two senses of
"style" are not the same thing: a Claude Code *output style* governs how an
assistant talks in a terminal, while SKILL.md is a document an agent reads as
*instructions*. Optimising for terminal readability is not obviously the same as
optimising for instruction-following, and which way it cuts is empirical.

**Prediction.** Direction genuinely unknown — this is the entry most likely to
regress, because the current text's density may be doing work. Measurable by
re-running the full suite with the restyled text as the treatment and comparing
against the baseline.

**Result.** —

---

## 2. The urgency line in triage

**Status:** queued
**Source:** ruling D5 — *"I wouldn't recommend using the primer under urgency. The
steps usually require careful consideration and review from the user."*

**Change.** State in the triage section that urgency is a reason not to run the
method at all.

**Why.** Urgency does not make the gates too *expensive* — it makes them **fake**.
A hurried reviewer still says *proceed*, so every gate appears to clear while the
consideration behind it is gone. That lands on the skill's own first-named failure
mode, the rubber-stamp gate.

**Prediction.** Not measurable by the Tier 1 suite as built — no case applies
urgency, because D1 established that human pressure cannot test gate-*holding*.
But it becomes measurable as a **triage** case rather than a gate case: *"we ship
in 40 minutes, add rate limiting"* → does the method decline to run? That case
should separate the treatment from every control, none of which mentions urgency.
Add the case when the clause lands.

**Result.** —

---

## 3. A breadcrumb convention for step artifacts

**Status:** queued
**Source:** surfaced during step 2 — steps 1 and 2 shipped their rationale as inline
comments, bloating the source.

**Change.** State that each step may carry a short companion in the artifact home
holding intent and diagrams, never substituting for the code artifact — with the
existing steps 3/4/6 substitution ban restated adjacent so the two cannot be
confused.

**Why.** The Deliverables section forbids a document *substituting* for a code
artifact at steps 3, 4 and 6, and separately says "don't default every step to a
planning doc". Read together those sound like a general discouragement, which is how
they were read here. Nothing forbids *accompaniment*, and steps 1 and 2 are not even
in the substitution ban. The cost of getting it wrong is a reviewability problem: a
300-line file whose three load-bearing lines are open seams invites a gate cleared
without attention — the rubber-stamp risk again.

**Prediction.** **Not measurable by any agent eval.** The effect is on human
reviewers, and whether a reviewer read the artifact is precisely what no eval can
observe. This one ships on judgement or not at all, and should be labelled a
preference rather than a finding.

**Result.** —

---

## 4. "The human picks the child" in the Decompose band

**Status:** queued
**Source:** surfaced while writing `triage-decompose-epic`'s grader, which could not
be authored without the ruling.

**Change.** Line 20 currently reads *"Split it, then run the method on a single
child."* Candidate: *"Split it, present the split, and run the method on the child
the human picks."*

**Why.** The sequence is prescribed but the chooser is not. An agent that splits an
epic and starts on the child *it* picked has made the run's most consequential
scoping decision while appearing to comply — self-certification one level above the
gates. It passes the skill's own density test: gate density follows irreversibility,
and the choice of child sets everything downstream.

**Prediction.** Sharpest of the four. A **second** grader on
`triage-decompose-epic` — not a tightening of the existing one, so the delta between
the two is the measurement. The one-liner control says nothing about decomposition,
so the clause should separate treatment from one-liner. If it does not, it is doing
no work.

**Result.** —

---

## Note on what this ledger reveals

Three of four entries came from **building the evals**, not from reading the skill.
That is the exercise paying for itself before a single number exists.

But only two are cleanly measurable by Tier 1 as designed (#1 by re-running the
suite, #4 by a second grader), #2 needs a case that does not exist yet, and #3 is
not measurable by any agent eval at all. D4's "freeze until measured" is therefore
too broad as stated: it is the right rule for #1 and #4, a *"freeze until the case
exists"* for #2, and for #3 the honest position is that no measurement is coming
and the change should be argued on its merits.
