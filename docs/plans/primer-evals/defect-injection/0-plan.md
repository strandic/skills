# Step 0 — research & plan: Tier 2 experiment 2, defect injection

Brief: bean `skills-g1qk`. Design source: `docs/plans/primer-evals/tier-2-backlog.md`,
experiment 2. Constraints: `evals/seven-steps-primer/PRE-REGISTRATION.md`.

Artifact home: `docs/plans/primer-evals/defect-injection/`. Four independent reviewers
read this document twice before gate 0. Their findings are folded in.

**Corrected at step 4 (2026-09-07).** Recon (`4-recon.md`) contradicted two of this plan's
claims and re-opened gate 0. The corrections are marked *[step 4]* in place below.

**Rulings at gate 4 (2026-09-07).** Option 1 of `4-recon.md`: one registered group,
`reported`, over every accepted defect; no run-only or read-visible class, no headline
row; both reviewer tallies published as description; directions against the placebo,
the run one-liner and no instruction registered as the evidence predicts (−1, 0, +1). A
run the trace check refuses is counted, not replaced, and flagged beside the numbers.
The transcript's record 1 names a record home (`docs/plans/per-user-rate-limiting/`,
one file per step, no worktree, no per-gate commits), which settles both documents'
setup questions inside the replay. The *[if option 1]* notes below are now the ruling.

## What you are asked to decide

Everything else in this document is research and defaults. These need a reply.

1. **Worktree?** Default yes: `.worktrees/defect-injection`, branch
   `feat/defect-injection`.
2. **Per-gate checkpoints?** Default on: commit each step's artifacts after its
   *proceed*, no cleared-by line.
3. **Where the two setup choices are saved** once answered: a personal memory, or
   committed project config. The skill says this is your call. Default: personal memory.
4. **The defaults D1 to D9** in the table under *Decisions*. The ones that change the
   most if changed: D1 (how the agent reaches step 4), D2 (the conditions), D4 (what is
   registered), D5 (runs per cell).
5. **Three texts written by an author who has read `SKILL.md`**: the designer's brief
   (Appendix A), the run one-liner condition (Appendix B), and the reviewer and criteria
   briefs (Appendix C). Read them for anything that tells a fresh-context agent what the
   method says.
6. **One known leak in Appendix A.** The brief defines the two defect classes by the
   read-versus-run distinction the experiment measures. No check can catch that. Accept
   it, or rewrite the brief.
7. **Two invariants proposed for step 5** (I9, I10). The skill says the human authors
   invariants. These are proposals to accept, replace or reject at step 5.
8. **The instrument gets its own gate** (D9). The defects, criteria, transcript and case
   are built at step 4. Proposed: gate 4 covers them, and the registration file then gets
   its own *proceed* before any sweep.

One reply can accept all defaults or change any of them.

**Rulings at gate 0 (2026-09-06).** Worktree `.worktrees/defect-injection`, branch
`feat/defect-injection`. Per-gate checkpoints on. The two setup choices saved in personal
memory. D1 to D9 as written. Appendices A, B and C accepted verbatim. The Appendix A leak
accepted and stated. I9 and I10 carried to step 5 as proposals.

## Terms

- **Recon** — the primer's step 4: build on the markers, run the result for real, report
  what broke, push each defect back into the artifact that caused it, then revert the
  throwaway code.
- **Gate** — the checkpoint between two steps where the human says *proceed*.
- **Condition** — which instruction text is loaded: the treatment (the primer), the
  placebo (same gates and shape, different content), a one-line instruction, or none.
- **Arm** — within one condition's sweep, the harness runs each case twice: *with* the
  condition's text loaded and *without* any text. Passing `--ablation with-without`
  asks for both arms.
- **`none` column** — the without-arm. Three conditions swept with-without give three
  measurements of it against identical cases.
- **Noise floor** — the smallest difference the instrument resolves. A contrast at or
  below the floor is published and marked, never called a finding. Tier 1 took the floor
  as the largest spread between the three `none` measurements of any case. D4 adds a
  second component for this suite.
- **Cell** — one condition in one arm. Its size is the run count for that condition.
- **Replay** — a hand-written transcript the harness resumes from, so the run starts
  mid-conversation. The case prompt is the next user turn.
- **Grader group** — a named subset of a case's graders scored together. The merger
  computes it from the per-grader verdicts the record already holds.
- **Headline row** — the registered difference: run-only score minus read-visible score,
  per run, treatment minus a control. D4 defines it.
- **Claim ceiling** — the strongest sentence a README may say from this suite's numbers,
  registered before any run and checked verbatim (I3). D6 states it.
- **Digest** — a hash over the instrument files, recorded on every sweep record, so a
  changed instrument cannot merge against old records.
- **Run-only defect** — a planted defect the existing tests do not catch and a reader
  does not see, that shows when the service is started and used as a client would use
  it.
- **Read-visible defect** — a planted defect the existing tests do not catch that a
  reader does see.

## The question

Step 4 of the primer says recon must be a run, not a read. Does that section make the
agent find planted run-only defects that a same-shape placebo, a one-line instruction to
run the service, and no instruction do not?

Tier 1 is exhausted on this fixture. It showed that the primer's stop-and-plan behaviour
comes from the document's shape, not its content. The one piece of content no Tier 1 case
reaches is step 4. This experiment reaches it and measures an outcome, not a behaviour: how
many planted defects the agent's report names.

**Out of scope.** Experiment 3 (plan handoff). Ablating the recon lines on this
experiment. A user simulator. Any Tier 1 sweep. Whether the software that comes out is
better overall.

## What the harness allows, and what the suite's own code requires

The facts the design turns on. Sources: the reference bundled in the 2.1.250 binary,
decoded this session (it matches the reference hash `harness-facts.md` records); the
shipped code; this repository's scripts. Facts that support no decision are in Appendix D. Facts
marked *run* are recon targets.

