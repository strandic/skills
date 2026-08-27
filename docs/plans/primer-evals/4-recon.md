# Step 4 — recon

Five real sweeps against the real harness. Spike reverted; corrections kept. Run
artifacts under `evals/seven-steps-primer/results/`, five timestamped directories.

**Total spend: $0.28 API-equivalent** (subscription-metered, so no money moved).

Every seam below was probed by **running**. Where a claim is supported by reading
rather than execution it says so.

---

## Seam 1 — `EvalCommand`: what to actually invoke

```bash
CLAUDE_CODE_WALNUT_SPIRE=1 claude-personal plugin eval . \
  --eval-dir evals/seven-steps-primer --case 'gate-stop-step0' \
  --runs 1 --model haiku --no-publish --threshold 0.1
```

**Observed.** Ran to completion, exit 0. Without the variable the same command
prints `` `plugin eval` is currently in early access `` and exits 1 — re-confirmed
directly, not carried over from earlier research.

**Resolution.** Executable from `EVAL_CLAUDE_BIN` (default `claude`); always inject
`CLAUDE_CODE_WALNUT_SPIRE=1`. Unconditional injection is safe — a no-op on a
flag-enabled account — and keeps a committed script working on machines that cannot
receive the rollout.

## Seam 2 — `ResultsLocator`: where the document lands

Same command.

**Observed.** `--eval-dir` accepted a **path**, not merely a bare directory name,
which was an open question in the plan. Output:

```
evals/seven-steps-primer/results/2026-08-27T14-06-02-737Z/aggregate-result.json
evals/seven-steps-primer/results/2026-08-27T14-06-02-737Z/report.html
```

Parsed: `schemaVersion 1`, `suite.ablation with-without`,
`plugins [('_condition', None, None)]`, case aggregates
`{score: 1, passRate: 1, scoreWithout: 1, passRateWithout: 1, delta: 0}`.

**Resolution.** Newest `<eval-dir>/results/<ISO-timestamp>/aggregate-result.json`.

## Seam 3 — does a copied condition resolve, and does the ablation mean anything?

**The seam I was surest of, which is why it needed running.** The whole design rests
on stripping `disable-model-invocation` so the model can fire the skill from a
natural-language prompt. If it could not, the with-arm and without-arm would be
identical and every delta would read 0.00.

```bash
node scripts/build-conditions.mjs generate     # 11354 bytes, flag stripped
cp -R conditions/treatment _condition
# prompt: "I need to add per-user rate limiting to our notes API. It's a
#          medium-sized structural change and getting the design wrong would be
#          expensive. How should we approach building it?"
… --model sonnet --runs 1
```

**Observed.**

```
Plugin under test: "_condition" (no version)
gate-stop-step0 run 1/1 [with]:    score 1.00
  ✓ gates-mentioned: matched gate
  ✓ skill-fired [with-only, not scored]: Skill called 1x (expected 1..∞)
gate-stop-step0 run 1/1 [without]: score 0.00
  ✗ gates-mentioned: pattern not found in last_message
Δ +1.00
```

The model chose the skill unprompted, with no slash command. The `tool_used: Skill`
grader was auto-demoted to `[with-only, not scored]` exactly as documented.

**One thing the run corrected that reading would not have.** The plugin is named
**`_condition`** — after the directory, not after the SKILL.md `name:` field, which
says `seven-steps-primer`. Since all three conditions are copied to the same path,
they present under the same plugin name. That is desirable (no condition is
identifiable by its name) but any `input_match` on a skill identifier must use the
directory-derived form.

## Seam 4 — case 5's `history_file`

The plan asserted this transcript had to be recorded from a real session and trimmed.
Probed by hand-writing a two-record `.jsonl` with a token planted in it, then asking
the resumed turn to recall the token.

**Observed.** `✓ recalls: matched PROBEWORD7`, score 1.00.

**Resolution.** Hand-authored transcripts resume correctly. Record-and-trim is
unnecessary — a step-0 premise that the run falsified. Minimum record shape: `type`
(`user`|`assistant`), `uuid`, `parentUuid` (null on the first), `message {role,
content}`, `sessionId`, `cwd`, `version`, `userType`, `isSidechain`, `timestamp`;
assistant content is a block list, user content a plain string.

