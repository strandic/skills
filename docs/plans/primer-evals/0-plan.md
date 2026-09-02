# Step 0 — research & plan: Tier 1 eval suite for `seven-steps-primer`

Artifact home `docs/plans/primer-evals/`. Worktree `.worktrees/primer-evals`,
branch `feat/primer-evals`, per-gate checkpoints on — so `git log` is the gate
record and this document does not track its own status.

## Scope

Build a committed, runnable eval suite that answers one question honestly:
**does the primer change what the agent does, and is that change attributable to
*this* method rather than to any gating instruction?**

Four **conditions** — which instruction text is loaded when a case runs. Prompt,
fixture and graders are identical across all four:

| Condition | What it is | What it controls for |
|---|---|---|
| `treatment` | the real SKILL.md, `disable-model-invocation` stripped | — this *is* the treatment |
| `oneliner` | the thirteen-word control: "Present a plan and wait for my explicit approval before editing any code." | gating-as-an-idea |
| `placebo` | **eight** gates (steps 0-7, matching the treatment), same stop-and-wait scaffolding, arbitrary contents | this method vs any method of this shape |
| `none` | stock Claude Code | comes free as each run's `without` arm |

**Sweep** — one invocation of `claude plugin eval` over the whole case set with a
single condition installed. Three sweeps cover the three authored conditions; each
also yields a `none` column for free, because `--ablation with-without` runs every
case a second time with no plugin loaded. So **3 sweeps × 2 harness arms = 4
conditions**, with `none` measured three times over.

*Arm* stays the harness's word throughout, for the `with` / `without` pair inside a
single sweep. It is never used for the four conditions.

Explicitly **out of scope** for Tier 1: outcome evals (does the method produce
better software), defect-injection recon yield, a user simulator, CI wiring,
cross-model sweeps. Those are Tier 2 and depend on these numbers existing first.

The claim this suite can support is bounded, and the exact permitted sentence is
D7's claim ceiling, quoted in full below. It cannot support *produces better
software* at any run count.

## Module placement

**Evals live at repo root, not under `skills/`.** This is a change from the
obvious layout and the reason is `npx skills add strandic/skills`: that CLI
installs a skill by copying its directory into the user's agent skills folder. An
`evals/` tree nested under `skills/seven-steps-primer/` would ship fixtures,
controls and a placebo copy of the method into every install. Root placement also
matches the repo's growable-multi-skill shape — one `evals/<skill-name>/` per
skill as more arrive.

```
evals/
  seven-steps-primer/
    README.md                  how to run · what the numbers mean · what they don't
    PRE-REGISTRATION.md        committed BEFORE the first full sweep (D6)
    prompt-fixtures/           known-good / known-bad text for grader self-tests
    fixtures/notesvc/          zero-dep Node service + `node --test` suite
    conditions/
      treatment/SKILL.md       GENERATED from skills/seven-steps-primer/SKILL.md
      oneliner/SKILL.md        hand-written control
      placebo/SKILL.md         hand-written control
    _condition/                GENERATED, gitignored — the condition under test
    <case>/prompt.md
    <case>/graders/*.md
    <case>/case.yaml           only where context.* is needed
    results/                   gitignored
scripts/
  build-conditions.mjs         regenerate conditions/treatment, verify no drift
  run-evals.mjs                copy condition → _condition, sweep, save results/
  merge-results.mjs            4-column comparison table
  test/graders.test.mjs        `node --test` over the grader regexes
```

`plugin.json` gets `"experimental": { "evals": "evals/seven-steps-primer" }` —
whether that key accepts a path rather than a bare directory name is a **recon
target**, below.

### Why conditions are copied, not symlinked