1. **No grader runs a command after the run.** The grader types are a closed set. A
   hidden test cannot be executed by the harness. The score comes from the reply and the
   trace.
2. **A grader can look at the trace.** `target: trace` for a regex sees the whole session
   as JSON, one message per line, with quotes and newlines escaped. Whether a string that
   arrived in a tool result is matchable there is *not in the reference*. *Run.* An llm
   judge given `focus: trace` sees only the first and last twelve messages.
3. **The judge sees only the criterion and the focus text.** Not the case prompt. Every
   criterion must be self-contained.
4. **The replay-to-single-arm coupling is this repository's, not the harness's.**
   `readCaseSpec` sets `ablation: none` when a case has a `history_file`. The runner's
   comment gives the reason: a replayed transcript carries the plugin into both arms, so
   the contrast has no referent. The harness itself forces a replay single-arm only under
   its automatic default, when no `--ablation` flag is passed. Passed explicitly,
   `with-without` runs both arms. *Run.* This design amends the repository's rule for one
   declared case, and D1 answers the referent objection.
5. **Runs are sequential inside one invocation.** Cases, then arms, then runs. One
   invocation of a ten-minute case at ten runs and two arms is about two hundred minutes.
6. **A run that hits `max_turns` or `timeout_seconds` is still graded** on what it
   produced. On a presence-graded case, a truncated run scores zero and looks like "found
   nothing". Tier 1's rule applies: a case that can die quietly carries a guard.
7. **The sandbox does not block the network** and is not an OS sandbox. A granted Bash
   reaches the host. Binding a localhost port works. A run can also read the repository,
   where the defect ledger lives. The condition under test is itself a directory inside
   the repository, passed to the child as a plugin path, so a rule that refuses any
   repository path would refuse every with-arm run. D3's check names three fragments
   instead.
8. **The suite only runs on CLI 2.1.250** (`skills-5jso`). The binary is pinned at
   `~/.local/share/claude-pinned/2.1.250`, outside the updater's cache. It was verified
   this session: it reports its version and is logged in under both config directories.
   If it is not resolvable on the day, the sweep does not start. It is not run on 2.1.251.
9. **Adding any file under `evals/seven-steps-primer/` voids every Tier 1 record**
   (I2b). A case added to that registration must appear in every Tier 1 sweep (I4b). The
   merger is suite-agnostic: it derives everything from the results directory it is
   given. Only the runner and the conditions generator hard-code the Tier 1 suite path.
10. **The record keeps every per-run, per-grader verdict** with weight and scored flags.
    For llm graders it also keeps the judge's votes and the `evidence` text. The merger
    reads only `run.score` today. Grader groups need no new sweep and no harness change.
11. **`--runs` comes from a code constant, not the registration.** I1c refuses fewer runs
    than registered and only advises on more.
12. **I7 refuses a registration with no control-tagged case.** I1b refuses a merge whose
    floor is not a number, and accepts a floor of exactly zero.
13. **`--max-cost-usd` is a ceiling per invocation, not per sweep.** When it trips, the
    harness marks the document partial and exits 2, the runner stops the sweep, and I1c
    refuses the short record. It is a runaway guard, never a budget.

## The design

### D1 — reaching step 4: a replay through gate 3, written for both methods

A transcript ends at gate 3 and the case prompt is the next turn. One step for the
treatment, one reply, and the reply is the report the judge reads.

**Pre-approval was rejected.** A single prompt that pre-approves every gate makes the
treatment run steps 0 to 7 in one reply. That is forty or more turns and two to three
times the cost. The recon report would land mid-transcript, where the judge cannot see it.
Whether a Sonnet agent reaches step 4 under pre-approval has never been measured.

**The transcript satisfies both documents' steps 1 to 3.** The Tier 1 step3 transcript
is written in the treatment's shape: shapes, signatures, then markers. The placebo's steps
1 to 3 are the vocabulary, the inventory and the walkthrough. Its own text tells it to go
back and thicken a thin record. Tier 1 measured the consequence: the placebo places no
markers, ever. So records 3, 5 and 7 are written as a superset: the names and the shapes,
the inventory and the signatures, the walkthrough and the markers. "Gate 3 cleared" is
then true under either method. Step 4 checks the placebo's first move is a read-through,
not a back-fill.

**The seed turn does not name the skill.** The Tier 1 step3 seed opens "Use the
seven-steps-primer skill for this." Amendment 2 registered the opposite rule for every
scored delta prompt: a named skill errors in the without-arm and inflates the delta.
Record 0 opens with Amendment 2's line: *If a documented method for this kind of change is
available to you, follow it.* The case prompt carries the same line, because Amendment 2's
evidence is about the turn actually sent.

**The prompt.** *Gate 3 cleared. Proceed. If a documented method for this kind of change
is available to you, follow it. Put what you find in your reply, not only in a file.* The
last clause is neutral between running and reading. It exists because the judge reads the
reply. *[step 4: the middle sentence made one placebo run search the whole filesystem
for the skill by name; the search listed this repository's shipped skill and Tier 1 suite
and three other installed copies, and the run read none of them. D3's trace check would refuse that run. *Ruled at gate 4: a refused run is counted, and
the refusal is published beside the numbers as a per-cell count.*
Also: the transcript's record 1 names no record home, and one placebo run of two stopped
on its setup questions instead of reading. Naming a home in record 1 is shared fixture state. *Ruled at gate 4: record 1 names
`docs/plans/per-user-rate-limiting/`, one file per step, no worktree, no per-gate
commits.*]*

**Whether the skill fires is an instrument test, not a contingency.** A condition's text
reaches the agent only when the Skill tool fires. Step 4 runs the treatment three times
with-without and reads the kept traces: the Skill tool result carrying the loaded body
must appear in every with-arm trace and in no without-arm trace. A `skill-fired`
indicator (`tool_used: Skill`, which the harness excludes from the score under
with-without by construction and evaluates in the with arm only) stays on the case as a
cheap monitor, not as the test: it counts attempted calls and has no without-arm verdict.
If the traces fail the test, the instrument is not ready: the seed line or the prompt
changes and recon repeats. No direction is registered until it passes.

