# Pre-registration — `seven-steps-primer`, Tier 1

Committed **before the first full sweep**, and not edited after it. Every merged report
records this file's sha256; a report whose digest disagrees with the committed file is
**void**, not "worth a look" (I2), and a working tree that has this file dirty produces
no report at all (I8) — a digest a reader cannot check out is worse than no digest.

**What that buys.** The expected direction of every contrast is written down here, before
any number exists. `computeContrasts` reads the sign from this file and throws on a pair
it cannot find, so nobody can supply the missing half after seeing the result. That is
the entire value of registering it: a direction chosen once the numbers are in is not a
prediction, it is a caption.

**What is frozen is the whole file.** The merger parses one fenced `json` block and
ignores everything else, but the digest is taken over the bytes of the file — prose
included. So this is not a document with an editable half: fixing a typo here after the
first sweep changes the digest and voids the run exactly as changing a registered
direction would. Say what you mean the first time.

**And be clear about what the check can see.** It compares the working tree against
`HEAD`, so it catches an uncommitted edit and a dirty tree at merge time. It cannot catch
a rewrite that is *itself committed* between the sweep and the merge, because no sweep
record pins the digest as of the runs. The guard against that one is the git history and
somebody reading it — the same shape of gap as I3's tripwire, stated here rather than
discovered later.

## The conditions

Four columns, one variable. Prompt, fixture and graders are identical across all of
them; the only thing that changes is which instruction text is loaded.

| Condition | What it is | What it strips |
|---|---|---|
| `treatment` | the shipped `SKILL.md`, generated with `disable-model-invocation` removed so the model can fire it from ordinary English | — this *is* the treatment |
| `oneliner` | thirteen words: *Present a plan and wait for my explicit approval before editing any code.* | gating-as-an-idea |
| `placebo` | eight gates, the same stop-and-wait scaffolding, different substance | this method vs any method of this shape |
| `none` | stock Claude Code — the harness's own `without` arm, measured once per sweep | the skill existing at all |
| `treatment-no-triage` (measured; withdrawn from the active list by Amendment 10) | the treatment minus its `## Does this earn the gates?` section, generated from the shipped skill (Amendment 7) | the triage rules: skip / decompose / run it |
| `treatment-no-failure-modes` (measured; withdrawn from the active list by Amendment 10) | the treatment minus its `## Failure modes` section, generated the same way (Amendment 8) | the seven named failure modes, "rushing to the diff" among them |
| `treatment-no-recon` | the treatment minus every line that says recon is a run: step 4's eight sub-bullets and four failure modes (Amendment 11) | the recon method: run, don't read; fix the artifact upstream; evidence from runs |
| `treatment-no-setup` (measured; withdrawn from the active list by Amendment 10) | the treatment minus its `## Set the artifact home` section, generated the same way (Amendment 9) | the artifact home, and the two setup choices handed over at gate 0 |

All three authored conditions carry **identical frontmatter** — same `name`, same
`description` — and all three are copied to the same `_condition/` path, so the plugin
presents under one name and no condition is identifiable by what it is called. A
condition the model can tell apart before reading it is not a control.

`none` is not authored and is not a fourth directory. It arrives free with
`--ablation with-without`, three times over, and the spread between those three columns
is this suite's noise floor.

## The cases, and every grader that scores them

Six. Four carry contrasts, one is capability evidence with no referent, one is a
diagnostic that never reaches a headline.

| Case | Evidence | What a 1 means |
|---|---|---|
| `gate-stop-step0` | delta | it produced a plan covering scope, placement, checking and open questions — and left the service alone, with `Bash`, `Edit` and `Write` all granted |
| `looks-trivial-is-structural` | delta | it named the shared counter as the cause and refused the parameter tweak |
| `triage-skip-oneliner` | delta | it fixed the typo and wrote nothing down |
| `triage-decompose-epic` | delta | it declined the epic whole and proposed a split with named parts |
| `step3-markers-in-source` | capability | it put literal markers in the service's source rather than listing the sites in a document |
| `control-all-steps` | diagnostic | never reported, never averaged — see below |

Graders, by file and type. Twenty-two of them; an `llm` grader's body **is** its rubric.

| Case | Graders |
|---|---|
| `gate-stop-step0` | `step0-only` (llm) · `plan-exists` (file_exists `**/*.md`) · `source-untouched` (regex, `{source: file}` over `src/middleware/index.js`) · `no-source-edits` (tool_used Edit 0/0) · `no-source-writes` (tool_used Write 0/0, `input_match` scoped to source paths) · `liveness` (regex over `last_message`) · `liveness-read` (tool_used Read ≥ 2) |
| `looks-trivial-is-structural` | `does-not-skip` (llm) · `source-untouched` (regex, file) · `no-source-edits` (tool_used) · `liveness` (regex) · `liveness-read` (tool_used) |
| `triage-skip-oneliner` | `fixes-it-directly` (llm) · `no-plan-artifact` (file_exists `**/*.md`, `exists: false`) · `liveness` (regex) |
| `triage-decompose-epic` | `refuses-the-whole` (llm) · `liveness` (regex) · `liveness-read` (tool_used) |
| `step3-markers-in-source` | `markers-in-source` (regex, file `src/routes/notes.js`) · `markers-in-middleware` (regex, file `src/middleware/index.js`) · `not-a-doc-list` (llm) |
| `control-all-steps` | `reaches-step-6` (llm) |

**Every absence claim carries a content grader.** Recon produced a single run scoring
1.00 on `Edit called 0x` *and* `Write called 0x` over a file a `sed -i` one-liner had
rewritten. So `source-untouched` reads the file out of the workspace after the run, and
the tool-name graders are corroboration, not the claim. I6 refuses an absence case that
rests on tool names alone.

**Every case that can die quietly carries a liveness guard.** A run that times out or
hits `max_turns` passes every absence grader by default. `liveness` requires the reply to
hand control back in ordinary English; `liveness-read` requires the run to have opened
the service at least twice.

**`control-all-steps` is tagged `control` and is registered here only so the checks can
see it.** It is excluded from every sweep by tag selection, filtered out of both scored
tables by construction, and I7 fails the merge if it ever appears in one. Its registered
`evidence`/`ablation` values say what the case would be if you ran it by hand: a score
with no referent, single-arm. Since Amendment 4 these two fields are read: `evidence`
splits the two tables, `ablation` decides whether a without-arm is collected as a
baseline, the parser refuses a case whose two fields disagree, and I4b compares the
registered `ablation` against the ablation each sweep actually ran.

## The registered directions

Copied from `0-plan.md` D6a. Four delta cases × three controls; this file records the
table, it does not choose it.

| Case | vs `none` | vs `oneliner` | vs `placebo` |
|---|---|---|---|
| `gate-stop-step0` | +1 | +1 | **0** |
| `looks-trivial-is-structural` | +1 | +1 | +1 |
| `triage-skip-oneliner` | **0** | **0** | **0** |
| `triage-decompose-epic` | +1 | +1 | +1 |

**A direction is a sign, never a predicted score.** No field in this file can hold a
number that could be mistaken for a measurement — `-1 | 0 | 1` and nothing else — because
a predicted 0.72 typeset beside a measured one gets screenshotted and quoted as a result.

**`0` is a real prediction, not a shrug.** `triage-skip-oneliner` expects a flat zero
against everything: nobody should add ceremony to a spelling mistake, so a *positive*
delta there is a failure of the method, not a win for it.

**`gate-stop-step0` vs `placebo` is registered 0 against our own interest.** The placebo
instructs the same stop-and-wait, so it should tie on gate-stopping. If it does not, the
gate *wording* is doing less work than the gate *structure* — a finding about the method,
and one we have committed to publishing before knowing which way it falls.

**No direction is registered for `step3-markers-in-source`.** A capability score has
nothing to be a contrast against, and registering a sign for it would invite exactly the
mixing I4 exists to prevent.

## Pins, and what they are worth

- **Subject `sonnet`, judge `opus`.** Registered as the CLI aliases, because the alias is
  what the harness echoes into the document I2 compares against; registering "Sonnet 5"
  would read as more precise and void every run. An alias does not pin a build — the
  harness's own report records what `sonnet` resolved to that day, and that is the number
  to quote beside a score. Opus judges Sonnet to keep same-model self-preference out of
  the results; both are Claude, so a family-level preference remains, and the README says
  so rather than waving it away.
- **Threshold 0.6.** Set explicitly: the harness default of 1.0 is unreachable with `llm`
  graders and would exit 1 on every run. It gates exit codes only. It does not touch the
  contrasts, which are what this suite reports.
- **Five runs per case.** Per-run scatter is published; a mean alone cannot distinguish a
  method that works from one that works two runs in three.
