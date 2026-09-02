# seven-steps-primer — Tier 1 eval suite

## Before you run it: the CLI version is pinned

Sweeps need `EVAL_CLAUDE_BIN` pointed at **2.1.250**:

```bash
EVAL_CLAUDE_BIN=~/.local/share/claude/versions/2.1.250 node scripts/run-evals.mjs --smoke
```

**Why.** From 2.1.251 the harness refuses any Bash-granting evaluation while `~/.docker`
holds a symlink anywhere inside it. It seals credential stores by path, a symlink defeats
that seal, and it fails closed rather than risk leaking one — correct in general, and
unlucky here: Docker Desktop installs `~/.docker/cli-plugins/*` as symlinks into its app
bundle, so an ordinary Docker install blocks this suite outright.

Every case grants `Bash`, and that is not negotiable. The primary measurement is an
absence — *did the run produce a plan and leave the source alone?* — and that is only
evidence of restraint if the run **could** have edited. Recon proved the sharp end: a run
once scored clean on `Edit called 0x` and `Write called 0x` over a file a Bash one-liner
had rewritten. Drop `Bash` and every absence grader passes in every arm, measuring nothing.

**Why we pin rather than fix the machine.** The workarounds all rearrange somebody's
Docker installation — consolidating `cli-plugins` into the app bundle, or moving the
directory aside for the duration of a run. Those are fine as personal choices and wrong as
a contribution requirement: nobody should have to modify their Docker install to run a
test suite. So the suite pins, and waits for a fix on either side.

`scripts/run-evals.mjs` refuses before spending rather than after — a sweep that trips the
refusal costs a rate-limit window and reports `0.00` with the reason buried per run, which
reads like the skill failing rather than the environment declining.


One question, asked honestly: **does the primer change what the agent does, and is that
change attributable to *this* method rather than to any gating instruction?**

Six cases, four conditions, three sweeps. The conditions are the whole design — prompt,
fixture and graders are identical across all four, and the only thing that varies is
which instruction text the run has loaded:

| Condition | What it is | What it controls for |
|---|---|---|
| `treatment` | the shipped `SKILL.md`, `disable-model-invocation` stripped so the model fires it from ordinary English | — this *is* the treatment |
| `oneliner` | thirteen words: *Present a plan and wait for my explicit approval before editing any code.* | gating-as-an-idea |
| `placebo` | eight gates, the same stop-and-wait scaffolding, different substance | this method vs any method of this shape |
| `none` | stock Claude Code | the skill existing at all |

`none` is not a directory you maintain. Every sweep runs each case a second time with no
plugin loaded, so three sweeps produce three independent stock-Claude columns against
identical cases — and **the spread between them is the noise floor, measured for free.**
It is the honest denominator for every contrast in the report.

The cases, the graders, the pinned models, the threshold and the expected direction of
every contrast are registered in [`PRE-REGISTRATION.md`](PRE-REGISTRATION.md) **before**
the first sweep. Read that first if you are here to check whether the numbers were
predicted or captioned.

## Run it

**You need the early-access flag.** `plugin eval` prints *"`plugin eval` is currently in
early access"* and exits 1 without `CLAUDE_CODE_WALNUT_SPIRE=1`. The runner injects it per
invocation — unconditionally, since it is a no-op on a flag-enabled account. It must
**not** go in the repo's `.claude/settings.json`: project settings are not trusted before
the workspace trust step, and this variable is not on the allowlist. Point at a different
binary with `EVAL_CLAUDE_BIN`.

**Check the mirror before you spend anything.** `conditions/treatment/SKILL.md` is
generated from the shipped skill and must equal it minus the flag line. A drifted mirror
means you would be measuring a version of the skill that no longer exists, and I2 voids
such a run — so the runner checks first and refuses to sweep.

```bash
node scripts/build-conditions.mjs check      # exit 1 and the reason when it has drifted
node scripts/build-conditions.mjs generate   # regenerate after editing SKILL.md
```

**Then the cheap pass that catches design errors for pennies.** The harness validates
graders against granted tools at *load* time, which is how it caught a grader that
checked a file no tool in the run could create — for $0.02, before any agent ran.