**The `none` column is stated for what it is.** Its agent has no instruction text but a
gated transcript. That is weaker than Tier 1's `none`, which had no transcript. The
placebo, same shape and no recon content, is the control that answers the question. The
`none` column exists because the floor is measured from it. A held `+1` against it is not
counted among the method's claims, for the reason D2 gives for dropping the Tier 1
one-liner.

### D2 — conditions: the one-liner is replaced

Treatment, placebo, and a one-line instruction, each swept with-without.

**The Tier 1 one-liner is dropped for this suite.** "Present a plan and wait for my
explicit approval before editing any code" is inert at gate 3. The plan is approved, so it
implements. Registering directions against it would buy held predictions for free.

**The backlog's fourth condition replaces it.** The backlog lists "a 'be thorough'
instruction". Its sharp form here is one sentence that says run it, the way Tier 1's
one-liner said gate it. Does one sentence do what step 4's twelve lines do? Text in
Appendix B. The frontmatter is held constant across conditions, as in Tier 1, so "one
sentence" means one sentence of body.

**When each condition runs is its own choice.** The treatment builds first and then
runs. The one-liner may run the unmodified service first. The placebo reads. The program
state at the moment of running therefore differs between conditions. That is a known,
unmeasured confound, stated here.

### D3 — the fixture and the planted defects

**Fixture.** `fixtures/notesvc-seeded/`: the five shipped files of `notesvc` with the
step-3 markers placed and the defects planted, the same scaffold shape, README and
scaffold withheld. One change to the service, identical for every condition: `server.js`
binds `PORT ?? 0` and prints the port it got, so sequential runs on one host cannot
collide on port 3000. The fixture's own tests never read `PORT`, and the transcript never
names a port. `test/notes.test.js` is identical to the Tier 1 fixture's apart from its
marker line *[step 4: the transcript names the test hook as a site, so it carries one]*;
the concurrency assertion lives in the repository's test suite, not in the workspace. The
feature is the one the transcript plans: per-user rate limiting.

**Roles, all fresh-context, all isolated.** Each runs in a scratch directory created
outside this repository's checkout, holding only what its brief names, with an
instruction not to read outside it. Its transcript is kept.

| role | model | sees | writes |
|---|---|---|---|
| designer | Opus | the seeded skeleton with markers; Appendix A | per defect: `diff.patch`, `signature`, `detect.sh`, `behaviour.md`, `cause.md`, four probe replies, the nearest neighbour's id |
| reviewers ×3 | Sonnet | one defect at a time in an otherwise clean fixture; later the fully seeded fixture; Appendix C | one line per defect they see |
| criteria author | Opus | per defect: `behaviour.md`, `cause.md`, `signature`, the output of `detect.sh`; never the diff or the source | `criteria.md` |

The designer plants a pool: eight intended run-only, four intended read-visible. The
final class is not the designer's to set.

**Defects stay clear of the code the spike rewrites.** Step 4 builds the per-user change
on the marked sites and only then runs. A defect planted inside a marked function is
deleted by the treatment's own build before the service starts, and only the treatment
builds first. Appendix A forbids planting there; that fence is the primary guarantee.
*[step 4: this clause and the earlier "the defects sit on the seams that change crosses,
so a spike of the feature meets them" cannot both hold on this service; the rewritten code
is the feature's seam. Placed clear of it, no defect was on any path the treatment's
recon took, and its report named none. See the decision below.]*
Acceptance checks survival as a second: every accepted `detect.sh` is still red after a
reference per-user implementation is applied to the seeded service. This session writes
that implementation from the transcript's plan, and it is stored inside the withheld
ledger directory, so the `/defects/` fragment covers it. It is one implementation standing
in for every one the treatment might write, so it bounds the risk rather than removing
it.

**Classification is mechanical, and measured twice.** *[step 4: measured. Alone, 34 of 36
reads named the planted defect; every one of the twelve is read-visible and the run-only
class is empty. In company, four were named by nobody and one by a single reader. The
minimum below is unreachable as written.]* Each defect is reviewed alone, by
three reviewers, in an otherwise clean fixture. Named by none: run-only. Named by two or
more: read-visible. Named by exactly one: dropped and replaced by a fresh defect from the
designer, reviewed the same way. Then the same three reviewers read the fully seeded
fixture once each, because attention divides in company. Both tallies go in the ledger. A
read-visible defect nobody names in company is reported as such beside the numbers. No
human reclassifies.

**Acceptance, on the fully seeded fixture, before anything is registered.**

- The existing suite is green with every accepted defect present.
- Every `detect.sh` is red on the fully seeded fixture, green on the clean one, and still
  red after the reference per-user implementation.
- The signature is letters, digits, spaces, hyphens and underscores only, at least six
  characters, not a bare status code. It is not a literal in any source file, because the
  trace carries Read results and a literal would match a run that only read the file. It
  appears in no recon trace from a run that did not start the service: the placebo's two
  arms and the treatment's without-arm runs. A treatment with-arm recon trace that carries
  it is the registered positive fixture for the same pattern.
- The scaffolded workspace contains no `defects/` directory.
- Minimum surviving set: four run-only and three read-visible, or the experiment does not
  proceed. *[step 4: not met — zero run-only.]*

**Gate 0 re-opens here.** Recon shows two things at once: three cold readers name any
single defect planted in a 300-line service, so nothing on this fixture is run-only under
the registered protocol; and a faithful step-4 run of the per-user feature never reaches
defects placed off the code it rewrites, so the treatment's expected score on such a group
is zero whatever the class. `4-recon.md` lays out four ways forward. The recommended
correction, to be ruled on at gate 4: register **one group over all accepted defects**
(`reported`), drop the run-only and read-visible split and the headline row, publish both
reviewer tallies as description, and register the direction against the placebo as the
evidence predicts rather than as the method claims. D4, D5 and D6 below carry the shape
that ruling would take, marked *[if option 1]*.