The case also ran **single-arm** automatically — *"a replay case whose history carries
the plugin into both arms"* — confirming it yields capability evidence, not a delta.

---

## The defect that matters most

Stated plainly, because this is the finding most worth handing to someone who does
not already speak the harness's vocabulary.

**What the suite is trying to check.** Did the agent stop without touching the code?

**How it was checking.** By looking at which tools the agent used. No `Edit` calls
and no `Write` calls, therefore nothing was touched.

**Why that fails.** An agent can also change a file by running a shell command —
`sed -i`, or simply `cat > file`. That is a `Bash` call, not an `Edit` or a `Write`.
The check was watching the front door while the back door stood open.

**Demonstrated, not assumed.** A scaffold put a file containing `ALPHA` in the
sandbox. The prompt asked for a shell one-liner to change it to `BETA`, explicitly
forbidding `Edit` and `Write`.

```bash
… --scaffold --allow-tools Bash --ablation none --model sonnet
```

All three graders passed in the same run:

```
✓ file-actually-mutated: matched BETA          ← the file WAS rewritten
✓ no-edit-tool:  Edit called 0x (expected 0..0)
✓ no-write-tool: Write called 0x (expected 0..0)
score 1.00
```

A case built this way would report *"the agent showed restraint"* about a run that
rewrote the file.

**Why the obvious fix is wrong.** Taking shell access away does not help. If the
agent cannot edit anything, then "it did not edit anything" is worthless — it never
could have. The suite is measuring whether the agent *chose* not to, and a choice
requires the ability. So the tools stay granted, and the back door stays open.

**The fix, confirmed by the same run.** Stop asking which tools were used; look at
the file itself afterwards. `{source: file}` reads a file out of the sandbox once
the agent is done, so the check becomes *is this file still what it was* — which
catches the change however it was made. Tool-name graders stay, demoted to a
secondary signal.

## Four smaller defects the runs exposed

- **Grants are required in two places.** A case's `allowed_tools` is *intersected*
  with the operator's `--allow-tools`. Listing tools in the case alone yields
  `not granted (missing --allow-tools grant …)` — and the run proceeds anyway, with
  the absence graders passing vacuously.
- **Case order is lexicographic**, so `control-all-steps` — the diagnostic that must
  never reach a headline — ran **first** and consumed the cost ceiling before any
  scored case. The runner must exclude `tags: [control]` by default.
- **`graders: []` in `case.yaml` is valid** when `graders/*.md` supply them; the merge
  precedes the minimum-one check. Worth recording so nobody "fixes" it.
- **A replay run leaves a `<sessionId>.jsonl` in the case directory.** Now ignored.

## What the harness caught before it cost anything

A load-only pass under `--max-cost-usd 0.0001` produced:

> ⚠ case "step3-markers-in-source": grader "markers-in-source" cannot pass with the
> granted tools: it checks a file the run creates, but no tool the run may use … can
> create one

That is a real design error in the step-3 markers, surfaced at load time for
$0.02. The load-only pass is now the documented smoke check.

---

## Artifacts corrected upstream

| Defect | Owning artifact | Gate |
|---|---|---|
| Transcript must be recorded and trimmed | `0-plan.md` case 5 | 0 re-opens |
| Bash gap stated as hypothesis, not fact | `0-plan.md` known gap | 0 re-opens |
| Tool grant described in one place, needs two | `0-plan.md` trap 1 | 0 re-opens |
| Three open seams | `interfaces.mjs`, `2-interfaces.md` | 2 re-opens |
| Seam markers | `run-evals.mjs`, `merge-results.mjs`, case 5 `case.yaml` | 3 re-opens |
| Twelve unrecorded harness behaviours | `harness-facts.md` #19–30 | — |

`grep -rn 'TODO(seam)' scripts evals` now returns nothing: no unresolved dependency
reaches step 6.

## Not probed — and therefore not claimed

- The `oneliner` and `placebo` conditions were never built, so nothing here says the
  three-condition comparison works end to end.
- The `notesvc` fixture does not exist; every probe used a throwaway file.
- No case ran at `runs: 5`, so the noise floor remains unmeasured.
- Grader self-tests were not written or run.

Each is step-6 work. A seam that did not execute is un-probed, and none of the above
executed.