- **CLI 2.1.245.** Behaviour and wording both move between releases, and a run under a
  different version is void rather than comparable.

Scores are not portable across models. The pinned pair is recorded beside every number so
that a model rollout can never read as a skill regression.

## The undertaking

**All four columns get published, whatever they show.** Including a placebo that scores
level with the primer. Including a one-liner that gets most of the way there. Including a
treatment that loses.

This is not a preference we hold today and might revisit once the numbers are in — it is
the condition under which the numbers mean anything at all. `publishAllConditions` is
typed as literal `true` rather than as a boolean, so there is no toggle to turn, and the
merger refuses to emit a comparison that is missing a registered condition's column.

Contrasts at or below the measured noise floor are published too, and marked
`belowNoiseFloor` (I1b). "At or below" means |Δ| ≤ floor + 1e-9: a contrast that ties the
floor is inside it, because the floor is the smallest difference this instrument
resolves, and the tolerance exists because a contrast and the floor are means of the
same fifteenths summed in different orders (Amendment 4). Suppressing them would be
publication bias by another name; publishing them unmarked would be worse than
suppressing them.

## The registered record

The merger reads this block and nothing else in this file.

```json
{
  "conditions": ["treatment", "oneliner", "placebo", "treatment-no-recon"],
  "cases": [
    {
      "name": "gate-stop-step0",
      "evidence": "delta",
      "ablation": "with-without",
      "tags": ["gate", "core", "scored"],
      "scored": true,
      "measures": "Produces step 0's artifact and stops, with the mutation tools granted and usable."
    },
    {
      "name": "looks-trivial-is-structural",
      "evidence": "delta",
      "ablation": "with-without",
      "tags": ["triage", "core", "scored"],
      "scored": true,
      "measures": "Names the shared counter as the cause and refuses the parameter tweak."
    },
    {
      "name": "triage-skip-oneliner",
      "evidence": "delta",
      "ablation": "with-without",
      "tags": ["triage", "core", "guardrail", "scored"],
      "scored": true,
      "measures": "Adds no ceremony to a one-character fix; a positive delta here is a failure."
    },
    {
      "name": "triage-decompose-epic",
      "evidence": "delta",
      "ablation": "with-without",
      "tags": ["triage", "scored"],
      "scored": true,
      "measures": "Refuses the epic as one unit and proposes a split with named parts."
    },
    {
      "name": "step3-markers-in-source",
      "evidence": "capability",
      "ablation": "none",
      "tags": ["capability"],
      "scored": true,
      "measures": "Places literal markers in the service's source rather than listing the sites in a document."
    },
    {
      "name": "control-all-steps",
      "evidence": "capability",
      "ablation": "none",
      "tags": ["control"],
      "scored": false,
      "measures": "Diagnostic only: whether the method reaches the later artifacts when nothing gates it."
    }
  ],
  "expectedDirection": {
    "gate-stop-step0/none": 1,
    "gate-stop-step0/oneliner": 1,
    "gate-stop-step0/placebo": 0,
    "looks-trivial-is-structural/none": 1,
    "looks-trivial-is-structural/oneliner": 1,
    "looks-trivial-is-structural/placebo": 1,
    "triage-skip-oneliner/none": 0,
    "triage-skip-oneliner/oneliner": 0,
    "triage-skip-oneliner/placebo": 0,
    "triage-decompose-epic/none": 1,
    "triage-decompose-epic/oneliner": 1,
    "triage-decompose-epic/placebo": 1,
    "gate-stop-step0/treatment-no-recon": 0,
    "looks-trivial-is-structural/treatment-no-recon": -1,
    "triage-skip-oneliner/treatment-no-recon": 0,
    "triage-decompose-epic/treatment-no-recon": 0
  },
  "threshold": 0.6,
  "subjectModel": "sonnet",
  "judgeModel": "opus",
  "runsPerCase": 5,
  "claudeVersion": "2.1.250",
  "publishAllConditions": true,
  "claimCeiling": "With the primer loaded, the agent produces one step's artifact and stops, holds that under task pressure, and does not add ceremony to work that does not need it — measured against no skill, a one-line equivalent, and a same-shape placebo."
}
```

## What is registered elsewhere, and deliberately

**The claim ceiling** is carried here as `claimCeiling` so the digest freezes the exact
sentence, and it is quoted verbatim in `README.md`, which is where I3's tripwire reads
it. That check is a tripwire and not a judge: it verifies the sentence is present, not
that the prose around it stays inside the ceiling. The enforcement is weaker than the
rule, and the gap is a human reading README diffs.

**Grader probes** are not registered. Each grader carries its own `probe-match` and
`probe-no-match` samples in its body; I5 refuses any grader missing either half. Those
samples are authored rather than harvested — no sweep has run, so there is no real
baseline output to cut them from — and re-cutting the negatives against the first
`without` column is the point at which they become worth something.

**Tier 2** registers nothing here. Outcome evals, defect-injection recall and component
ablation need their own pre-registration and their own budget; this file commits only to
what four conditions over six cases can settle.

---

## Amendment 1 — the pinned CLI version

`claudeVersion` was registered as `2.1.245` and is amended to **`2.1.250`**.

Recorded rather than edited quietly, because a freeze that bends silently is not a
freeze. Three things make this amendment legitimate, and they are the test any future
one has to pass:

1. **No numbers exist yet.** Not one scored sweep has run, so nothing is being fitted to
   a result. This is the only window in which a pin can move at all.
2. **Nothing else changed.** The conditions, cases, graders, threshold, models, run count
   and all twelve registered directions are untouched. Only the version moved.
3. **The change was forced, not chosen.** The CLI upgraded twice under the project
   (2.1.245 → .247 → .250) and I2 voids a run whose report disagrees with the pin. The
   alternative was pointing `EVAL_CLAUDE_BIN` at an old binary that will eventually be
   collected.

Every behavioural fact the suite depends on was re-verified **by execution** against
2.1.250 before this amendment: 24 confirmed, zero behavioural changes. The bundled
reference prose is byte-identical to 2.1.245. See `docs/plans/primer-evals/harness-facts.md`.

Once the first scored sweep runs, this file is closed. A version change after that point
voids the run under I2 and requires a fresh pre-registration, not another amendment.

## Amendment 2 — equalised invocation intent in the case prompts

Every scored delta prompt gains one identical closing line:

> If a documented method for this kind of change is available to you, follow it.

**Why.** The first smoke pilot returned Δ 0.00 with both arms identical, and the
`skill-fired` indicator showed why: `Skill called 0x`. The skill never loaded. Recon had
verified invocation once, but against a prompt written to invite planning
("...getting the design wrong would be expensive. How should we approach building it?"),
not against a work order like "Move it to per-user rate limiting". Sonnet simply does
the work.

The deeper reason: in production this skill carries `disable-model-invocation: true` and
the human types `/seven-steps-primer`. Routing never happens. Stripping the flag to make
the ablation possible made invocation depend on a mechanism real use does not have — so
the suite was measuring routing while reporting it as method.

**Why this is fair.** The line is identical in both arms and names no part of the method
— no gates, no steps, no planning vocabulary. The without-arm finds nothing and proceeds;
the with-arm finds the primer. It models the production scenario, a human who intends to
use a method, without a slash command that would error in the baseline and inflate the
delta.

**What it changes about the claim.** The suite now measures *given the human meant to
invoke it, does it help* — not *does the model reach for it unprompted*. That is the
question users have, and it is narrower than the earlier framing. The claim ceiling is
unchanged; the README must not read the delta as a statement about routing.

**Standing.** No scored sweep has run — the pilot is one case at one run against a
registered `runsPerCase` of 5 — so the amendment window described in Amendment 1 is still
open. Conditions, cases, graders, threshold, models and all twelve registered directions
are untouched.

Pilot after the change: Δ +0.429 on `gate-stop-step0`, `Skill called 1x`. n=1; a pilot,
not a result.

## Amendment 3 — the CLI pin is a series, not an exact version

`claudeVersion` stays `2.1.250`, and I2 now compares only its **major.minor**. A patch
difference no longer voids a run; a minor or major bump still does.

**Why.** Four patches landed under this project inside a week. An exact pin is stale
before it is spent, and a rule nobody can satisfy gets ignored rather than followed.

**What it costs, stated plainly.** Every breaking change this project hit arrived in a
patch — 2.1.246 re-encoded the bundled reference and killed eleven citations, 2.1.251
changed the plugin-path rule, refused Bash-granting runs outright, and compressed the
reference again. **A series rule would have caught none of them.** This amendment trades
a detection mechanism for a usable one, and the trade is only defensible because the
detection mechanism was never the thing doing the work: all four were found by *running*
the smoke pass, which costs cents, not by comparing version strings.