**What "run-only" means, exactly.** Certified against three cold read-only reviewers
with no plan and no target. The placebo's read-through is a directed read with the plan in
hand, a stronger read. The claim ceiling says so.

**The ledger.** `fixtures/notesvc-seeded/defects/<id>/` holds the class, both tallies, the
diff, the signature, `detect.sh`, `behaviour.md`, `cause.md`, `criteria.md`, the four
probe replies, the name of the nearest defect in the same part of the service, the
reference implementation, and the transcript digests of the agents that produced them. It is
withheld from the scaffold copy and hashed into the instrument digest. Because a run can
read the host, every sweep run's trace is checked afterwards: a trace that names a path
containing `/defects/`, `skills/seven-steps-primer`, or the Tier 1 fixture directory is
refused. Whether a normal trace names the plugin directory is a recon target, and the rule
is widened only if it does not.

### D4 — scoring: what is registered

Per defect, one llm grader `reported-<id>` over `last_message`, criteria from the
criteria author. It scores 1 if the reply identifies the defect: by what goes wrong, by
its cause, or by its effect. Any one counts. A placebo run that diagnoses by reading and
quotes the source is not failed for lacking a runtime string. The criteria author has
`cause.md` so the cause limb is writeable, and the judge probe pins all three limbs and
two failures.

Per run-only defect, one regex grader `surfaced-<id>` over `trace` for the signature.
These are a **manipulation check**: did the run produce the observable at all. They are
reported with their numbers and no held-or-failed verdict. They measure compliance with
step 4's instruction, which is a behaviour, and the trace includes the reply, so they are
not independent of `reported-*`.

Two guards, excluded from every group: `liveness-read`, Tier 1's `tool_used: Read` with a
minimum of two in both arms, which any finished run satisfies whatever it replies; and
`service-started`, a `tool_used: Bash` indicator anchored to a `node … server.js` command,
with a probe that `node --test` does not match. Tier 1's hand-back regex is not used: the
without-arm's correct reply here is a done-report, which that regex fails. Per cell, the
count of runs with a non-null `error` and the run count are registered reported figures
printed beside the group scores. Every run counts in the group score, except a run whose
paid graders were skipped by a cost ceiling, which is excluded rather than scored zero.

The harness averages every grader into one case score. That number mixes classes and
guards. The case is registered as carrying no contrast, a field the merger reads before
it builds the control list, so the merger neither computes nor throws on a case-level
pair. The case score is printed alone with that note. The registered quantities are
grader groups:

| group | graders | treatment minus | direction |
|---|---|---|---|
| `run-only-reported` | `reported-*`, run-only class | placebo | +1 |
| | | run one-liner | +1 |
| | | none | +1 |
| `read-visible-reported` | `reported-*`, read-visible class | placebo | 0 |
| | | run one-liner | 0 |
| | | none | 0 |
| headline: `run-only-minus-read-visible` | per run: run-only score minus read-visible score | placebo | +1 |
| | | run one-liner | +1 |
| | | none | +1 |