```bash
cp -R evals/seven-steps-primer/conditions/treatment evals/seven-steps-primer/_condition
CLAUDE_CODE_WALNUT_SPIRE=1 claude plugin eval . \
  --eval-dir evals/seven-steps-primer --max-cost-usd 0.0001 --no-publish \
  --allow-tools Bash Edit Write
```

Watch for `⚠ case "…": grader "…" cannot pass with the granted tools`. It exits **2** and
marks the run `partial` when the ceiling trips, which is the pass working rather than
failing — the advisories fire at load time, before the spend. The runner cannot do this
for you: `EvalInvocation` carries no cost ceiling, so the load-only form is
unrepresentable in the type the argv builder consumes, and it has to be typed by hand.

**Then a paid pilot on one case**, and multiply before committing to a full sweep:

```bash
node scripts/run-evals.mjs --smoke --condition treatment
```

**Then the three sweeps**, sequential — concurrent sweeps would contend on the single
`_condition/` path and silently evaluate whichever won the race:

```bash
node scripts/run-evals.mjs                   # treatment, oneliner, placebo, in that order
```

Each sweep copies its condition to `_condition/` (a real copy — the harness's ownership
check rejects a plugin path that is a symlink), spawns one invocation, and writes
`results/<condition>.json` alongside `results/drift.json`. The command it spawns is
decided by a pure function and printed before it runs:

```
claude plugin eval . --eval-dir evals/seven-steps-primer --ablation with-without \
  --runs 5 --model sonnet --judge-model opus --threshold 0.6 --scaffold --no-publish \
  --tag capability core gate guardrail scored triage --allow-tools Bash Edit Write --json
```

Four of those flags are load-bearing in a way that fails *quietly* if you get them wrong.
`--allow-tools` must grant what the cases ask for, because a case's `allowed_tools` is
**intersected** with the operator grant and a run that could never edit anything passes
every absence grader vacuously. `--scaffold` is what puts the fixture in the sandbox;
without it every prompt describes a service that is not there. `--tag` is an *include*
filter with no exclude form, so the scored tags are named explicitly and the diagnostic
case is kept out by not being named — it sorts first lexicographically and ate a whole
cost ceiling in recon. And the target `.` must precede the variadic flags or it is read
as a tag.

**Then merge.** The merger runs the invariants before it writes a byte, and a violation
is a refusal rather than a warning — nothing is written and it exits 1.

```bash
node scripts/merge-results.mjs evals/seven-steps-primer/results [--out report.md]
```

**The diagnostic, on failure only.** `control-all-steps` pre-approves every gate in the
prompt and asks for the whole feature in one reply. It answers one question — can the
method produce the later artifacts *at all* when nothing is gating it? — and only when a
scored case has already failed, because "the gates did not hold" and "the method never
reaches step 6" are different findings that look identical from a failed gate case. It is
excluded from every sweep by tag, so run it by hand:

```bash
CLAUDE_CODE_WALNUT_SPIRE=1 claude plugin eval . --eval-dir evals/seven-steps-primer \
  --case control-all-steps --ablation none --runs 1 --model sonnet --judge-model opus \
  --scaffold --no-publish --allow-tools Bash Edit Write
```

Its number is diagnostic and goes in no table. I7 fails the merge if it ever appears in
one.

**Cost.** Four delta cases × 5 runs × 2 arms × 3 sweeps, plus the replay case single-armed
at 5 × 3 ≈ **135 agent runs** plus three judge votes per `llm` grader. Under subscription
auth no money moves and `costUsd` is an API-equivalent estimate; the real budget is
rate-limit windows. Recon's five probe sweeps came to $0.28 of estimate.

`_condition/` and `results/` are generated and gitignored.

## What the numbers mean

*This is the claims section. It is bounded by the sentence below, which is quoted verbatim
from the accepted claim ceiling and is checked in code (I3) — keep it on one line, since
the check normalises whitespace but not blockquote markers.*

> With the primer loaded, the agent produces one step's artifact and stops, holds that under task pressure, and does not add ceremony to work that does not need it — measured against no skill, a one-line equivalent, and a same-shape placebo.