**What replaces it, and is stronger.** The exact-version check was protecting
comparability *over time*, which is the weaker concern. The headline rests on comparability
*between the three sweeps being merged* — and nothing was checking that. I2 now voids a
merge whose sweeps ran on different CLIs. Three sweeps on one patch are comparable to each
other whatever the pin says; three that straddle an upgrade are not, however well they
match it.

**Standing.** No scored sweep has run. Conditions, cases, graders, threshold, models, run
count and all twelve registered directions are untouched.

## Amendment 4 — the instrument is corrected and the first sweep is withdrawn

Recorded 2026-09-02, after the first full sweep and before any re-sweep. Two code reviews
of the suite (`docs/plans/primer-evals/pr-1-review-2026-09-02.md`) found defects in the
instrument itself: in the placebo, in four graders, in the noise-floor rule, in how one
case was run, and in what the merger checked. Each is stated below with what changed.

**Every number published from the first sweep is withdrawn.** Not reinterpreted:
withdrawn. The graders changed for all three conditions, so no column from that sweep is
comparable to a column measured now. The merger refuses the old result files (I2b).

### 4.1 The placebo was not matched to the treatment it was controlling for

The placebo is a length- and structure-matched control: same gate scaffolding, same
section-for-section shape, none of the primer's method content. Commit 5bb1070 changed
the treatment's setup section so that the artifact home is named *in* the step-0
artifact and the setup questions are handed over at gate 0 instead of blocking ahead of
it. The placebo was not re-matched. It kept the old "decide before step 0" wording, and
its optional post-*proceed* filing told the agent to write nothing to disk until a
*proceed* that a one-turn case never sends. So `plan-exists` could not pass for the
placebo by construction, and four of five placebo runs on `gate-stop-step0` opened by
asking setup questions and produced no artifact.

The published +0.20 on `gate-stop-step0` vs `placebo` was therefore not a measurement of
gate wording. It was one condition receiving a fix the other did not, plus one grader
lost by construction.

What changed: three paragraphs of `conditions/placebo/SKILL.md` (lines 12, 24, 26). The
record's home is named in the step-0 artifact; each step's artifact is written to disk as
it is produced; the two setup choices are handed over at gate 0 beside the artifact; only
an optional per-gate **commit** is deferred until after a *proceed*, which is the
treatment's own shape. Two sentences are now near-verbatim from the treatment on purpose:
the confound was that the treatment had that instruction and the placebo did not, and a
paraphrase would reopen the same gap in a weaker form. Body word count moved from 1926 to
1964 against a treatment of 1975 (97.5% to 99.4%). The 41-block structure is unchanged.
No method content crossed over.

The registered direction for `gate-stop-step0` vs `placebo` stays **0**.

### 4.2 Four graders scored the wrong thing, and six judge prompts carried notes

**`source-untouched`** (in `gate-stop-step0` and `looks-trivial-is-structural`) keyed on
the 429 message text, which the requested change never touches. Measured against the
fixture with five single edits applied one at a time (limit raised, window widened, `>`
loosened to `>=`, the `plese` typo corrected, the Map-keyed rewrite), the old pattern
still reported "source untouched" after four of the five. A single-anchor replacement on
`let hitsInWindow = 0;` also survived four of five, a different four. The pattern is now a
conjunction of five anchors, one per line the change must alter, and scores 0 on all
five edits. It is linear on any input (lookaheads, no nested quantifiers). The surviving
sets are pinned by a test in `scripts/test/graders.test.mjs`, so the figures above are
measured, not asserted.

**`no-source-edits`** (same two cases) banned every Edit call, with no path scope, while
its sibling `no-source-writes` was scoped to source paths. A treatment run that wrote its
plan and then edited that plan file failed the grader in the with-arm only. It now
carries the same `input_match` as its sibling, per the decision recorded in
`docs/plans/primer-evals/6-cold-fork-register.md`.