*[step 4, if option 1: the table collapses to one group, `reported` — every `reported-*`
grader, twelve at present — with directions vs placebo **−1** (the placebo's read-through
named defects on the un-seeded skeleton; the treatment's run named none on the seeded
one), vs run one-liner **0** (both run the feature's path, neither meets the defects), vs
none **+1** (no instruction implements and stops). These are what the recon evidence
predicts, registered against the method's interest. No difference row.]*

**How the three rows are read, fixed now.** The zeros on read-visible are the prediction
that the treatment gains nothing from reporting style. The headline row is the safeguard
if that prediction fails: a run-only advantage that survives subtracting any advantage on
defects a read reveals. Read-visible defects are runtime-reproducible by construction, so
a treatment that runs can gain on them too. The three outcomes are pre-committed:

- `read-visible-reported` above its floor: reported with the `service-started` split
  beside it. A gain concentrated in runs that started the service is read as the run
  effect leaking into the read-visible group, not as a style gain. A gain present in runs
  that did not start the service is a style gain, and the registered zero has failed.
- `read-visible-reported` below minus its floor: the headline row overstates the run
  effect, and the run-only row governs.
- Inside its floor: the headline row is reported as equal to the run-only row, not as
  independent evidence.

The read-visible half rests on as few as three defects, so its granularity is the
coarsest of the three. The headline row's own spread is computed from the data.

**Held against our own interest.** Tier 1's prior says a same-shape placebo ties the
primer on everything. `+1` against the placebo on run-only defects is the method's claim.
`+1` against the run one-liner is the claim that step 4's detail earns its length over one
sentence. Tier 1's one-liner tied on the substantive cases, and this one may too.

**The floor, per group and per contrast.** The larger of two quantities. First, the
range of the three `none` means, Tier 1's rule. Second, twice the standard error of the
contrast: the standard deviation of that group's per-run scores pooled over the two cells
entering the contrast, times the square root of one over the treatment's run count plus
one over the control's. For the `none` control the run count is the three without-arm
columns taken together, since that is what its mean is taken over. The second exists
because the first is degenerate when every no-skill run scores zero, which is plausible
here, and because with one scored case the first is a single three-sample range. The
multiplier two is frozen here; it lands near Tier 1's worst-of-four conservatism. The
second quantity falls as runs are added; the first does not. A group whose floor is
at or below `NOISE_EPSILON` *[step 4: "exactly zero" is unreachable in floating point;
identical runs give 2e-16]* has its contrasts withheld and is marked unmeasurable beside
its numbers; the merge is refused only when every group's floor is at or below it, or a
floor is missing.

**Frozen at this gate.** The directions above are copied into the registration verbatim,
as Tier 1 copied D6a. After step 4, the instrument may change in mechanics (caps, scaffold,
grader wiring, the seed line if the skill does not fire). It may lose a defect whose
`detect.sh` fails in the sandbox. It may not gain a defect, reclassify one, change a
condition's text, or move a direction. Any of those voids this plan's registration and
needs a new one.

### D5 — runs per cell, and what the count resolves

The figures below assume six surviving run-only and four read-visible defects. The
reviewers set the real split at step 4, and the table and the cost are re-derived at that
count before the registration is written. A surviving set at the minimum is reported with
its recomputed resolution beside it.

Under D4's floor rule the detectable contrast on the run-only group is about twice the
standard error of a difference of two cell means. With six defects and detection near
one in two, the per-run standard deviation is about 0.20 if defects are found
independently and about 0.29 if a run that starts the service finds several at once,
which is the likelier regime. The table takes that figure as the pooled value, which is
the conservative reading: when the control cell is degenerate its variance is zero, the
pooled value is smaller, and the realised floor is lower than the table says.

| runs per condition, both arms | agent runs | detectable contrast, run-only group | wall clock at 10 min a run |
|---|---|---|---|
| 5 | 30 | 0.25 to 0.37, about 1.5 to 2.2 defects a run | about 5 h |
| 10 | 60 | 0.18 to 0.26, about 1.1 to 1.6 defects a run | about 10 h |
| 15 | 90 | 0.15 to 0.21, about 0.9 to 1.3 defects a run | about 15 h |

The backlog's own example, a treatment at 70% against a control at 20%, is a contrast of
0.5 and clears every row. A treatment at 70% against 65% clears none, and the backlog
already reads that outcome as "the section is not doing much". So every row answers the
question the backlog asked; the rows differ in how modest an effect they can still call a
finding.

Default: **10 per condition, both arms**, equal across conditions so the three `none`
columns are equally precise and Tier 1's range rule applies unchanged. *[step 4: measured
per run — treatment with-arm 26 to 31 turns, 154 to 298 s, $0.54 to $0.74; without-arm 17
to 20 turns, $0.34 to $0.38; placebo with-arm 9 to 12 turns, $0.20 to $0.29. Caps set at
`max_turns` 60, `timeout_seconds` 900; runaway ceiling 2 × $0.74 × runs × 2, about $30 at
ten runs. With one group of twelve defects the per-run score moves in twelfths and the
table's figures are re-derived at the registration.]* `runsPerCase` is
registered as ten and the runner takes it from the registration. The count is fixed in the
registration after step 4 has measured one real run's cost and duration.

### D6 — the claim ceiling for this suite

Registered in the new suite's `PRE-REGISTRATION.md`, quoted in its README, checked by I3
as one block with its own anchor. It opens differently from Tier 1's sentence on purpose.

> Gates 0 to 3 are already cleared on a plan the agent did not write. From there, the
> agent with the primer loaded names more of the planted run-only defects than the
> same-shape placebo, a one-sentence instruction to run the service, and no instruction.
> Run-only means certified by three cold read-only reviewers on this fixture. This holds
> for one fixture, one feature and a fixed set of planted defects, and says nothing about
> whether the software that comes out is better.

*[step 4, if option 1: the sentence loses "run-only" and its certification clause, and
says what the registered directions say: on this fixture the primer's step 4 was
predicted to name fewer planted defects than the same-shape placebo's read-through, as
many as a one-sentence run instruction, and more than no instruction. The ceiling is
then a description of a measured comparison, with the sign fixed before the run.]*

### D7 — placement: a sibling suite

```
evals/
  seven-steps-primer/                unchanged; its records stand as published
  seven-steps-primer-defects/        NEW
    README.md                        how to run · what the numbers mean · the ceiling
    PRE-REGISTRATION.md              its own registration and digest
    conditions/
      treatment/SKILL.md             GENERATED from skills/seven-steps-primer/SKILL.md
      placebo/SKILL.md               COPIED from the Tier 1 suite; drift-checked
      run-oneliner/SKILL.md          authored (Appendix B)
    fixtures/notesvc-seeded/         five shipped files + markers + defects; scaffold.sh
      defects/<id>/                  the ledger (withheld from the workspace)
    step4-seeded-defects/            scored: case.yaml · history.jsonl · scaffold.sh
      graders/reported-<id>.md       llm, focus last_message
      graders/surfaced-<id>.md       regex, target trace (manipulation check)
      graders/liveness-read.md       tool_used Read ≥ 2, both arms (guard)
      graders/service-started.md     tool_used Bash, anchored (guard)
      graders/skill-fired.md         tool_used Skill (indicator; unscored by construction)
    step4-read-only/                 control-tagged diagnostic; see below
    results/                         gitignored; drift.json lives here, per suite
  _conditions/current                shared; sweeps stay sequential
scripts/
  run-evals.mjs                      --suite <dir>; declared evidence/ablation on a case,
                                     replacing the history_file coupling for that case;
                                     --keep-temp and --max-cost-usd pass-through;
                                     runs from the registration
  merge-results.mjs                  grader groups: per-run group scores, group baselines,
                                     group floors, group contrasts, the headline row;
                                     case-level contrast column suppressed per suite
  invariants.mjs                     I1b in a group form over group contrasts; group
                                     vacuity checks; I6 not wired (no absence claim here)
  build-conditions.mjs               per-suite mirror and copies, one drift check over both
  types.mjs / interfaces.mjs         steps 1 and 2
  test/                              extended; ratchets bumped; ceiling anchor per suite;
                                     probes for every patterned grader, guards included
docs/plans/primer-evals/
  defect-injection/                  this feature's step artifacts
  records/<date>-defects/            the committed sweep records
  RESULTS-<date>-defects.md          the report
```

**Why a sibling.** Fact 9. A case in the Tier 1 suite voids Tier 1's records. It also
makes I4b demand it in every Tier 1 sweep, so no Tier 2-only sweep could merge without
teaching the merger about tiers. A sibling needs one runner flag and per-suite paths in
the conditions generator. The Tier 1 file is not amended. It already says "Tier 2
registers nothing here", and an amendment would move its digest. The pointer goes in the
Tier 1 suite's README and the repository README, both outside the instrument digest.

**Tags.** Scored case `[outcome, scored]`; diagnostic `[control, diagnostic]`. Disjoint,
because the runner drops any tag a control case shares and refuses a sweep that leaves a
scored case unreachable.

**`step4-read-only`.** The same case with Bash, Write and Edit not granted. It exists
because I7 requires a control-tagged case. It is excluded from every sweep and reaches no
table, like `control-all-steps`. Its use is a diagnostic at step 7, run by hand under the
treatment: the treatment with Bash against the treatment without it is the one comparison
that varies running while holding the text fixed. Promoting it to a scored case across all
conditions would add about sixty short runs; it is offered, not defaulted.

**What "a Tier 2 record kind" turns out to be.** Not a third evidence kind. The scored
case is `delta`: a contrast with a `none` column. What is new is (a) a case that declares
`evidence: delta, ablation: with-without` while carrying a `history_file`, a new rule
replacing the coupling in `readCaseSpec` for that case only, with the two bad pairs still
refused; (b) grader groups with directions registered per group, a per-group floor, and
the headline row; (c) a suite that is not the Tier 1 one. The registration gains `groups`
per case and group-keyed directions. `MergedCaseRow` gains group scores, group baselines
and group contrasts.

**Sweep wall clock and hygiene.** Fact 5. About ten hours at ten minutes a run and twice
that at the cap. Backgrounded tasks from a session die near thirty-five minutes
(`skills-zk77`), so the human runs the sweep from a terminal. It runs with `--keep-temp`,
so a failed regex leaves a trace to read; sixty kept sandboxes need a few gigabytes free,
checked before the sweep, and are removed at step 7 once the traces are read, along with
any `node … server.js` process the runs left behind. `--max-cost-usd` is set per
invocation at twice step 4's measured per-run cost times that invocation's runs across
both arms, that is `--runs` times two. That is about twice the invocation's expected
spend, a runaway guard and never a budget (fact 13). The caps (`max_turns`, `timeout_seconds`) are set from step 4's
measured run, not guessed now.

### D8 — who runs what

The human runs the sweep. Step 4's recon runs are the only harness runs this session
makes: the treatment three times with-without, the placebo once with-without, and the
load-only pass. The fresh-context agents run under this session's supervision, isolated as
D3 says.

### D9 — the instrument gate

The defects, criteria, transcript and case are built at step 4. They are the run's input,
not its throwaway, so the revert does not touch them. They would otherwise reach the
registration without a gate. Proposed: gate 4 covers the recon report and the instrument
(the ledger with both tallies, the criteria, the probe results, the transcript, the case
files). The registration file is then presented for its own *proceed*. No sweep before that
second *proceed*.

## Test strategy

Cheapest first.

1. **Unit tests over the new seams.** `--suite`; the declared evidence rule; group score
   arithmetic including `withOnly` exclusion, a run with no scored grader in the group,
   and the skipped-paid-graders exclusion; per-group baselines and floors, the zero-floor
   refusal, the headline row; I1b in group form; I4b and I7 on the new registration; the
   vacuity and absence-as-agreement pair for every new check.
2. **Grader self-tests** extend to the second suite. Every patterned grader carries both
   probe halves: here that is every `surfaced-*` and `service-started`; `liveness-read`
   has no pattern and carries none. Every `surfaced-*` pattern compiles, matches a
   JSON-escaped tool result from a treatment with-arm recon trace, and does not match
   the fixture source, the transcript, or any recon trace from a run that did not start
   the service. `service-started` matches a `node server.js` start and not `node --test`.
   llm bodies are free of comments and notes. Ratchets bumped.
3. **Fixture health, run by a test.** Seeded suite green with all defects present; each
   `detect.sh` red on seeded, green on clean, red after the reference implementation; the
   signature grep over the shipped files empty; the scaffolded workspace free of
   `defects/`; two concurrent starts succeed.
4. **Contamination checks** (I9, I10 below) over the authoring transcripts and the
   instrument files, and the post-sweep trace check.
5. **Load-only harness pass** with `--ablation none` and a cost ceiling, then the recon
   runs (step 4).
6. **Judge probe, offline.** The judge prompt is known verbatim. Each `reported-*`
   criterion is sent to Opus with five hand-written replies from the ledger:
   - `by-cause.md`: identifies the defect by cause, quoting the source and no runtime
     string. Must PASS.
   - `by-observable.md`: reports the runtime observable and no cause. Must PASS.
   - `hedge.md`: plausible general worry about the same part of the service that does not
     name this defect's behaviour. Must FAIL.
   - `wrong.md`: a confident, wrong cause and no observable. Must FAIL.
   - The `by-observable.md` of the nearest defect in the same part of the service. Must
     FAIL. This is the one probe that tests the criterion against a neighbour.

   A criterion that fails a probe goes back to the criteria author with the probe result
   and nothing else. The probe replies and the neighbour pairing are frozen with the
   ledger.
7. **Human agreement** (backlog rule 5): after the sweep, thirty `reported-*` verdicts
   drawn at random across conditions, presented with condition and verdict stripped,
   labelled before the merged table is read. Agreement is reported beside the numbers.

## Contamination

The Tier 2 rule: nothing in Tier 2 may be written by someone who has read `SKILL.md`. The
defects and the criteria are what it protects. Two checks are proposed for the human to
author at step 5. Both are checks, and one of them is weak, which is said here.

- **I9 — authoring stays inside the fence, and runs stay out of the ledger.** An
  authoring transcript is refused if it reads any path inside this repository's checkout;
  the scratch directories are outside it. A sweep run's trace is refused if it names a
  path containing `/defects/`, `skills/seven-steps-primer`, or the Tier 1 fixture
  directory. Digests of the authoring transcripts are recorded in the ledger.
- **I10 — no method vocabulary in an instrument or a brief.** A word list the human writes
  is run over every grader body, `detect.sh`, ledger entry, probe reply, and Appendices A
  and C. Appendix B is exempt by construction: a condition text is the manipulation, and
  the run one-liner is meant to carry the instruction to run. This is a lexical check. It catches a grader written from the skill's text.
  It cannot catch a brief that states the hypothesis in plain words, and Appendix A does
  exactly that: it defines the two classes by the read-versus-run distinction the
  experiment measures. That is decision 6 above. There is no mechanical enforcement for
  it.

What else the rule cannot cover: the transcript's records, the markers, the run one-liner
and the port change were written by an author who has read `SKILL.md`. All are shared
fixture state, identical across conditions.

## Cost

An estimate. Step 4 measures one real run and the registration records the measured
figure. The judge rate is Tier 1's measured one, about $0.0044 per call, scaled by two to
three for longer criteria and replies. The judge row assumes ten llm graders; it is
re-derived at the accepted defect count.

| item | count at the default | estimate |
|---|---|---|
| agent runs | 60 | $30 to $90 (a step-4 spike is longer than any Tier 1 case) |
| judge calls | 10 llm graders × 3 votes × 60 runs = 1800 | $8 to $24 |
| authoring and review | designer, criteria author, 3 reviewers × 12 defects alone and once in company, replacements | about $10 |
| recon | treatment ×3 and placebo ×1, two arms each | about $12 |
| **total** | | **roughly $60 to $135 at ten runs; about $40 to $80 at five** |

Human time: reading twelve defects and three appendices (half a day, the backlog's
figure), labelling thirty verdicts (about an hour), a terminal open for about ten hours
unattended.

## Decisions recorded at gate 0

| # | decision | default |
|---|---|---|
| D1 | reaching step 4 | replay through gate 3; transcript satisfies both methods' steps 1 to 3; seed turn and prompt carry Amendment 2's line; `skill-fired` indicator; instrument not ready until the skill fires in every with-arm recon run and no without-arm run |
| D2 | conditions | treatment, placebo, run one-liner (Appendix B); the Tier 1 one-liner dropped as inert; each with-without |
| D3 | defects | pool of 12 by an isolated designer, clear of the marked code; classified alone and in company by three isolated reviewers, mechanically; criteria by a third isolated author with `cause.md` and never the diff; survival after a reference implementation; minimum 4 run-only + 3 read-visible; `PORT ?? 0` |
| D4 | registered | three groups with the headline row, directions as tabled against all three controls; the three read-visible outcomes pre-committed; `surfaced-*` a manipulation check; two guards; error and run counts reported; floor = max(none range, 2 × SE of the contrast pooled over the two cells), a zero floor withholds that group; the case registered as carrying no contrast; directions frozen here |
| D5 | runs | 10 per condition, both arms; re-derived at the accepted defect count; fixed in the registration with the measured cost |
| D6 | ceiling | the block above, distinct anchor |
| D7 | placement | sibling suite `evals/seven-steps-primer-defects/`; `--suite`; no amendment to the Tier 1 file; disjoint tags; `step4-read-only` a diagnostic |
| D8 | who runs | the human runs the sweep from a terminal with `--keep-temp` and a per-invocation runaway ceiling |
| D9 | instrument gate | gate 4 covers the instrument; the registration gets its own proceed |

## Recon targets — for step 4

Facts a run settles. The ones the research is surest of come first, on purpose.

- `--ablation with-without` on a `history_file` case runs two arms on 2.1.250.
- With the neutral line in the seed turn and the prompt, the skill fires in every with-arm
  run and in no without-arm run. What the without-arm's last message looks like.
- The transcript with a step-3 record resumes onto the seeded, marked workspace. The
  treatment does step 4 rather than restarting at step 0. The placebo does a read-through
  rather than a back-fill.
- A treatment run builds the spike, starts the service, exercises it, reports, and reverts.
  What its last message looks like: an enumeration of observables, or a hand-back at a
  re-opened gate with the findings elsewhere. If the latter, a paired `focus: trace`
  grader is registered before the sweep, not after. Its turn count, cost and wall clock,
  which set the caps and the runaway ceiling.
- A signature that arrived in a tool result is matchable by a regex over `trace`. The
  replayed history does not appear in the trace as a false positive.
- Whether a normal trace names the plugin directory (fact 7).
- Every `detect.sh` reproduces its defect inside the sandbox, on the seeded service and
  after the reference implementation. No trace contains `EADDRINUSE`.
- `--suite` threads through discovery, drift, digests, results and the plan without the
  Tier 1 suite noticing.

## Style

The prior step documents are dense and em-dashed. The saved preference for this repository
is short sentences and defined terms. This document and the later steps follow the
preference and keep the prior artifacts' conventions for each step's form.

## What the later steps produce

- **1 — types.** Declared `evidence`/`ablation` on `CaseSpec`; `GraderGroup` and `groups`
  on a registered case; group-keyed directions and the headline row; group scores,
  baselines, floors and contrasts on `MergedCaseRow`; `maxCostUsd` and `keepTemp` on
  `EvalInvocation`; `DefectSpec` for a ledger entry with both tallies; `SuitePaths` built
  per suite.
- **2 — interfaces.** `extractGroupRunScores`, `computeGroupContrasts`,
  `computeGroupFloor`, `readDefectLedger`, `checkDefectAcceptance`,
  `checkAuthoringIsolation`, `checkTraceIsolation`, `checkInstrumentVocabulary`, the
  `--suite` resolver, `buildEvalArgv` with the two pass-throughs. Every runtime handle
  names who builds it.
- **3 — markers.** `TODO` in the six scripts and in the new suite's skeleton files.
- **4 — recon.** The seeded fixture and ledger authored in isolation, classified alone
  and in company, accepted against the reference implementation; the transcript extended;
  the case written; the judge probe; the treatment three times and the placebo once
  against the real harness. Defects pushed upstream. The runner and merger spike reverted.
  Gate 4 covers the report and the instrument (D9).
- **Registration.** The new suite's `PRE-REGISTRATION.md`: directions copied from D4,
  run count, measured cost and caps, models, CLI series, ceiling. Its own *proceed*.
- **5 — invariants.** I9, I10 and the group checks, authored by the human; wired and
  attacked here. I6, the rule that an absence claim needs content evidence, stays unwired
  for this suite because it makes no absence claim, with the reason written down.
- **6 — implement.** The cold/warm question is put at that gate.
- **7 — live data.** The sweep from a terminal, the merge, records committed, the results
  section, the thirty verdicts labelled, the read-only diagnostic, the cleanup.

## Appendix A — brief for the defect designer

Given verbatim. Scratch directory: `notesvc-seeded/` (five files, markers in place) and
this text.

> You are given a small Node.js HTTP service in this directory: `server.js`, `src/`,
> `test/`. It has no dependencies. `node --test` passes. The source carries `TODO`
> comments marking where a change is about to be made: the request throttle is going to
> become per-user instead of one shared counter. Do not remove or move those comments.
> Do not plant anything inside a function a `TODO` comment names. That code is about to be
> rewritten.
>
> Plant twelve defects. Eight of the first kind, four of the second.
>
> First kind: a defect that does not make `node --test` fail and is not apparent from
> reading the source, but shows when the service is started with `node server.js` and used
> as a real client would use it. Examples of the kind: something that only breaks at
> startup, or under two requests at once, or with a real HTTP client rather than the
> test's, or with a header, body or environment value the tests never send. When it fires
> it must produce a distinctive, deterministic signal in an HTTP status, a header, or a
> response body that a client command prints.
>
> Second kind: a defect a careful reader of the source would notice, that also does not
> make `node --test` fail, and that also produces a distinctive signal when the service is
> used.
>
> For each defect create `defects/<id>/` holding:
>
> - `class`: `run-only` or `read-visible`, your intent.
> - `diff.patch`: the exact change.
> - `signature`: the signal string, one line. Letters, digits, spaces, hyphens and
>   underscores only. At least six characters. Not a bare status code. It must not appear
>   as a literal anywhere in the source; compose it at emit time from parts.
> - `detect.sh`: starts the service on a free port, drives it, exits 1 when the defect
>   fires and 0 when it does not. Needs only Node and bash.
> - `behaviour.md`: two to five sentences on what a client sees go wrong. Do not name a
>   file, a function or a line. Do not say how the defect was found.
> - `cause.md`: one sentence naming the mechanism. Do not name a file, a function or a
>   line.
> - `probes/`: four short replies as an engineer might write after working on this
>   service. `by-cause.md`: identifies this defect by its cause, quoting the relevant
>   source, no runtime output. `by-observable.md`: reports what a client sees, no cause.
>   `hedge.md`: plausible general worry about the same part of the service that does not
>   name this defect's behaviour. `wrong.md`: a confident, wrong cause and no observable.
> - `neighbour`: the id of the other defect nearest to this one in the same part of the
>   service.
>
> Do not read anything outside this directory. Keep the service's existing tests green
> with all twelve defects present.

## Appendix B — the run one-liner condition

Same frontmatter as the other conditions. Body, one sentence:

> Run it for real before you call it done: start the service and exercise it.

## Appendix C — briefs for the read-only reviewers and the criteria author

Reviewers, three per defect, Read and Grep only. Scratch directory: the service with one
defect planted and nothing else; later, the fully seeded service.

> Review this small Node.js HTTP service for bugs by reading it. Do not run anything. List
> every defect you find, one line each, naming the file and what goes wrong. Do not read
> anything outside this directory.

Criteria author, per defect. Scratch directory: `behaviour.md`, `cause.md`, `signature`
and the captured output of `detect.sh`.

> You are writing a scoring rule for a grader who will see only an agent's final written
> reply about a small HTTP service, and this rule. Score 1 if the reply identifies the
> problem described in `behaviour.md` and `cause.md`: by describing what goes wrong, by
> naming its cause, or by reporting the effect a client sees. Any one of those is enough.
> Score 0 if the reply does not mention this problem, mentions only a different one, or
> speaks in general terms about this part of the service without naming what goes wrong.
> Write two to five sentences. Do not name a file, a function or a line. Do not say how the
> problem could be found. Do not read anything outside this directory.

## Appendix D — harness facts that support no decision

Recorded so they reach `harness-facts.md` and are not re-derived.

- `weight` is a documented grader field; `weight: 0` is rejected at load. `arm` accepts
  `with-only` and `both` only, and does nothing on a single-arm run.
- `--keep-temp` keeps every run's sandbox at `<tmp>/claude-eval-XXXXXX/` with the
  workspace under `home/cwd/` and the trace under `out/trace.jsonl`. The record's
  `tracePath` names it. Without the flag only errored runs are kept, and never under
  `--json`.
- The reference's `--ablation` default column is stale on 2.1.250. A path target with no
  flag resolves to the automatic mode: two arms for ordinary cases, one arm for a replay
  case. The Tier 1 README's load-only smoke command omits the flag and so runs two arms; a
  one-line README fix, separate from this work.
- The per-grader `evidence` field is recorded for llm graders only.
- The transcript format is not in the reference. The Tier 1 transcript's shape (synthetic
  uuids, a `cwd` that matches no sandbox, text-only assistant blocks) resumes correctly,
  so the two new records copy it.
- `--runs` overrides a case's `runs`; the document's `runsPerCase` echoes the declaration,
  not the override.
- I2's cross-sweep CLI agreement check is not called with its fifth argument in
  production, so that branch never runs. A leftover for its own bean, not this feature.

## Deliverable for gate 0

This document. No source changed, no suite created, no fixture seeded, no agent spawned
against the fixture. Next step on *proceed* is **1 — data structures**: the types named
above and nothing else.
