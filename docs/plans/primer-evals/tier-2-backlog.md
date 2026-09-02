# Tier 2 — outcome evals for `seven-steps-primer`

Revised 2026-09-02, after the first Tier 1 sweep. Not part of the current build.

## What Tier 2 is for

Tier 1 measures what the agent does: whether it produces a plan and stops, whether it
skips trivial work, whether it places markers in the source. Those are compliance
measures. They say nothing about whether the software that comes out is any better.

Tier 2 measures the software. It is the only way to support the claim "this method
produces better code", and the plan's claim ceiling (D7) forbids that claim until Tier 2
exists.

## The one rule every Tier 2 instrument must follow

Nothing in Tier 2 may be written by someone who has read `SKILL.md`.

The reason: a grader written from the skill text checks for the skill's vocabulary. The
treatment uses that vocabulary, so it scores well, and nothing has been measured. Tier 1
avoided this by using deterministic graders where it could and by phrasing rubrics in
words any agent might use. Tier 2 avoids it by having the graders written by someone
who does not know what the skill says.

In this repository that someone cannot be a person, because one person wrote the skill,
the cases, and the graders. It can be a fresh-context agent. Tier 1 already used this
trick for step 6: agents given only the artifacts, with no memory of the conversation
that produced them. The same agent can write an acceptance suite or seed defects without
ever having seen `SKILL.md`. That removes the largest cost the earlier version of this
document listed, which was one human-day of specification per feature.

## Two things to fix before running any of this

Both are tracked as beans.

**Sweeps die after about 35 minutes when run in the background** (`skills-zk77`). Four
attempts ended at 41, 34, 34 and 33 minutes; the one that survived was the one that
finished in time. Tier 2 runs are longer than Tier 1's, so the runner must be changed to
run one case per invocation before any Tier 2 sweep is attempted. Until then, run sweeps
from a terminal.

**The suite only runs on CLI 2.1.250** (`skills-5jso`). From 2.1.251 the harness refuses
to run Bash-granting evaluations on any machine where `~/.docker` contains a symlink.
Docker Desktop installs its CLI plugins as symlinks, so this blocks most developer
machines. A $200 experiment should not be started on a binary that will eventually be
deleted from the version cache. Either the upstream bug gets fixed, or the runner needs a
documented workaround before Tier 2 starts.

## The three experiments

Run them in this order. The order is different from the earlier version of this document
because Tier 1 changed which one is most useful.

### 1. Ablate the parts of the skill that Tier 1 can already see