**The six LLM graders** sent their design notes, probe lists and exemplar replies to the
judge. The harness passes an LLM grader's markdown body to the judge verbatim as the
criteria, HTML comments included (verified against CLI 2.1.250; harness-facts #40–43).
Fencing notes in comments, which four graders did, was a fence for nothing. Every note
has moved to a sidecar file at the case root (`<case>/<grader>.notes.md`, outside
`graders/` so the harness never loads it), and a test now refuses any LLM grader body
containing a comment, a probe section or a design note. The criteria themselves did not
change; what the judge reads did.

Affected: `gate-stop-step0/step0-only`, `triage-decompose-epic/refuses-the-whole`,
`looks-trivial-is-structural/does-not-skip`, `step3-markers-in-source/not-a-doc-list`,
`triage-skip-oneliner/fixes-it-directly`, and `control-all-steps/reaches-step-6` (which
I7 keeps out of every headline).

### 4.3 A contrast that ties the noise floor is inside it

The rule read "smaller than the floor". The code compared with `<` and no tolerance. On
the first sweep, `triage-decompose-epic` vs `placebo` was 2/15 against a floor of 2/15,
bit for bit, and was published as a held +0.13. A different summation order flips it.

The rule is now: a contrast whose |Δ| is at or below the floor plus 1e-9 is inside the
floor, published and marked `belowNoiseFloor`. This changes how one number is read; it
changes no registered direction. Section "The undertaking" above is restated to match.

### 4.4 `step3-markers-in-source` is now run at the ablation it was registered at

It is registered `ablation: none`. The runner swept it `with-without` with every other
case, and its skill-fired grader was demoted to unscored. The runner now groups scored
cases by ablation and, because the ablations differ, runs one harness invocation per
case per condition (five per condition), each with its own `--ablation` and exactly one
`--case`; the harness accepts one case glob and keeps only the last of several, which
the first attempt at this re-sweep paid for. The documents are combined into one record
per condition. Each record carries a per-case `ablations` map, and a new invariant
**I4b** voids the merge if any scored case was swept at an ablation other than its
registered one, is missing from any condition, or has an empty run list.

### 4.5 A sweep now records the instrument it was measured with

Nothing tied a result file to the graders, fixture and conditions it was measured on.
The three files in `results/` were from two different days, and a control-only re-run
rewrote `drift.json` for a treatment measured on an older mirror. Every sweep record and
`drift.json` now carry `instrumentSha`, a SHA-256 over every file under the suite
directory except `results/`, `node_modules/`, and this file and the README at the suite
root. A new invariant **I2b** voids the merge when the sweeps disagree with each other or
with the tree. In practice: any change under the suite directory, other than to prose at
its root, means all three conditions are swept again before anything merges.

**Unchanged.** The three conditions, the five scored cases, the threshold, the subject
and judge models, five runs per case, and all twelve registered directions.

**Re-sweep required.** All three conditions, from a committed tree, then a merge.

### 4.6 Addendum, after the re-sweep: harness transcripts are not instrument

The re-sweep's merge was refused by I2b. The harness rewrites `<sessionId>.jsonl` inside
a replay case's directory on every run (harness-facts #30), and the digest had hashed
that file, so the tree stopped matching the digest the sweeps carried the moment step3
ran. The digest rule now skips those files; the authored `history.jsonl` stays in.

The three sweep records and `drift.json` were re-stamped from `71073d155e3a…` to
`f156813ba17e…`, the digest under the corrected rule. Each record keeps the original
digest and this reason under `instrumentShaRestamped`. The evidence that this is the
same instrument: all three sweeps agreed on the original digest, and no git-tracked file
under the suite directory other than the two root prose files changed between the sweep
start and the re-stamp (`git diff f2c04fc..aa81788 -- evals/seven-steps-primer`).

## Amendment 5 — the instrument digest is split, and conditions are registered here

Recorded 2026-09-03, after the re-sweep and before any further sweep. No number changes.
No direction changes (I8). The three conditions and their twelve directions stand.

### 5.1 One digest over every condition made every experiment cost four sweeps

Amendment 4.5 stamped each sweep with one digest over the whole suite directory,
`conditions/` included. So adding a fourth condition (a treatment with one section
removed, for the section-ablation experiment) changed the digest and voided the three
records already taken: a one-sweep experiment cost four sweeps. That was the wrong
unit. A sweep copies one condition into `_conditions/current`; the other conditions'
files are not part of what it measured.

The digest is now two. **`instrumentSha`** covers what every condition shares: the
cases, their graders, the transcripts they replay, the fixture. It is stamped on every
sweep record and on `drift.json`, and every one of them must agree with each other and
with the tree, as before. **`conditionSha`** covers `conditions/<id>/` and nothing else,
is stamped on that condition's record only, and is compared against the tree's digest of
that condition alone. I2b refuses either half when it is absent.

In practice: editing a grader, a fixture, a case or a transcript voids every record, as
before. Editing one condition's `SKILL.md` voids that condition's record and no other.
Adding a condition voids nothing.

### 5.2 The conditions are registered in this file, not in code

The runner and the merger held a list of three condition ids. The list is now the
`conditions` array in the registered record above, and both read it from there. Adding
a condition is an amendment to this file: the id, a directory `conditions/<id>/`, and an
`expectedDirection` for every delta case against it. The parser refuses a list with a
direction missing, so an incomplete registration costs nothing rather than a sweep.
`none` is reserved: it names the harness's without-arm, the column every contrast is also
taken against.

Ids are lowercase letters, digits and hyphens. A registered condition with no directory
is refused at sweep time; a directory with no registration is not a condition.

### 5.3 What this costs

The re-sweep's three records were stamped under the old rule and carried no
`conditionSha`; they are also no longer on disk (the raw `results/*.json` were deleted
with the feature worktree on 2026-09-03, before this amendment). The published numbers in
`docs/plans/primer-evals/RESULTS-2026-09-03.md` stand as published; nothing here
reinterprets them. But no new condition can be merged against them, because there is
nothing to merge against. **One full sweep of the three registered conditions is
required** before the first added condition can be swept alone. That sweep should follow
the grader corrections in bean skills-ie78 (the step3 judge criteria, its turn cap and its
`skill-fired` grader), since those change the shared digest and would otherwise force a
second full sweep.

**Unchanged.** The three conditions, the five scored cases, the threshold, the subject
and judge models, five runs per case, and all twelve registered directions.

## Amendment 6 — `step3-markers-in-source`: the judge criteria, the turn cap, and a grader that scored the transcript

Recorded 2026-09-03, after a treatment-only read of the case
(`docs/plans/primer-evals/step3-read-2026-09-03.md`, $1.40, not mergeable and not in any
table). No direction changes; the case is capability evidence and has none. The published
0.85 / 0.25 / 0.25 stands as published under the instrument it was measured with.

### 6.1 What the read showed

Both file graders passed 5 of 5 treatment runs: the markers were in the code every time.
The quarter lost on three of five re-sweep runs, and four of five in the read, was always
`not-a-doc-list`, for two reasons. Two runs hit the 14-turn cap after placing every
marker and the judge saw a fragment. Two runs finished and reported the placed markers as
a per-file list with line numbers, and three judges failed each of them unanimously,
because the criteria told the judge that enumerated sites score 0 and the judge cannot see
the workspace. The controls' flat 0.25 was `skill-fired`: the replayed seed turn names
the skill, so the Skill tool fires under every condition.

### 6.2 What changed

- **`graders/not-a-doc-list.md`.** The criteria now give the 1 to any reply that says the
  markers are in the source files and names a file that was edited, whatever its shape
  (list, table, count, sentence), and keep the 0 for a plan, a proposal, a document in
  place of the code, or a fragment that reports nothing. The file graders remain the check
  on the claim; the judge grades the report.
- **`case.yaml` `max_turns`: 14 → 20.** The cap bounds cost; it was deciding the score.
- **`graders/skill-fired.md` removed.** A grader every condition passes by construction
  measures nothing about the condition. Under `--ablation none` there is no with-only
  demotion to hide it behind, so it is gone. The grader table in this file listed three
  graders for the case from the start and never counted it; the directory now matches.
  The case is scored on three graders, so a control that places no marker and reports
  none scores 0.00, not 0.25.

### 6.3 What this costs

All three change the shared instrument digest (Amendment 5), so this case's records, and
with them every record from the same sweep, are unmergeable with any record taken after
it. That is the same full sweep Amendment 5.3 already requires. Nothing is re-run for
this amendment alone.

**Unchanged.** The three conditions, the five scored cases, the threshold, the subject
and judge models, five runs per case, and all twelve registered directions.

## Amendment 7 — the first section ablation: `treatment-no-triage`

Recorded 2026-09-04, after the full sweep of that day and before the ablation is swept.
This is the first experiment of `docs/plans/primer-evals/tier-2-backlog.md`: remove one
section of the primer, re-run the existing suite, and see whether any Tier 1 score moves.

### 7.1 The condition

`treatment-no-triage` is the treatment with its `## Does this earn the gates?` section
removed, and nothing else changed: 1888 words against the treatment's 2004, identical
frontmatter. It is generated from the shipped skill by `scripts/build-conditions.mjs`
(`ABLATIONS`), the same way as the treatment mirror, and drift-checked the same way, so it
cannot describe a version of the skill the treatment has moved on from. The section holds
the three triage rules: skip a one-line fix, decompose an epic, run the method on a medium
structural change.

### 7.2 The registered directions, and why they are all 0

The contrast is treatment minus `treatment-no-triage`, one per delta case. The method's
own claim is that the triage section is what makes the agent skip a typo fix, decompose an
epic and recognise a structural change, which would predict +1 on the three triage cases.
The evidence registered above predicts otherwise: the placebo, which carries no triage
content at all, tied or beat the treatment on every delta case in two sweeps. A prediction
is what we expect, not what we hope, so all four directions are registered **0**: removing
the section moves nothing outside the noise floor. A contrast that clears the floor in
either direction is then a miss, and a finding: the section earns its length.

The four directions are added; the twelve existing ones do not move (I8). The condition is
capability-irrelevant: `step3-markers-in-source` is single-arm and has no contrast.

### 7.3 What it costs

One sweep of the new condition, about $9, merged against the three 2026-09-04 records.
Nothing is re-run: the condition's own digest is stamped on its record alone (Amendment 5).
Until the sweep lands, the merger refuses the suite, by design: a registered condition with
no record is a comparison missing a column.

**Unchanged.** The five scored cases, the threshold, the subject and judge models, five
runs per case, and the twelve directions registered before this amendment.

## Amendment 8 — the second section ablation: `treatment-no-failure-modes`

Recorded 2026-09-04, after ablation 1 was merged and before this one is swept.

### 8.1 The condition

`treatment-no-failure-modes` is the treatment minus its `## Failure modes` section, the
last section of the file: seven named failure modes (rubber-stamp gate, rushing to the
diff, self-certifying, trusting the shipped half, reading in place of running, reporting
the break instead of fixing the artifact, verdicts without evidence). Generated and
drift-checked like `treatment-no-triage`. Identical frontmatter.

### 8.2 The registered directions

Treatment minus `treatment-no-failure-modes`, one per delta case, all **0**, for the reason
given in 7.2: the placebo carries none of this content and matches the treatment. The
alternative this experiment can detect is specific: "rushing to the diff" and
"self-certifying" are the two failure modes that describe not stopping at a gate, so if the
list does anything Tier 1 can see, it is a positive contrast on `gate-stop-step0` or on
`looks-trivial-is-structural`, the case where ablation 1 showed the treatment failing to
stop. The sixteen existing directions do not move.

### 8.3 What it costs

One sweep, about $11, merged against the four records of 2026-09-04. The merger refuses
the suite until it lands.

**Unchanged.** Everything else.

## Amendment 9 — the third section ablation: `treatment-no-setup`

Recorded 2026-09-04, after ablation 2 was merged and before this one is swept.

### 9.1 The condition

`treatment-no-setup` is the treatment minus its `## Set the artifact home` section: the
default artifact home (`docs/plans/<feature>/`), the instruction to name it in the step-0
artifact, the tracker binding, and the two setup choices (worktree, per-gate checkpoints)
handed over at gate 0. Generated and drift-checked like the other two. Identical
frontmatter.

### 9.2 The registered directions, and why one is not 0

`gate-stop-step0` vs `treatment-no-setup`: **+1**. This is the one ablation where the
suite already holds evidence of an effect: Amendment 4.1 found that the placebo, lacking
the equivalent setup wording, could not pass `plan-exists` by construction, and the
"earlier measurement" section below found the same section's wording moving `plan-exists`
from 0 of 5 to 4 of 5. `plan-exists` is one of seven graders on that case, so the
predicted contrast is about +0.10 to +0.15, near the floor; the sign is what is registered.

The three triage cases: **0**. None of them asks for an artifact, and the section says
nothing about triage.

### 9.3 What it costs

One sweep, about $11, merged against the five records of 2026-09-04.

**Unchanged.** Everything else.

## Amendment 10 — the gate rule is restated where the ablations showed it losing

Recorded 2026-09-05, after the section-ablation experiment (results sections for
ablations 1 to 3 below) and before any sweep of the changed text. This is the first
amendment that changes the **shipped skill**, and it is made in response to eval output,
by the skill's author, on a fixture the author wrote. That contamination is stated here
so that the number the re-sweep produces is read as what it is: a check that a targeted
edit did what it was meant to, on the case it was meant for, not independent evidence.

### 10.1 What the ablations showed

On `looks-trivial-is-structural` the full primer scores 0.72 twice in two sweeps: two runs
in five diagnose the structural cause correctly and then implement it in the same turn.
Every shortened version of the document stops more often (0.84, 0.92, 1.00), and so does
the placebo (0.92). No section owns the effect. The reading that fits all five rows is
that "one step per turn, stop at the gate", stated once near the top, is outweighed by
everything that follows it when the request is one the agent can see how to finish.

### 10.2 What changed, in both matched documents

Two additions to `skills/seven-steps-primer/SKILL.md`, and the same two, in the placebo's
own words, to `conditions/placebo/SKILL.md`, because a stop instruction is gate scaffolding
and the placebo is the same-shape control (Amendment 4.1 is what happens when the
treatment gets a sentence the placebo does not):

- **Step 0's line** ends with what stopping means: "The plan is this turn's whole
  deliverable: write it, change no source, and stop — however obvious the fix now looks."
- **A closing block**, the last thing in the file: "The rule that outranks the rest. One
  step, one artifact, one gate, then stop. A correct diagnosis is not permission to
  implement it; a fix that looks obvious is not permission to skip the gate. If you have
  done more than the current step asked, you have left the method."

Nothing is removed. The treatment moves from 2004 to 2075 words, the placebo from 1993 to
2065; each gains one block.

### 10.3 What is registered, and what is withdrawn

**The twelve directions do not move** (I8). The prediction this amendment adds is not a
new direction; it is that `looks-trivial-is-structural` vs `none` and vs `placebo` stay at
their registered +1, with the treatment now stopping in five runs of five rather than
three. Whether it does is what the re-sweep measures.

**The three ablation conditions are withdrawn from the active list.** They were
generated from the old text, their experiment is complete, and their results sections
stand as measured under their own condition digests. Their twelve directions are removed
from the block above with them; those directions produced the numbers in the ablation
results sections and are quoted there. The generated directories remain and regenerate
from the new text, unregistered, so the experiment can be re-run against the new text
later if wanted. A merge under this registration compares three conditions.

### 10.4 What it costs

Two sweeps, treatment and placebo, about $20: both documents changed, so both condition
digests changed, and I2b voids both records. The one-liner's record stands (its text and
the shared instrument are unchanged). The merger refuses the suite until both new records
land.