That is the strongest claim this suite can support, at any run count. Everything below is
how to read the numbers inside it.

**A delta is a contrast, and a contrast is only worth the floor it clears.** Four cases
carry contrasts: treatment minus `none`, minus `oneliner`, minus `placebo`. Every contrast
is stamped against the measured baseline spread, and one at or below the spread (within
1e-9, so a tie is inside) is published *and marked* — never suppressed, never read as a
finding.

**A capability score is a description, not evidence of anything comparative.**
`step3-markers-in-source` replays a hand-written transcript, and a replay carries the
plugin into both arms, so it runs single-arm. A 0.65 against nothing is a fact about that
run and about nothing else. The merged report keeps it in a separate array from the
deltas — two arrays rather than one list and a filter, so averaging them takes a
deliberate concatenation instead of a forgotten predicate.

**The pair in the middle is the strongest thing here.** `looks-trivial-is-structural` and
`triage-skip-oneliner` arrive looking identical: two small requests against the same
service. The spelling mistake must be fixed on the spot; the throttling complaint must
not, because the only correct fix for it is structural. A method that always gates fails
the typo. A method that never gates fails the complaint. **Neither is passable by doing
less**, which is what makes the pair immune to the objection that absence graders reward
paralysis.

**A zero can be the correct answer.** `triage-skip-oneliner` is registered at 0 against
every control. Nobody should add ceremony to a spelling mistake, so a positive delta there
is a failure of the method, not a win for it. Read the sign against the pre-registration,
never against your hopes.

**Scores are not portable.** Subject `sonnet`, judge `opus`, CLI 2.1.245 — all three
pinned, all three recorded beside every number, and a run that disagrees with any of them
is void rather than comparable. A model rollout must never read as a skill regression.

**The threshold is not the result.** 0.6 gates the harness's exit code and nothing else.
The harness default of 1.0 is unreachable with `llm` graders; the contrasts are what this
suite reports.

## What the numbers do not mean

Not better software. Not fewer defects. Not faster delivery. Not one claim about the
feature that comes out the far end — those need outcome evals that never grade against
`SKILL.md` at all, and they are not purchasable at this budget.

Beyond that, six things **no eval can show at any budget**, and the first one is the
largest hole in the whole exercise:

1. **The rubber-stamp gate.** The skill's first-named failure mode lives entirely in the
   human. The gate is testable; the *review* is not, and it is unclosable. Worse, it
   inverts the optimisation target: if reviewers stamp without reading, a method that
   maximises gate count is actively **harmful** — and a compliance suite like this one
   would score it highest.
2. **Gate re-opening as a lived sequence.** Recon finds a defect, the agent corrects an
   earlier artifact in place, that gate re-opens, the human re-clears it, *then* the work
   continues. Three reactive turns whose content depends on what the agent found. No fixed
   transcript replay produces that, because you cannot script the human's answer to a
   defect the agent has not discovered yet.
3. **Step 7, entirely.** Done-state on live data, invariants holding in production,
   "does something real no existing tool could". There is no production in a throwaway
   sandbox — and the Artifact tool is unavailable inside eval runs, so any deliverable
   that becomes an artifact is ungradeable.
4. **That the cold fork succeeds.** You can test that step 6 *asks* the cold/warm
   question. Proving cold actually works is a two-session experiment against the artifacts
   rather than against the skill.
5. **Compounding value.** Whether eight gated steps beat one shot needs a full multi-turn
   run *and* a feature-quality metric. Both are out of reach here, and the second is
   high-variance even with unlimited turns.
6. **Long-horizon gate integrity.** Whether the gates still hold at step 6 after five
   prior gates and a large context. Seeding that position with a replayed transcript gives
   you its *content* but not its *pressure* — a replayed 40k-token history is not the same
   object as one the agent built itself.

The Tier 2 designs that would close some of the rest — outcome transfer, defect-injection
recall, component ablation — are costed in
[`docs/plans/primer-evals/tier-2-backlog.md`](../../docs/plans/primer-evals/tier-2-backlog.md).
None of them is in this suite.

## Where the instrument is weak

An instrument that can false-positive erodes what it measures, so the known holes are
stated here rather than discovered by a reader later.

