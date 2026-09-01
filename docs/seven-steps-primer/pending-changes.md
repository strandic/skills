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

**Result.** Not yet measured, but the baseline now exists: the 2026-09-01 sweep is the
number a restyle has to beat. Per case, treatment scored `gate-stop-step0` 0.91,
`looks-trivial` 0.88, `triage-skip-oneliner` 1.00, `triage-decompose-epic` 0.80,
`step3-markers` 0.47. A restyle costs one sweep (~$10, ~35 minutes) to evaluate.

One number sharpens the stake. The placebo — same eight gates, arbitrary contents —
scored 0.71 on `gate-stop-step0` against the treatment's 0.91, so roughly a fifth of
that case's score is carried by the primer's actual prose rather than its structure.
That is the part a restyle could destroy without anyone noticing by reading.

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

**Result.** Not yet measured, and the 2026-09-01 sweep makes it more interesting than
when it was written. `triage-decompose-epic` is one of the two cases where the primer
ties the one-liner exactly (−0.00, below the noise floor) while beating stock Claude
Code by +0.42. So on today's grader, the primer's entire decomposition section buys
nothing over *"present a plan and wait for my explicit approval"*.

The prediction stands as registered: if the "human picks the child" clause is doing
work, a second grader for it should separate treatment from one-liner where the current
one cannot. If it does not separate them either, that is evidence the decomposition
guidance is not earning its length — which is a finding worth having.

---

## 5. Restate the "mechanical" stopping rule so it can be met

**Status:** queued
**Source:** two cold step-6 forks, ten fresh contexts each, building the eval suite from
the committed artifacts alone.

**Change.** The skill says planning is finished when implementation has become
*mechanical* — "the feature buildable from the artifacts alone" — and step 6 adds that
"a design decision surfacing here is a defect in an earlier artifact: stop and go back."
Taken literally, you never stop.

**The evidence.** Round 1 surfaced **76** places the artifacts failed to determine an
answer. All 6 blocking and ~20 material entries were fixed in the artifacts that owned
them. Round 2 surfaced **92**. Normalised for the three agents round 1 lost, the rate
was flat: **10.9 → 11.5 insufficiencies per builder**.

It does not converge, and the reason is structural rather than a failure of effort:
every ruling exposes the next question at a finer grain. Round 1 asked *"does the fixture
throttle at all?"*. Answering it let round 2 ask *"where does per-request identity come
from, and why does per-user limiting touch the routes module?"* — questions that could
not have been posed before the first was settled.

**But the two rounds were not equivalent, and the difference is the whole point.**
Round 1 produced a suite that **could not run**: no fixture, every grader path wrong, no
case able to reach the sandbox. Round 2 produced one that **runs and passes** — 201
script tests, 10 fixture tests, no drift, zero unresolved seams, invariants holding. The
count stayed flat while the artefact went from broken to working.

So the count is not the signal. What changed was the *kind* of decision left open.

**Candidate wording.** Replace "buildable from the artifacts alone" as the stopping test
with something a builder can actually satisfy — the remaining decisions no longer change
whether it works. A cold build will always surface more; the question is whether what it
surfaces is load-bearing.

**Prediction.** Not measurable by the Tier 1 suite, and unlike #3 that is not a weakness:
it already has direct empirical support from two rounds. The falsifiable form is a third
fork — under the revised rule, a builder should be able to state *"nothing still open
changes whether this works"* and be right. If round-3 builders still surface blocking
items, the revision is wrong.

**Result.** —

---

## 6. Put the setup choices at gate 0, not ahead of it — **MEASURED, SHIPPED**

**Status:** measured · shipped
**Source:** the first smoke pilot, then a four-sweep experiment at n=5.

**What shipped.** Two sentences in *Set the artifact home*:

> Step artifacts need a home in _this_ repo (default `docs/plans/<feature>/`) — unnamed,
> they improvise their own location. Name yours **in** the step-0 artifact rather than
> before it.

> **Two setup choices — the human's call, never yours; put them at gate 0, not ahead of
> it.** Name your defaults, produce step 0, and hand over both questions beside the
> artifact so one reply settles all three. Blocking before step 0 spends a round-trip and
> gives the human nothing to review.

**Why.** The entry began as "does step 0 have to write a file?", which was the wrong
question. The measurement showed step 0 was not happening *at all*: the committed text
told the agent to decide the artifact home before step 0 and that the setup choices were
"the human's call, never yours", and the agent obeyed both — stopping to ask, producing
nothing. Five of five runs replied with 670–1030 characters of triage and questions. The
choices are still the human's; they now arrive at the gate where the human answers
anyway.

**Prediction, as registered before the runs.** *"`plan-exists` currently fails for the
treatment. If the clause lands on the 'must write' side, the treatment should clear it
while the controls still do not."*

**Result.** Confirmed, at n=5, one case, `--ablation none`, sonnet subject / opus judge.

| | A — committed | B — shipped |
|---|---|---|
| `plan-exists` *(grader unchanged between arms)* | **0/5** | **4/5** |
| mean score, same graders both arms | 0.72 | 0.85 |

**The decomposition, because the headline number is two effects.** A later run reads
`step0-only` 5/5 and a mean of 0.95 — but the rubric changed between those runs, so that
figure is not the skill's. The skill's effect measured against a **constant** grader is
`plan-exists` 0/5 → 4/5 and 0.72 → 0.85. The remainder is the grader fix below.

**The grader defect this exposed, which was mine.** `plan-exists` and `step0-only` were
mutually exclusive by construction: one demanded the plan in a file, the other judged the
reply, and five runs split cleanly — four wrote the file and failed the rubric, one kept
the plan inline and failed the file check. No run could satisfy both, so the pair
measured itself rather than the work. `step0-only` now accepts a plan "either set out in
this reply, or written to a file the reply names". Same class as the
`plan-exists` / `no-source-writes` contradiction the cold fork's auditor found; fixing
that one is what introduced this one.

**Contamination, stated rather than waved off.** This is a change to the skill made in
response to eval output — the thing D4 exists to prevent — and the same author wrote the
skill, the grader, the fixture and the case. Three things bound it: the mechanism was
visible in the replies rather than inferred from a score, the criterion was the method's
own claim (does step 0 happen) rather than a grader's invention, and the effect is
0/5 → 4/5 rather than a marginal shift a fitted instrument could manufacture. None of
that makes it independent evidence. It is a fix with a measurement attached, and the
first ledger entry to carry a Result at all.

---

## Note on what this ledger reveals

Four of five entries came from **building the evals**, not from reading the skill, and
#5 came from the method being run on itself under conditions designed to make it fail
visibly.
That is the exercise paying for itself before a single number exists.

But only two are cleanly measurable by Tier 1 as designed (#1 by re-running the
suite, #4 by a second grader), #2 needs a case that does not exist yet, and #3 is
not measurable by any agent eval at all. D4's "freeze until measured" is therefore
too broad as stated: it is the right rule for #1 and #4, a *"freeze until the case
exists"* for #2, and for #3 the honest position is that no measurement is coming
and the change should be argued on its merits.