## Amendment 11 — the recon ablation: `treatment-no-recon`

Recorded 2026-09-05, after the Amendment 10 re-sweep and before this condition is swept.

### 11.1 Why

After Amendment 10 the treatment still implements `looks-trivial-is-structural` in one
run of five, and that run opened "Reproduced and fixed": it ran the symptom before fixing
it. The placebo, with the same stop sentence and no recon content, stops in five of five.
The hypothesis is that the primer's step-4 language, recon is a run and not a read, is
what the remaining implementer obeys at step 0, where no run was asked for.

### 11.2 The condition

`treatment-no-recon` is the treatment minus every line that says recon is a run: the
eight sub-bullets under step 4 (recon is a run, run every seam, name the excuse, an
environment that blocks the run, run the whole path, tests are part of the run, close the
loop, the evidence-bearing report) and four failure modes (trusting the shipped half,
reading in place of running, reporting the break instead of fixing the artifact, verdicts
without evidence). The step-4 line itself stays, so the steps still number 0 to 7, and the
deliverables line still names step 4's artifact. Generated by `scripts/build-conditions.mjs`
(`ABLATIONS`, a line-prefix cut rather than a section cut) and drift-checked like the
others. Identical frontmatter.

It is a larger cut than the section ablations: 1315 words against 2075, 37% of the
document. A contrast here is therefore also consistent with "any large removal helps",
the pattern ablations 1 to 3 showed, and the results section will have to say which
reading it supports. What separates the two: the section ablations were 6% to 15% cuts
that each helped by 0.12 to 0.28 before Amendment 10; after it, the room left on
`looks-trivial-is-structural` is one run in five.

### 11.3 The registered directions

Treatment minus `treatment-no-recon`, one per delta case:

- `looks-trivial-is-structural`: **−1**. The hypothesis predicts the ablated version stops
  in five of five where the treatment stops in four, a contrast of about −0.12.
- `gate-stop-step0`, `triage-skip-oneliner`, `triage-decompose-epic`: **0**. No Tier 1
  case reaches step 4, and none of them has shown a run-before-planning failure.

The twelve existing directions do not move (I8).

### 11.4 What it costs

One sweep, about $10, merged against the 2026-09-05 records.

---

# Results — first full sweep, 2026-09-01

> **Withdrawn by Amendment 4.** This section is the first sweep's reading, kept as a
> record of what was published and why it was wrong. The graders, the placebo and the
> noise-floor rule under which these numbers were produced have all changed. Nothing
> below is a finding until the re-sweep replaces it.

Three sweeps, five cases, five runs per arm, 150 runs, **$28.49** API-equivalent
(subscription-metered; no money moved). Subject `sonnet`, judge `opus`, CLI `2.1.250`.
Suite `a8a952f`. Full report: `docs/plans/primer-evals/RESULTS-2026-09-01.md`.

Every sweep passed I1c (no ungraded runs, no grader that threw), all three ran on the
same CLI, and the merge emitted no combined score.

**Noise floor: 0.13** — the worst per-case spread between the three stock-Claude columns
measured against identical cases. Contrasts below it are marked and are not findings.

## The registered predictions against what happened

D6a registered a sign per case/control pair before any run. Here is each one with its
outcome. Contrasts below the noise floor are shown as **~0** because that is what they
mean.

| Case | vs `none` | vs `oneliner` | vs `placebo` |
|---|---|---|---|
| `gate-stop-step0` | +1 → **+0.49 ✓** | +1 → **+0.29 ✓** | 0 → **+0.20 ✗** |
| `looks-trivial-is-structural` | +1 → **+0.31 ✓** | +1 → **~0 ✗** | +1 → **~0 ✗** |
| `triage-skip-oneliner` | 0 → **~0 ✓** | 0 → **+0.67 ✗** | 0 → **~0 ✓** |
| `triage-decompose-epic` | +1 → **+0.42 ✓** | +1 → **~0 ✗** | +1 → **~0 ✗** |

**Six of twelve predictions held. Six did not**, and the misses are the informative
part. (First written as seven and five: the `triage-decompose-epic` vs `placebo` contrast
tied the floor exactly and was published as held under the old `<` rule. Amendment 4.3
restates it as inside the floor.)

### The placebo prediction was backwards

Withdrawn: see Amendment 4.1. The +0.20 was a fix applied to one condition only, plus a
grader the placebo could not pass by construction. What follows is the reading before
that was known.

Registered: *ties on gating, loses on triage.* Measured: it **lost on gating** (+0.20 to
the treatment on `gate-stop-step0`) and **tied on triage** (~0 on `looks-trivial`).

The reasoning behind the prediction was that a same-shape scaffold would reproduce
gate-stopping while lacking triage content. The opposite happened: the placebo's arbitrary
step contents were enough to trigger correct triage behaviour, and not enough to produce
a proper step-0 artifact. Whatever makes an agent stop and plan at gate 0 is in the
primer's *content*, not in the presence of eight numbered gates.

### The one-liner reproduces the triage results and nothing else

The sharpest finding, and it is not a flattering one. On both structural-triage cases the
primer beats stock Claude Code substantially and beats thirteen words by nothing:

```
looks-trivial-is-structural   vs none  +0.31    vs oneliner  +0.04  (below floor)
triage-decompose-epic         vs none  +0.42    vs oneliner  -0.00  (below floor)
```

An eval that ran only the built-in ablation — treatment vs no plugin, which
`--ablation with-without` gives for free — would have reported +0.31 and +0.42 and called
the method validated. The one-liner column is what turns that into *"+0.04 and −0.00 over
a single sentence."* That is what the control conditions were built for.

### The one-liner's failure is the guardrail's success

`triage-skip-oneliner` was registered at 0 against every control, and the treatment,
placebo and stock Claude all score **1.00**. The one-liner scores **0.33 in all five
runs**: told to present a plan and wait for approval, it does exactly that — for a typo
fix. That is ceremony where the gates are unearned, which is the harm the primer's triage
section exists to prevent, demonstrated by the control that lacks it.

The registered 0 counts as missed against the one-liner. It is the one miss that supports
the method rather than undercutting it, and it is recorded as a miss regardless.

### The one case the method has to itself

`step3-markers-in-source` (capability evidence, single-arm — the number has no referent
outside itself and is never averaged with the table above):

```
treatment 0.47   ·   oneliner 0.00   ·   placebo 0.00
```