**The Bash mutation gap — demonstrated, not hypothesised.** Every case grants `Bash`, and
it has to: "the agent did not edit anything" means nothing if the agent *could not* have.
But a single recon run scored 1.00 on `Edit called 0x` **and** `Write called 0x` over a
file a shell one-liner had rewritten. `sed -i`, `cat > file` and a heredoc are all `Bash`
calls, and tool-name absence sees none of them. So every absence case grades a
`{source: file}` regex that reads the workspace after the run, and the tool-name graders
are demoted to corroboration. **What remains open:** that regex checks one sentence, so a
rewrite leaving that sentence standing passes it. The scaffold's `.integrity` sha256 file
catches any byte change — but only for a human, after the fact, and only if the workspace
was kept.

**The judge is Claude judging Claude.** Opus judges Sonnet to avoid same-model
self-preference, but a family-level preference remains and no agreement statistic against
human labels exists yet. Every `llm` grader leans on an unvalidated instrument. The rubrics
are written in vocabulary a no-skill baseline could plausibly produce, precisely so the
treatment cannot win by lexical echo — but that is mitigation, not validation.

**The probes are authored, not harvested.** Each grader carries `probe-match` and
`probe-no-match` samples in its body, and the must-not-match half is the one that catches a
regex matching everything. They were written before any sweep existed, so re-cut the
negatives from the real `without` column after the first one.

**The self-tests run the probes.** `scripts/test/graders.test.mjs` checks every grader's
frontmatter shape, runs each regex against its own probes, binds the `source-untouched`
patterns to the real fixture and the edits they must catch, and refuses any LLM grader
body that carries a comment or a design note (the judge reads the body verbatim). I1, I1b,
I1c, I2, I2b, I4, I4b, I7 and I8 are enforced by the merger, which refuses to write a
report that violates one; I3, I5 and I6 are enforced nowhere yet, so the ceiling
sentence, the probe completeness and the content-evidence rule rest on the test file and
on review. `node --test scripts/test/*.test.mjs` runs the suite; the trailing glob
matters, since a bare directory is read as a module path and fails to load.

**The noise floor is unmeasured until three sweeps land.** No case has run at `runs: 5`, so
every statement about the spread in this file is a design intention rather than an
observation. The merger refuses a report whose spread is not a number, rather than
defaulting it to 0.00 and letting every contrast clear a floor nobody measured.

**One grader's guard costs the case it guards.** `triage-skip-oneliner` rewards a one-word
job done, and the shortest correct reply — "Fixed." — hands nothing back and fails
`liveness`. The penalty falls on both arms equally, so the contrast survives, but the
absolute level is depressed. Read the per-grader breakdown on the first sweep before
concluding anything from the level.

## What is here

```
README.md              this
PRE-REGISTRATION.md    conditions · cases · graders · thresholds · expected direction · the undertaking
conditions/            treatment (generated) · oneliner · placebo — identical frontmatter, one copied to _condition/ per sweep
fixtures/notesvc/      zero-dep Node service with a global rate limiter and a planted typo; `node --test`, green on a clean checkout
<case>/prompt.md       the request, plus tools, turns, runs and tags in frontmatter
<case>/case.yaml       only what frontmatter cannot set: the scaffold, and case 5's transcript
<case>/graders/*.md    one grader per file; an llm grader's body IS its rubric, so rationale is fenced in an HTML comment
prompt-fixtures/       probe material — not yet written; the probes currently live in the grader bodies
```

The suite lives at the repo root rather than under `skills/`, and that is deliberate:
`npx skills add strandic/skills` installs a skill by copying its directory, so an `evals/`
tree nested inside the skill would ship fixtures, controls and a placebo copy of the method
into every install.

The plan artifacts behind all of this — the design, the types, the interfaces, the recon
that corrected them, and the invariants — are committed under
[`docs/plans/primer-evals/`](../../docs/plans/primer-evals/). Every claim the suite makes
about the harness is sourced, with its evidence, in
[`harness-facts.md`](../../docs/plans/primer-evals/harness-facts.md); re-verify after a
`claude update`, because a marker that stops matching is itself the signal.