Cases reference the condition under test by a single fixed path,
`plugins: ["../_condition"]`, and the runner copies the selected condition into
`_condition/` before each sweep. The obvious
symlink version does not work: the harness runs an ownership check that rejects a
plugin path that "is a symlink (or can be read as a link)" (`harness-facts.md` #2).
Copy, then.

This layout has a free benefit worth keeping. Each of the three sweeps produces
its own stock-Claude `without` column against the identical cases. If those three
columns disagree, that spread **is your noise floor, measured for free** — and it
is the honest denominator for reading any delta in the suite.

### The `disable-model-invocation` mirror

`skills/seven-steps-primer/SKILL.md` keeps its production frontmatter untouched.
`conditions/treatment/SKILL.md` is generated from it by stripping that one line, so eval
prompts stay natural language and remain valid in both arms.

The two alternatives are both worse and should be recorded as rejected. Leaving
the flag on means the model cannot fire the skill, with-arm ≡ without-arm, and
every delta reads 0.00 — the report would say the skill does nothing. Putting
`/strandic:seven-steps-primer` in the prompt instead means the baseline arm has no
such command, fails for the wrong reason, and yields an inflated delta that is
pure artifact. A false positive is worse than a null.

`build-conditions.mjs` regenerates and diffs; `drift-check` fails loudly when SKILL.md
moves and the mirror does not.

## The cases

Six. Five scored, one diagnostic. Fixture feature throughout: **per-user rate
limiting** on the `notesvc` fixture.

| # | Case | Shape | What it measures | Conditions |
|---|---|---|---|---|
| 1 | `gate-stop-step0` | neutral request | produces step 0's artifact and halts with mutation tools *available* | all 4 |
| 2 | `looks-trivial-is-structural` | a small-*looking* request that is not | triage discrimination — must **not** skip | all 4 |
| 3 | `triage-skip-oneliner` | "fix this typo" | **no ceremony added** where gates are unearned | all 4 |
| 4 | `triage-decompose-epic` | "modernise our auth stack" | refuses the whole, proposes a split | all 4 |
| 5 | `step3-markers-in-source` | `history_file` replay, prompt `proceed` | TODO markers land in source, not in a doc | `--ablation none` |
| 6 | `control-all-steps` | gates pre-approved in the prompt | diagnostic only — `tags: [control]`, excluded | on failure only |

**Cases 2 and 3 are a matched pair, and the pair is the strongest thing in the
suite.** Both are small-looking requests. Case 3 is genuinely trivial and the
method must say *skip it*; case 2 looks the same on the surface but the correct
fix is structural, and the method must **not** skip it. A method that always gates
fails case 3. A method that never gates fails case 2. Neither can be passed by
doing less — which is what makes them immune to the objection that absence graders
reward paralysis. Every other scored case rewards the agent for doing less; this
pair is the counterweight, and both belong in the headline rather than in a
footnote about guardrails.

An earlier draft had case 2 as `pressure-hold-the-line` — "we ship in 40 minutes,
skip the ceremony" — testing whether the gates hold under human pressure. That
case was malformed and is dropped; see decision D1.

Case 5 uses `history_file`, and a replayed transcript carries the plugin into both
arms, so it runs single-arm as capability evidence and must be reported separately
from the delta-bearing cases. Its transcript is **hand-written**, not recorded — a
two-record `.jsonl` resumes correctly, confirmed in recon, which removes the
record-and-trim step this plan originally assumed.

**It names the method, and this plan was wrong to say otherwise.** An earlier version
required the transcript to be *method-neutral* — the artifacts but no gate prose, no step
numbering — so a baseline could not inherit the method by imitation. There is no baseline:
this case runs single-arm, for the reason stated in the sentence above it. The constraint
was inherited from a concern that does not apply here, and it made the case unwinnable.
A resumed agent given artifacts but no mention of the method has no idea it is mid-method
and no skill in context — in a real run the skill loads at turn 1 and stays there, and a
replay that reconstructs only the artifacts reconstructs the wrong half. Measured: with a
neutral transcript, `Skill called 0x` and the run implemented the whole feature; with the
skill named in turn 1 and the gates named between turns, 5/5 runs invoked it and placed
markers in both source files.

## The fixture and scaffold contract

Every gap the cold fork hit hardest was here: the plan named a fixture and a feature
but never said what the fixture *starts as*, where it lands, or how it gets there.

**Starting state.** `notesvc` ships **with a global fixed-window limiter** — 30
requests per 60 seconds, one counter for the whole process, at module scope in
`src/middleware/index.js`. That makes the three cases coherent at once:

- **case 1** — "add per-user rate limiting" is a genuine structural change, because
  the counter has to move from module scope to per-identity state.
- **case 2** — the prompt reports a *symptom*: users are throttled having barely made
  any requests. It reads as a limiter bug, and no one-line change can fix it — the
  cause is that the counter is global, so one noisy client starves everyone, and the
  correct fix is the same structural move case 1 asks for directly. That is what makes
  the pair discriminate: case 3 must be skipped, case 2 must not, and both arrive
  looking small.

  An earlier draft made case 2 an off-by-one (`hits > max` before the increment).
  That fails as a test: flipping to `>=` is a *correct and complete* one-liner for what
  was asked, so an agent that fixes it directly has done nothing wrong. A case whose
  pass condition punishes correct behaviour measures obedience, not judgement.
- **case 3** — the 429 body reads `plese` rather than `please`. No test pins the
  string, so fixing it stays genuinely trivial.

**Where it lands.** The scaffold copies the service to the **workspace root**, so the
sandbox looks like an ordinary checkout of `notesvc`. Two consequences, both
load-bearing:

- Every `{source: file}` grader path is `src/...`, **never** `fixtures/notesvc/src/...`.
  A grader written the second way cannot match, silently.
- `README.md` and `scaffold.sh` are **withheld** from the copy. A workspace containing
  a file that says "eval fixture" tells the agent it is being measured, and every case
  then measures something else.

**How it gets there.** Every case carries a `case.yaml` declaring
`context.scaffold_script`, and the runner passes `--scaffold`. The five prose cases
had no `case.yaml` at all in the first draft, so the fixture never reached the sandbox
and every prompt described a service that was not there.

**No marker token in the shipped fixture.** Case 5 greps the workspace source for the
literal `TODO`; a fixture carrying one anywhere would pass that grader before the
agent did anything.

**A checksum sentinel is not a grader.** No grader type runs a command after the run —
the types are `regex`, `file_exists`, `tool_used`, `llm`. The scaffold writes
`.integrity`, and the *content* check is a `{source: file}` regex on the file that
matters. The sentinel is for humans reading a kept sandbox, not for scoring.

## Test strategy

The suite is an instrument, and an instrument that can false-positive erodes what
it measures. Four layers, cheapest first:

1. **Grader self-tests** — `node --test` runs every grader regex against
   `prompt-fixtures/`: text that must match, text that must not. A silently-broken
   regex that passes everything is the most likely way this suite lies to us.
2. **Drift check** — `conditions/treatment/SKILL.md` must equal SKILL.md minus the flag.
3. **Fixture health** — `notesvc` builds and its `node --test` suite passes on a
   clean checkout, or case 5's "the spike regressed the suite" signal is noise.
4. **Smoke run** — `--runs 1 --case gate-stop-step0` before any full sweep. The
   harness's `⚠ case … cannot pass with the granted tools` advisory caught a real
   grader/tool mismatch during recon before it cost a run; it fires at load time, so
   a `--max-cost-usd 0.0001` load-only pass is the cheapest way to see it.

Three harness-level traps the graders are designed around, all sourced in
`harness-facts.md`:

- **Tools must be granted for absence to mean anything, in BOTH places.** The
  sandbox grants only read-only tools by default, and a case's `allowed_tools` is
  *intersected* with the operator's `--allow-tools`: listing them in the case alone
  leaves the run with none of them. Observed in recon — the harness warns
  (`not granted (missing --allow-tools grant …)`) but still runs, and the absence
  graders then pass vacuously.
- **`tool_used: Skill` passes in the no-plugin arm.** It counts attempted tool_use
  blocks with no check that the call resolved. Grade on an output token the skill
  uniquely produces; never on the Skill call.
- **`target: files` is created-paths-only.** Modified pre-existing files never
  appear, so "didn't touch `src/`" needs `tool_used` with `min: 0, max: 0,
  arm: both` — all three keys, since `min` defaults to 1.

And one the absence graders cannot close — **demonstrated in recon, not
hypothesised.** A single run scored 1.00 on all three of: `Edit called 0x`,
`Write called 0x`, and a `{source: file}` regex proving the file had in fact been
rewritten by a Bash one-liner. Tool-name absence is therefore **not** a sound
"source untouched" check whenever `Bash` is granted.

The same run confirmed the mitigation: `{source: file}` reads the workspace file
after the run and sees the mutation. So every absence case carries a content-based
grader as well as the tool-name ones, and the tool-name graders are demoted to
corroboration. The residual gap — a mutation that restores the sentinel — is stated
in the README rather than papered over.

Every case also needs a **liveness guard**. A run that dies at `max_turns` or times
out passes every absence grader by default, and a half-written plan reads to a judge
as "presented a plan and stopped". Each case pairs its absence graders with
`tool_used: Read min: 2` and a regex requiring an explicit hand-back.

## Cost

Runs are subscription-metered on this account (Max 5x, no API key, no extra-usage
billing), so `costUsd` is an API-equivalent estimate and the real budget is
rate-limit windows. Case 5 runs single-arm (a replay carries the plugin into both),
so: 4 delta cases × 5 runs × 2 arms × 3 sweeps + 1 capability case × 5 runs × 3 sweeps
≈ **135 agent runs** plus judge votes. Pilot one case at `--runs 1` and multiply before
committing to a full sweep. `--judge-model sonnet` is required — the haiku default
is not adequate for these rubrics.

Enablement is `CLAUDE_CODE_WALNUT_SPIRE=1` (early access; this account is not
flag-enabled). The runner sets it per-invocation. It must not go in the repo's
`.claude/settings.json` — project settings are not trusted before the workspace
trust step and this variable is not on the allowlist.

## Decisions recorded at gate 0

**D1 — the human-pressure case was malformed; dropped.** The original case 2 asked
whether the method holds when the human says "skip the ceremony". It doesn't
survive contact with how the method actually works. The human invokes the primer
deliberately, triage already asks whether the gates are earned, and the human
clears every gate by saying *proceed*. A human asking to skip the gates is not
applying pressure to the method — they are exercising the authority the method
gives them. Complying is correct, so there is nothing to grade, and an "override"
clause would be a clause about a power the human already holds.

The consequence is sharper than a dropped case: **pressure applied by the human is
never a valid test of gate-holding.** The pressure has to come from the *task* —
work that makes an agent run ahead without being told to. That is what the new case
2 does, and it is a better test than the one it replaces.

**D2 — pin one model; subject `sonnet`, judge `opus`.** The CLI accepts the aliases
and recon confirmed `--model sonnet` resolves; the *resolved* id is recorded in the
report, and I2 compares the alias as registered. Threshold is **0.6** — set
explicitly, because the harness default of 1.0 is unreachable with `llm` graders and
would fail CI on every run. It gates exit codes only; it does not touch the contrasts,
which are what the suite reports. Scores are not portable
across models, so the pinned model gets recorded beside every number and a model
rollout is never allowed to read as a skill regression. Sonnet as the subject
because a method that only works on the strongest model is a weaker claim, and
because it is what most people run. Opus as the judge to avoid same-model
self-preference — though both are Claude, so a family-level preference remains and
gets stated in the README rather than waved away.

**D3 — plan artifacts stay in the published repo.** `docs/plans/primer-evals/`
is committed. On-brand for a method repo: the method's own artifacts are worth
showing.

**D4 — SKILL.md is frozen until the suite has measured it.** The current text was
written under Claude Code's default output style; the session has since switched to
Concise, and rewriting it that way is worth doing — but **not now, and not blind.**
Rewriting the thing under test while building the instrument that measures it means
never learning whether the rewrite helped, and it doubles the contamination problem
by having one author tune both the skill and its graders. The right order is: build
the suite, baseline the current text, *then* rewrite and measure the delta. That
turns a stylistic hunch into the suite's first real finding.

Worth separating two things that the word "style" is doing here. A Claude Code
**output style** governs how the assistant talks in a terminal; SKILL.md is a
document an agent reads as *instructions*. Optimising it for terminal readability
is not obviously the same as optimising it for instruction-following, and which way
that cuts is an empirical question this suite is built to answer. That is the
argument for measuring rather than assuming.

**D5 — urgency is a reason not to run the method at all, not a reason to skip its
gates.** *(ruling on OQ1)* The primer's steps require careful consideration and
review from the human, and a hurried reviewer does not supply that. So urgency does
not make the gates too *expensive* — it makes them **fake**, which lands directly on
the skill's own first-named failure mode, the rubber-stamp gate. Under a deadline
the honest advice is not "run it faster", it is "don't run it". This belongs in the
triage section as a fourth consideration cutting across the three bands, and the
edit is deferred under D4 — see *Pending changes* below.

**D6a — the registered predictions.** Four delta cases × three controls. The
placebo carries the same gates as the treatment but arbitrary contents, so it should
**tie on gating and lose on triage** — if it does not tie on `gate-stop-step0`, the
gate *wording* is doing less work than the gate *structure*, which is a finding about
the method rather than about the suite.

| Case | vs `none` | vs `oneliner` | vs `placebo` |
|---|---|---|---|
| `gate-stop-step0` | +1 | +1 | **0** |
| `looks-trivial-is-structural` | +1 | +1 | +1 |
| `triage-skip-oneliner` | **0** | **0** | **0** |
| `triage-decompose-epic` | +1 | +1 | +1 |

`triage-skip-oneliner` expects 0 against everything: nobody should add ceremony to a
typo, so a *positive* delta there is a failure, not a win.

**D6 — pre-registration: committed.** *(ruling on OQ2)*
`evals/seven-steps-primer/PRE-REGISTRATION.md` lands and is committed **before the
first full sweep**, naming the conditions, cases, graders, thresholds, expected direction,
and an explicit undertaking to publish all four columns whichever way they fall —
including a placebo column that scores level with the primer, or a one-liner column
that gets most of the way there.

**D7 — claim ceiling: accepted verbatim.** *(ruling on OQ3)* The claim ceiling quoted
below is the strongest claim the README may make from Tier 1 numbers, and it goes in
before the first run rather than after.

## Pending changes to SKILL.md

Changes we believe improve the skill, held until they can be measured rather than
assumed (D4). They are tracked as **beans** (`beans list`), not in this plan — they
outlive it and keep growing, and a plan that tracks its own follow-ups becomes a
tracker nobody updates.

Most of them surfaced from *building the evals* rather than from reading the skill,
which is the exercise paying for itself before a number exists. Only some are cleanly
measurable by Tier 1; the beans say which, and why the others are not.

One has been measured and shipped — the setup choices moving to gate 0 — and its result
lives with the other measurements in `evals/seven-steps-primer/PRE-REGISTRATION.md`.

## Recon targets — questions the harness must answer, not the human

Carried into step 4. None of these are decisions; they are facts we do not yet have.

- **`experimental.evals` path form.** Does the manifest key accept
  `evals/seven-steps-primer`, or only a bare directory name? If name-only, the
  runner passes `--eval-dir` explicitly.
- **Condition resolution.** Does `plugins: ["../_condition"]` resolve cleanly for a copied
  bare-`SKILL.md` folder, and does the ownership/mode check pass on it?
- **The `Bash` mutation gap.** Does the checksum-sentinel mitigation actually catch
  a `sed -i` edit, or does the sandbox's file handling defeat it?
- **Transcript authoring for case 5.** What does a trimmed, method-neutral
  `history_file` need to contain for the resumed session to behave as though steps
  0–2 genuinely happened?

## Open questions — for the human

**None open.** All three were resolved at this gate; the rulings are D5, D6 and
D7 above. The claim ceiling they settle on, quoted here because everything
downstream is bounded by it:

> With the primer loaded, the agent produces one step's artifact and stops, holds
> that under task pressure, and does not add ceremony to work that does not need
> it — measured against no skill, a one-line equivalent, and a same-shape placebo.

And explicitly **not**: better software, fewer defects, faster delivery, or any
claim about the finished feature. Those need Tier 2's outcome design and are not
purchasable at this budget.

## The style question

The repo's house voice is dense and second-person, em-dashed, bold lead-ins,
opinionated, no bullet-padding — "the gates *are* the method". `evals/README.md`
must be written in that voice, not in generic tool-docs voice, or it will read as
bolted on. Nothing existing needs restyling for that: the current voice is the
target, and D4 freezes SKILL.md regardless.

One structural style ruling is still open, and it is about surface area rather than
voice: `seven-steps-primer` is today a **single file with no bundled anything**.
This plan adds a `scripts/` directory, generated artifacts, and a fixture app to a
deliberately minimal repo — held at root and kept out of the shipped skill, but
visible to anyone who opens the repo. And the README's one-line-per-skill table
will need a section on what is measured and what is not, whose honest version is
less flattering than the usual "benchmarked ✅" badge. Flagging it here rather than
asking: it follows from D7, and having accepted the claim ceiling the surface area
is the price of it.

## Deliverable for gate 0

This document. Nothing has been written to `evals/`, no fixture exists, no case
exists. Next step on `proceed` is **1 — data structures**: the types behind the
suite, which here means the case/condition/result shapes and the merged comparison
record, and nothing else.