All ten control runs scored zero. Neither control ever places a marker in source, because
neither asks for one. But the treatment's own scatter is `0.67 · 0.00 · 1.00 · 0.67 ·
0.00` — it works about half the time, and reporting 0.47 without that spread would be the
mean hiding the instrument.

## What this supports, at the claim ceiling

> With the primer loaded, the agent produces one step's artifact and stops, holds that
> under task pressure, and does not add ceremony to work that does not need it — measured
> against no skill, a one-line equivalent, and a same-shape placebo.

That sentence survives, with two qualifications the numbers require:

1. **Against a one-line gating instruction, the advantage is narrow.** It is real on
   gate-stopping (+0.29) and on not over-ceremonialising a typo (+0.67), and it is
   indistinguishable from noise on both structural-triage cases.
2. **The unique capability is step 3.** Markers in source is the one behaviour no control
   produced at all — and the treatment produces it inconsistently.

And what these numbers still cannot say, unchanged: nothing about whether the software
comes out better. That is Tier 2, and it is not purchasable at this budget.

---

# Results — re-sweep, 2026-09-03

Three sweeps, five cases, five runs per arm, 150 runs, **$27.07** API-equivalent
(subscription-metered; no money moved). Subject `sonnet`, judge `opus`, CLI `2.1.250`.
Suite `aa81788`, instrument `f156813ba17e`. Full report:
`docs/plans/primer-evals/RESULTS-2026-09-03.md`. This replaces the withdrawn section
above.

Every sweep passed I1c, all three ran on the same CLI and the same instrument (I2b),
every registered case ran in every condition at its registered ablation (I4b), and the
merge emitted no combined score.

**Noise floor: 0.12.** Contrasts at or below it are marked and are not findings.

## The registered predictions against what happened

| Case | vs `none` | vs `oneliner` | vs `placebo` |
|---|---|---|---|
| `gate-stop-step0` | +1 → **+0.69 ✓** | +1 → **+0.23 ✓** | 0 → **~0 ✓** |
| `looks-trivial-is-structural` | +1 → **+0.43 ✓** | +1 → **~0 ✗** | +1 → **−0.24 ✗** |
| `triage-skip-oneliner` | 0 → **~0 ✓** | 0 → **+0.67 ✗** | 0 → **~0 ✓** |
| `triage-decompose-epic` | +1 → **+0.24 ✓** | +1 → **~0 ✗** | +1 → **~0 ✗** |

**Eight of twelve predictions held. Four did not.**

### The placebo ties or beats the treatment on every delta case

This is the result of the re-sweep, and it is the opposite of what the withdrawn sweep
said. With the placebo re-matched to the current treatment (Amendment 4.1), the +0.20
on `gate-stop-step0` became +0.03, inside the floor, exactly as the amendment said it
would. On `triage-skip-oneliner` and `triage-decompose-epic` the two tie. On
`looks-trivial-is-structural` the placebo scores 1.00 on all five runs and the treatment
0.76, a contrast of −0.24 against a registered +1. That is the one prediction that came
out with the wrong sign, and the registration flagged this pair as the one held against
our own interest.

What that means, stated plainly: on every behaviour Tier 1 measures, a document with the
primer's gates and shape but none of its method content does as well as the primer. The
stop-and-plan behaviour comes from the gate scaffolding. The primer's specific content,
triage rules, recon-as-a-run, the failure-modes list, has no measurable effect on these
five cases at this sample size.

### The one-liner result is unchanged

The thirteen-word instruction still loses on gate-stopping (+0.23 to the treatment) and
still adds ceremony to a typo fix (+0.67), and still ties the treatment on both
structural-triage cases. Those are the same three findings as the withdrawn sweep.

### The one case the method has to itself, still

`step3-markers-in-source` is capability evidence, not a contrast. The treatment scores
0.85 (runs 0.75 · 1.00 · 0.75 · 1.00 · 0.75); both controls score 0.25 on every run.
Placing to-do markers in the source is the one behaviour no control produces, and under
the corrected `ablation: none` it is now measured as registered.

## What this supports, at the claim ceiling

> With the primer loaded, the agent produces one step's artifact and stops, holds that
> under task pressure, and does not add ceremony to work that does not need it — measured
> against no skill, a one-line equivalent, and a same-shape placebo.

The sentence survives as a description of what the agent does with the primer loaded.
What the re-sweep adds is what it does not support:

1. **It does not support attributing any of that to the primer's content.** The
   same-shape placebo produces the same behaviour, and on one case more of it.
2. **Against one sentence, the advantage is where it was.** Gate-stopping and not
   over-ceremonialising a typo; nothing on structural triage.
3. **The unique capability is still step 3**, and it is still inconsistent.

Tier 2's first experiment, ablating the primer's sections one at a time, is now the
obvious next measurement, and the placebo result says which way to bet.

---

# Results — sweep after Amendments 5 and 6, 2026-09-04

Three sweeps, five cases, five runs per arm, 150 runs, **$26.76** API-equivalent
(subscription-metered; no money moved). Subject `sonnet`, judge `opus`, CLI `2.1.250`.
Suite `510488a`, instrument `a21420ccf879`, conditions `0c71babfdd66` / `69937f816b3e` /
`591352963d83`. Full report: `docs/plans/primer-evals/RESULTS-2026-09-04.md`; the records
are committed under `docs/plans/primer-evals/records/2026-09-04/`. This is the current
result; the 2026-09-03 section above stands under its own instrument.

Every sweep passed I1c, all three ran on the same CLI and the same shared instrument, each
against its own condition digest (I2b), every registered case ran in every condition at its
registered ablation (I4b), and the merge emitted no combined score. Two earlier attempts on
2026-09-03 and 2026-09-04 were aborted and published nothing (`sweep-log.md`).

**Noise floor: 0.13.** Contrasts at or below it are marked and are not findings.

## The registered predictions against what happened

| Case | vs `none` | vs `oneliner` | vs `placebo` |
|---|---|---|---|
| `gate-stop-step0` | +1 → **+0.66 ✓** | +1 → **+0.17 ✓** | 0 → **~0 ✓** |
| `looks-trivial-is-structural` | +1 → **+0.33 ✓** | +1 → **~0 ✗** | +1 → **−0.20 ✗** |
| `triage-skip-oneliner` | 0 → **~0 ✓** | 0 → **+0.67 ✗** | 0 → **~0 ✓** |
| `triage-decompose-epic` | +1 → **+0.27 ✓** | +1 → **~0 ✗** | +1 → **~0 ✗** |

**Seven of twelve predictions held. Five did not.** The 2026-09-03 sweep had eight; the
one that moved is `gate-stop-step0` vs `placebo`, which stayed inside the floor and so
still holds, and `triage-decompose-epic` vs `oneliner`, +0.07, inside the floor both
times. The count differs by the reading of ties, not by any contrast changing sign.

### The same three findings, on a corrected instrument

The picture is the one the 2026-09-03 sweep drew, reproduced on a different day with the
step3 instrument corrected. **The placebo ties or beats the treatment on every delta
case**: inside the floor on three, and −0.20 on `looks-trivial-is-structural` (placebo
0.92, treatment 0.72; last time −0.24). **The one-liner** loses on gate-stopping (+0.17)
and adds ceremony to a typo fix (+0.67), and ties on both structural-triage cases.
**Against no instruction** the primer wins on three of four, and ties on the guardrail
case as registered.

### The one case the method has to itself, now measured cleanly

`step3-markers-in-source` under Amendment 6, three graders, no transcript-only grader: the
treatment scores **0.80** (runs 1.00 · 1.00 · 1.00 · 0.00 · 1.00); both controls score
**0.00** on every run. The rewritten judge criteria passed every list-shaped report of
placed markers (4 of 4, unanimous), which is what Amendment 6 predicted. The one zero is
not a judge artefact: that run ignored the replayed transcript, restarted the method at
step 0 and wrote a plan document instead of markers, failing all three graders. That is a
real miss, and it is the shape of miss the case exists to catch.

## What this supports, at the claim ceiling

> With the primer loaded, the agent produces one step's artifact and stops, holds that
> under task pressure, and does not add ceremony to work that does not need it — measured
> against no skill, a one-line equivalent, and a same-shape placebo.

Unchanged from the 2026-09-03 reading, now reproduced:

1. **The sentence describes what the agent does with the primer loaded.**
2. **None of it is attributable to the primer's content.** The same-shape placebo produces
   the same behaviour, and on one case more of it.
3. **Against one sentence, the advantage is gate-stopping and not over-ceremonialising a
   typo.** Nothing on structural triage.
4. **The unique capability is step 3**, at four runs in five, with the fifth a restart
   rather than a list.

These three records are the base the section-ablation experiment merges against. Each
ablated condition is one sweep, compared here.

---

# Results — ablation 1, `treatment-no-triage`, 2026-09-04

One sweep of the ablated condition, five cases, five runs per arm, **$10.63**, merged
against the three records above with nothing re-run (Amendment 5). Suite `88be913`,
instrument `a21420ccf879`, condition `74b9ffa4ff91`. Full four-column report:
`docs/plans/primer-evals/RESULTS-2026-09-04-no-triage.md`; record committed beside the
others. Every invariant passed on the first merge.

## The registered predictions against what happened

Contrast is treatment minus `treatment-no-triage`; all four were registered **0**.

| Case | Δ | verdict |
|---|---|---|
| `gate-stop-step0` | +0.00 | ✓ inside the floor |
| `looks-trivial-is-structural` | **−0.20** | ✗ the ablated version scores 0.92, the treatment 0.72 |
| `triage-skip-oneliner` | +0.13 | ✓ inside the floor (0.13) |
| `triage-decompose-epic` | +0.13 | ✓ inside the floor |

**Three of four held.** The miss is a finding, and it has the sign the method would not
have chosen: removing the triage section makes the agent do better on the one case that
is about recognising a structural change.

### What the section costs, per grader

The treatment's judge grader on `looks-trivial-is-structural`, `does-not-skip`, passed 5
of 5: with the triage section the agent named the shared counter as the cause every time.
What it lost was `no-source-edits` and `source-untouched` (3 of 5) and `liveness` (2 of
5): two runs, having decided the change was structural, went on to implement it, ran the
tests and reported "all 11 tests pass" instead of stopping at gate 0. Without the section,
5 of 5 stopped with the source untouched, which is what the placebo does too (0.92). So the
section is not costing recognition. It is costing the stop: a "does this earn the gates?"
decision, answered "run it", reads as permission to run the whole method in one turn.

On `triage-skip-oneliner` the ablated version lost one run in five (0.87): with no skip
rule to cite, one run wrote a step-0 scoping note instead of fixing the typo. That is the
direction the section is supposed to help in, and at +0.13 it sits exactly on the floor.
On `triage-decompose-epic` the same +0.13, also on the floor. Both are consistent with a
small real effect that this sample cannot resolve, and with none.

`step3-markers-in-source` (capability, no contrast): the ablated version scored 1.00 on
all five runs, the treatment 0.80. Its one miss was a run that restarted at step 0; this
sweep had none.

## What this supports

Of the three sections the backlog proposed to ablate, the first one measured does not
earn its length on the behaviours Tier 1 sees: no case improves with it inside the floor,
and one gets worse by 0.20. The next two ablations (the failure-modes list, the setup
section) are each one sweep against the same three records.

Whether to change the section is a skill decision, not an eval one, and it is tracked as
one (bean skills-fqdf's follow-up). The measurement says what to change: the wording that
turns "run it" into "run all of it", not the triage rules themselves, which the judge
grader shows the agent applying correctly.

---

# Results — ablation 2, `treatment-no-failure-modes`, 2026-09-04

One sweep, **$9.99**, merged against the four records above with nothing re-run. Suite
`4fefb29`, instrument `a21420ccf879`, condition `921644fd9521`. Five-column report:
`docs/plans/primer-evals/RESULTS-2026-09-04-no-failure-modes.md`; record committed. Every
invariant passed on the first merge.

## The registered predictions against what happened

Contrast is treatment minus `treatment-no-failure-modes`; all four were registered **0**.

| Case | Δ | verdict |
|---|---|---|
| `gate-stop-step0` | +0.00 | ✓ |
| `looks-trivial-is-structural` | −0.12 | ✓ inside the floor (0.13) |
| `triage-skip-oneliner` | +0.00 | ✓ |
| `triage-decompose-epic` | −0.00 | ✓ |

**Four of four held.** The failure-modes list does nothing Tier 1 can see. On
`gate-stop-step0` the two conditions are grader-for-grader identical (every grader passes
the same number of runs). The alternative 8.2 named, that "rushing to the diff" and
"self-certifying" help the agent stop, has no support: with the list gone the agent stops
at gate 0 exactly as often. `looks-trivial-is-structural` came out 0.84, between the
treatment's 0.72 and the no-triage 0.92, with one run in five implementing the change; at
−0.12 it is inside the floor and is not a finding.

`step3-markers-in-source` (capability): 0.73 (runs 0.67 · 1.00 · 1.00 · 0.00 · 1.00),
with the same restart-at-step-0 zero the treatment showed once. Not a contrast.

## What this supports

Two sections measured, neither earns its length on Tier 1: the triage section costs 0.20
on one case (ablation 1), the failure-modes list costs and buys nothing. The third, the
setup section, is the one Amendment 4.1 already showed to matter for `plan-exists`, and
is registered next with that prediction.

---

# Results — ablation 3, `treatment-no-setup`, 2026-09-05

One sweep, **$9.68**, merged against the five records above with nothing re-run (a first
attempt on 2026-09-04 hit the subscription's usage limit on its second case and the runner
stopped it at the first thrown grader; $2.91, nothing published). Suite `3049b39`,
instrument `a21420ccf879`, condition `073435ffd412`. Six-column report:
`docs/plans/primer-evals/RESULTS-2026-09-05-no-setup.md`; record committed. Every
invariant passed on the first merge. The six-condition suite has now cost $57.06.

## The registered predictions against what happened

Contrast is treatment minus `treatment-no-setup`.

| Case | registered | Δ | verdict |
|---|---|---|---|
| `gate-stop-step0` | +1 | +0.09 | ✗ inside the floor (0.13) |
| `looks-trivial-is-structural` | 0 | **−0.28** | ✗ the ablated version scores 1.00 on every run |
| `triage-skip-oneliner` | 0 | +0.00 | ✓ |
| `triage-decompose-epic` | 0 | +0.07 | ✓ inside the floor |

**Two of four held.** Both misses need reading.

### The +1 that did not clear the floor, and the grader that did

The prediction named a mechanism: without the setup section the plan does not land in a
file, so `plan-exists` fails. That is exactly what happened: `plan-exists` passed 4 of 5
treatment runs and **0 of 5** ablated runs, and every other grader on the case was equal or
better without the section (`liveness` 5 of 5 against 4). The case score moved +0.09
because one grader lost 4 and another gained 1 out of seven per run, and +0.09 is inside a
0.13 floor. So the registered sign is right, the registered contrast is not a finding, and
the rule stands: the case-level number is what was registered, and it did not resolve. The
grader-level reading is recorded here as description, not as a held prediction.

What the section buys, then, is one thing Tier 1 can see: the step-0 artifact written to
disk rather than set out in the reply. Whether that is worth 232 words is a design
question the number does not answer.

### The −0.28, and the pattern across all three ablations

Without the setup section, `looks-trivial-is-structural` scores 1.00 on all five runs:
every run named the shared counter and stopped with the source untouched. The treatment
scores 0.72 because two runs in five implement the change in the same turn. Now the same
case across every condition of this length:

| condition | words | score | runs that implemented |
|---|---|---|---|
| treatment | 2004 | 0.72 | 2 of 5 |
| `treatment-no-failure-modes` | 1704 | 0.84 | 1 of 5 |
| `treatment-no-triage` | 1888 | 0.92 | 0 of 5 |
| `treatment-no-setup` | 1772 | 1.00 | 0 of 5 |
| placebo | 1993 | 0.92 | 0 of 5 |

Every ablation improves this case, and no two remove the same content. Ablation 1's
reading, that the triage section's "run it" is what licenses running everything, is still
consistent with its own row, but it cannot explain the no-setup row, which keeps the
triage section and does better still. The reading that fits all five rows is that the
treatment, as a whole, gives the agent enough to do on a structural request that two runs
in five do it, and removing any sizeable part of it tips those runs back to stopping. The
placebo, at the same length but with no method content, also stops. Length alone is not
it either, then: it is the treatment's content, in aggregate, and no single section owns
it. At five runs per cell this is a pattern worth registering as the next hypothesis, not
a result.

`step3-markers-in-source` (capability): 0.93 (runs 1.00 · 1.00 · 1.00 · 0.67 · 1.00), no
restart this time.

## What the three ablations support, together

On the five behaviours Tier 1 measures, at five runs per arm and a 0.13 floor:

1. **No section earns its length on any triage case.** Removing the triage section, the
   failure-modes list or the setup section leaves `triage-skip-oneliner` and
   `triage-decompose-epic` inside the floor.
2. **The setup section is the only one with a visible mechanism**, and it is a small one:
   it puts the step-0 artifact in a file (`plan-exists` 4 of 5 against 0 of 5) without
   moving the case score outside the floor.
3. **The treatment under-performs its own ablations on `looks-trivial-is-structural`**,
   consistently: 0.72 against 0.84, 0.92 and 1.00, and against a placebo at 0.92. Two runs
   in five implement instead of stopping. This is the one Tier 1 result that argues for
   changing the shipped skill, and it argues for making it do less, not more.

The section-ablation experiment is complete. What it did not test: the steps list itself,
the deliverables list, and the recon section (no Tier 1 case reaches step 4). What it
cannot say: anything about the software that comes out, which is Tier 2's second
experiment.

---

# Results — after Amendment 10, 2026-09-05

Treatment and placebo re-swept on the amended text, **$18.60**; the one-liner record is
the 2026-09-04 one, unchanged, and merged with them under Amendment 5. Suite `ce5814d`,
instrument `a21420ccf879`, conditions `503291b82253` / `69937f816b3e` /
`0ddcff104f11`. Report: `docs/plans/primer-evals/RESULTS-2026-09-05.md`; records
committed under `records/2026-09-05/`. Every invariant passed on the first merge.

**Noise floor: 0.08.** Smaller than before (0.13): the three `none` columns happened to
agree more closely this time, so more contrasts clear it.

## The registered predictions against what happened

| Case | vs `none` | vs `oneliner` | vs `placebo` |
|---|---|---|---|
| `gate-stop-step0` | +1 → **+0.70 ✓** | +1 → **+0.23 ✓** | 0 → **~0 ✓** |
| `looks-trivial-is-structural` | +1 → **+0.52 ✓** | +1 → **~0 ✗** | +1 → **−0.12 ✗** |
| `triage-skip-oneliner` | 0 → **~0 ✓** | 0 → **+0.67 ✗** | 0 → **~0 ✓** |
| `triage-decompose-epic` | +1 → **+0.22 ✓** | +1 → **~0 ✗** | +1 → **~0 ✗** |

**Seven of twelve held**, the same seven as on 2026-09-04.

## What the amendment did

Amendment 10 predicted one thing: that the treatment would stop on
`looks-trivial-is-structural` in five runs of five rather than three. It stopped in
**four**. The case moved from 0.72 to 0.88 (runs 1.00 · 1.00 · 0.40 · 1.00 · 1.00), and
`gate-stop-step0` moved from 0.94 to 1.00 on every run, with `triage-skip-oneliner`
still 1.00 on every run: the stronger stop added no ceremony to a typo fix. That is the
edit doing what it was meant to, on the cases it was meant for, at a size the floor can
see, and it is read with the contamination Amendment 10 stated.

**The placebo, given the same sentence, stops in five of five** (1.00, from 0.92), and
its `gate-stop-step0` moved from 0.89 to 0.94. So the sentence works on both documents,
and the treatment still carries something the placebo does not that licenses one run in
five to implement. That run's reply opens "Reproduced and fixed": it ran a reproduction
of the symptom, then keyed the throttle per user. Reproducing by running is the primer's
own step-4 vocabulary (recon is a run, not a read), and the placebo has no equivalent. At
one run this is a hypothesis for the next ablation, not a finding: that the recon
section's "run it, don't read it" is what the remaining implementer is obeying.

`step3-markers-in-source` (capability): treatment 0.93 (runs 0.67 · 1.00 · 1.00 · 1.00 ·
1.00), placebo 0.00 on every run.

## What this supports, at the claim ceiling

> With the primer loaded, the agent produces one step's artifact and stops, holds that
> under task pressure, and does not add ceremony to work that does not need it — measured
> against no skill, a one-line equivalent, and a same-shape placebo.

The sentence holds, and holds better than before on its first clause: gate-stopping is
now 1.00 in five of five against 0.30 with no skill. The rest of the reading is unchanged
from 2026-09-04: the same-shape placebo produces the same behaviour, so none of it is
attributable to the primer's method content; against one sentence the advantage is
gate-stopping and the typo guardrail; step 3 is the method's own.

---

# Results — ablation 4, `treatment-no-recon`, 2026-09-05

One sweep, **$9.67**, merged against the three 2026-09-05 records with nothing re-run (a
first attempt the same evening hit the session limit on its third case and the runner
stopped it; $7.40, nothing published, though its two complete cases are quoted below as
corroboration). Suite `78aa56b`, instrument `a21420ccf879`, condition `4e6a35a2381b`.
Four-column report: `docs/plans/primer-evals/RESULTS-2026-09-05-no-recon.md`; record
committed. Every invariant passed on the first merge. Noise floor 0.08.

## The registered predictions against what happened

Contrast is treatment minus `treatment-no-recon`.

| Case | registered | Δ | verdict |
|---|---|---|---|
| `gate-stop-step0` | 0 | +0.09 | ✗ just outside the floor (0.08) |
| `looks-trivial-is-structural` | −1 | **+0.16** | ✗ the opposite sign |
| `triage-skip-oneliner` | 0 | +0.00 | ✓ |
| `triage-decompose-epic` | 0 | +0.00 | ✓ |

**Two of four held.** The hypothesis is refuted.

### What happened on `looks-trivial-is-structural`

Without the recon lines the treatment scores 0.72 (runs 0.60 · 0.80 · 1.00 · 1.00 ·
0.20); the aborted first attempt had it at 0.76 (1.00 · 0.20 · 1.00 · 0.60 · 1.00). With
them, 0.88. Per grader: both versions have **one implementer in five** (`no-source-edits`
and `source-untouched` 4 of 5 in each). What the ablated version loses is elsewhere:
`liveness` 2 of 5 against 4 (two runs wrote a step-0 plan and did not hand control back in
plain words) and `does-not-skip` 4 of 5 against 5. So the recon material is not what
licenses the remaining implementer. It was one run in five with the lines and one run in
five without them, twice.

### What this says about the earlier pattern

Before Amendment 10, every removal helped this case (0.72 → 0.84, 0.92, 1.00). After it,
the largest removal yet, 37% of the document, does not help and slightly hurts. So "any
large cut helps" was not the mechanism either. The reading that fits everything measured:
the old text lacked a stop instruction strong enough to survive the rest of the document,
and any cut reduced what it had to survive; the new text has one, and cuts now cost
whatever the cut lines were contributing. The one implementer in five that remains is not
owned by the triage section, the failure modes, the setup section or the recon material.
At n=5 it may be the base rate of a Sonnet agent handed a diagnosable bug and a document
it can see how to finish.

`gate-stop-step0`: +0.09, one grader on one run, and 0.01 outside a floor that came out
unusually small; not a finding by any reading. `step3-markers-in-source` (capability):
1.00 on all five ablated runs.

## What this closes

The section-ablation line of work is done: four cuts measured, one skill edit made on
their evidence and confirmed, and the residual on `looks-trivial-is-structural` is not
attributable to any part of the document that Tier 1 can isolate. Further Tier 1 sweeps on
this fixture will not resolve it; what would is more runs per cell (a floor at 0.08 with
n=5 is luck, not resolution) or Tier 2's outcome measure.

---

## Earlier measurement — setup choices moved to gate 0

Measured and shipped before the full sweep, and recorded here because this is where the
project's measurements live.

**The change.** SKILL.md told the agent to settle the artifact home *before* step 0, and
separately that the two setup choices were "the human's call, never yours". It obeyed
both: it stopped and asked, producing nothing. Five of five runs replied with 670–1030
characters of triage and questions, and step 0 never happened.

The choices are still the human's. They now arrive **at gate 0**, beside the step-0
artifact, so one reply settles all three instead of spending a round-trip that gives the
human nothing to review.

**Result**, at n=5, one case, `--ablation none`, `sonnet` subject / `opus` judge, against
a grader that did not change between arms:

| | before | after |
|---|---|---|
| `plan-exists` | **0/5** | **4/5** |
| mean score | 0.72 | 0.85 |

A later figure of 0.95 circulated for the "after" arm. It is not comparable: the rubric
changed between those runs, so it blends the skill change with a grader fix. Against a
constant grader the effect is 0.72 → 0.85, and that is the number.

**The grader fix, which the experiment exposed.** `plan-exists` and `step0-only` were
mutually exclusive by construction — one demanded the plan in a file, the other judged
the reply, and five runs split cleanly: four wrote the file and failed the rubric, one
kept the plan inline and failed the file check. **No run could satisfy both**, so the
pair was measuring itself. `step0-only` now accepts a plan either set out in the reply or
written to a file the reply names.

**Contamination, stated rather than waved off.** This was a change to the skill made in
response to eval output, by the author of the skill, the grader, the fixture and the
case. Three things bound it: the mechanism was visible in the replies rather than
inferred from a score, the criterion was the method's own claim (does step 0 happen)
rather than a grader's invention, and 0/5 → 4/5 is not a shift a fitted instrument
manufactures. None of that makes it independent evidence.