Tier 1 found that the primer ties a thirteen-word instruction ("Present a plan and wait
for my explicit approval before editing any code") on both structural-triage cases. That
means two sections of the skill may not be doing anything. This experiment finds out
which sections matter by removing them one at a time and re-running the existing suite.

Each ablation is a new condition: the treatment with one section deleted. Three to start:

- the triage section (skip / decompose / run it)
- the failure-modes list at the end
- the setup section (artifact home, worktree, checkpoints)

Each condition is one Tier 1 sweep, about $10 and 35 minutes. The existing invariants,
graders and merge all apply unchanged. If removing a section does not move any Tier 1
score outside the noise floor (0.13), that section is not earning its length on the
behaviours Tier 1 measures.

This does not test the recon section (step 4), because no Tier 1 case reaches step 4.
Recon ablation waits for experiment 2.

### 2. Seed defects and measure whether recon finds them

The skill's most specific claim is that step 4 must be a run, not a read: the agent must
execute the code, because only execution surfaces certain defects. This experiment tests
that claim directly.

**Setup.** A fresh-context agent that has not seen `SKILL.md` plants a fixed number of
defects in the fixture. Some are visible by reading the code. Some only show up when the
code runs: a race between concurrent requests, a library whose runtime behaviour differs
from its type signatures, a path that depends on an environment variable, middleware that
misbehaves only under load. The agent records which defects it planted and how each one
can be detected.

**Measurement.** The score is how many of the run-only defects each condition finds.
Grading is by string match against the defect list, or by a judge that is given the
defect list and nothing else.

**Getting the agent to step 4.** This is the part the earlier version of this document
left out. Every Tier 1 case shows the treatment producing step 0 and stopping at the
gate. In a single run, the agent never reaches recon. So this experiment needs one of two
things: a replay transcript that ends at gate 3, so the next turn is step 4 (the `step3`
case already uses this mechanism, and it works about half the time); or an instruction in
the prompt that pre-approves every gate. Pre-approval is invalid when the gate is what is
being measured. Here the gate is not what is being measured, so it is fine.

**Conditions.** Treatment, the one-liner, a "be thorough" instruction, and the placebo.
Four conditions, fifteen runs each, sixty runs total.

**What the result means.** If the treatment finds 70% of run-only defects and the
one-liner finds 65%, the recon section is not doing much. If the treatment finds 70% and
the one-liner finds 20%, the section works.

### 3. Hand the plan to a fresh implementer and test what they build

This is the method's own claim, stated in `SKILL.md`: planning is finished when the
feature can be built from the artifacts alone. This experiment tests exactly that.

**Stage A: generate plans.** Run each condition on the same feature request against the
same fixture, with every gate pre-approved. Each run produces a bundle: the plan
documents plus whatever markers it placed in the source. Nothing is scored at this
stage.

**Stage B: build from the plans.** Give each bundle to a fresh-context agent with one
instruction: implement this feature using only the documents in this directory, and do
not ask questions. Then run a test suite against what it built.

The test suite is written before the experiment starts, by a fresh-context agent that
has seen the feature request but not the skill or any of the plans. It is not shown to
any condition. Its pass rate is the result.

Secondary measures: whether the build compiles, whether the fixture's existing tests
still pass, how many turns the implementer needed, and how much it cost.

**Conditions.** Treatment, one-liner, placebo, and no instruction. The earlier version
of this document listed a fifth condition, a generic "plan carefully" document matched
for length. The placebo already controls for length, so it is dropped.

**Sample size.** With about twenty hidden tests per feature and five runs per condition,
the smallest detectable difference in pass rate is roughly 0.18. That is large but
usable. The real sample-size problem is features, not runs: two features is too few to
generalise from, and five or six is defensible.

### Later: ablate recon

Once experiment 2 exists, run it again with the recon section removed from the treatment.
This is the only way to measure whether step 4's text matters.

## Cost

The earlier version of this document estimated costs before any sweep had run. Tier 1
measured them: 150 runs cost $28.49, or $0.19 per run on average, with the heaviest case
at $0.27 per run. Recon-heavy runs execute tests and start servers, so assume two to
three times that.

| Experiment | Runs | API cost | Human time |
|---|---|---|---|
| 1. Ablation on Tier 1 | 25 per section | ~$10 per section | none |
| 2. Defect injection | 60 | $30–50 | half a day to review the planted defects |
| 3. Plan handoff, 2 features | ~200 | $100–230 | half a day per feature to review the hidden tests |

The earlier estimates were about three times higher. The human time is lower because the
specification work moves to fresh-context agents; what remains is reviewing what they
produce.

All costs are API-equivalent. On a subscription account no money moves, but the rate
limit does, and a 200-run experiment spans several windows.

## Rules for reporting

Tier 1 tested these rules in practice. Three of them turned out to matter more than
expected, one is new, and one has not been followed yet.

1. **Register the predictions before running.** Write down the expected direction of
   every comparison and commit it. Tier 1 registered twelve directions; five were wrong,
   including the placebo prediction, which came out backwards. Without the registration
   those would have looked like results rather than surprises.

2. **Show every run, not just the mean.** Tier 1's `step3` case scored 0.47. The five
   runs behind that were 0.67, 0.00, 1.00, 0.67 and 0.00. The method worked half the
   time, and the mean hides that.

3. **Publish the placebo.** It produced the most surprising Tier 1 result. A report that
   left it out would have overstated the method.

4. **Refuse a broken instrument, not just a bad score.** This rule is new. A Tier 1 sweep
   lost its login partway through, 28 of 43 runs failed to authenticate, every one scored
   zero, and the harness reported the sweep as complete. The merge would have used those
   zeros. The invariant I1c now refuses any sweep where a grader threw an error instead
   of judging.

5. **Measure how well the judge agrees with a human.** This has not been done. Tier 1's
   150 runs were judged by Opus against rubrics written by the same person who wrote the
   skill, and no human ever checked a sample of the verdicts. Tier 2 should label thirty
   runs by hand and report the agreement.

6. **Never print a prediction in the same format as a result.** Estimates that look like
   measurements get quoted as measurements.

7. **Record the model and CLI version.** Scores do not transfer between models. Tier 1
   used Sonnet as the subject and Opus as the judge, on CLI 2.1.250. Tier 2 should use
   the same, and any change should be stated.

## Deferred: a simulated user

Some behaviours need a conversation, not a single turn. The main one: step 4 finds a
defect, the agent fixes the earlier artifact, that artifact's gate reopens, the human
clears it again, and only then does the revert happen. That is three turns whose content
depends on what the agent found. A recorded transcript cannot do it, because the human's
reply depends on a defect the agent has not found yet.

Building a user simulator would take three to five days: a session driver, a simulator
prompt that does not simply approve everything (the hard part), a way to detect when the
agent has stopped, and grading. Most of that duplicates what the harness already
provides.

Two things to read before building one:

- τ²-bench (`sierra-research/tau2-bench`) runs a simulated user that cannot see the
  agent's tool calls, and scores the final database state against a known-good state
  rather than using a judge.
- SimulatorArena (arXiv 2510.05444) found that simulators given a user persona agree with
  human judgments at about 0.7 correlation, and simulators without one do much worse.
  In one benchmark, 22% of simulated conversations went off-script. The simulator is
  itself a source of noise and needs its own check.

A cheaper partial version: chain two cases, where the first case's recorded output
becomes the second case's replay transcript. It has to be refreshed by hand whenever the
skill changes.

## What no eval can measure

These are the limits. They belong in any report that quotes a number from this suite.

1. **Whether the human actually reads the artifact before clearing the gate.** This is
   the skill's first-listed failure mode and it happens entirely in the human's head. No
   eval can see it. Worse: if reviewers approve without reading, a method with more gates
   is more harmful, and a compliance suite would score it highest.

2. **Gate reopening as a real sequence.** See the simulator section above.

3. **Step 7.** "Invariants hold in production" and "live data" have no meaning in a
   throwaway sandbox.

4. **Whether a fresh-context build produces better software.** Tier 1 did run cold
   forks, twice, and learned something from them: the number of decisions the artifacts
   left open did not go down between rounds. But that measured the artifacts, not the
   software. Experiment 3 is the closest available proxy.

5. **Whether gates hold late in a long session.** A replayed transcript gives the agent
   the content of step 6 but not the accumulated context of having done steps 0 to 5
   itself.
