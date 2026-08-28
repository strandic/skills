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
`evidence`/`ablation` values are inert — nothing reads them — and they say what the case
would be if you ran it by hand: a score with no referent, single-arm.

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

Contrasts smaller than the measured noise floor are published too, and marked
`belowNoiseFloor` (I1b). Suppressing them would be publication bias by another name;
publishing them unmarked would be worse than suppressing them.

## The registered record

The merger reads this block and nothing else in this file.

```json
{
  "conditions": ["treatment", "oneliner", "placebo"],
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
    "triage-decompose-epic/placebo": 1
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

