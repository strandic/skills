# Harness facts — sourced

Every claim this plan makes about `claude plugin eval`, with its evidence.

**Why this file exists.** There is no public documentation page for `plugin eval`.
The authoritative text ships *inside the CLI binary*, so a plan that asserts harness
behaviour with no citation is a plan whose foundations a reader cannot check — the
"verdicts without evidence" failure mode, applied to our own design rather than to a
recon report. Anything below marked UNVERIFIED must not be relied on until a run
settles it.

**Version.** All of it is `2.1.245` (git sha `28b7e8c`, built 2026-08-25). Behaviour
and wording both move between releases: re-verify after a `claude update`.

## Evidence classes

| Class | Means |
|---|---|
| **DOC** | The reference bundled in the binary as `references/plugin-eval.md` |
| **CODE** | A string recovered from the shipped implementation |
| **RUN** | Observed in a live execution during this project's research |
| **UNVERIFIED** | Asserted somewhere in the plan, not yet confirmed |

## How to verify any line below

Each claim carries a **marker** — a literal substring of its source. To check one:

```bash
BIN="$(ls -d ~/.local/share/claude/versions/* | tail -1)"
strings -n 100 "$BIN" | grep -F '<marker>'          # DOC claims
strings -n 20  "$BIN" | grep -F '<marker>'          # CODE claims (shorter strings)
```

Tested on this machine: it returns the surrounding paragraph intact, and every
marker in the tables below was checked to resolve against the 2.1.245 binary. A
marker that no longer matches after an upgrade is itself a signal — the wording
moved, so re-read the claim rather than assuming it still holds.

One caveat found while testing: the reference is stored as **concatenated string
chunks**, not one literal, so there is no clean way to reassemble the whole document
from the binary. Per-claim verification works, whole-file reconstruction does not —
which is fine, because citations are checked one at a time.

## Claims the design rests on

| # | Claim | Class | Marker |
|---|---|---|---|
| 1 | `scaffold_script` runs `bash <script>` in the empty workspace **before credentials exist**, minimal env, **2-minute hard limit**, no ssh keys or credential helpers; **off unless `--scaffold`**; a failure scores the run 0 | DOC | ``scaffold_script` runs as `bash <script>`` |
| 2 | A plugin path that **is a symlink** is rejected by the ownership check | CODE | `is a symlink (or can be read as a link)` |
| 3 | `files` / `file_exists` see only files **created during the run** — not contents, not pre-existing (including scaffold-created), not merely modified | DOC | `not their contents, and not files that already existed` |
| 4 | `tool_used` `min` defaults to **1**, so `max: 0` alone can never pass; "must not call" is `min: 0, max: 0` | CODE | `e.min??1,i=e.max??Number.POSITIVE_INFINITY` |
| 5 | Only a read-only tool set is granted; `Bash`, `Write`, `Edit`, `WebFetch`, `WebSearch`, `mcp__*` need `--allow-tools` | DOC | `Operator grant for tools beyond the read-only set` |
| 6 | The baseline arm is the same case with **no plugin at all** | CODE | `"without"?{...h,pluginDirs:[]` |
| 7 | Under `with-without`, `tool_used: Skill` is demoted to a with-only indicator and excluded from the score; under `--ablation none` the same grader **is** scored | DOC | `grader **is** scored there` |
| 8 | `context.history_file` replays a transcript to turn N-1 and evaluates turn N | DOC | `replay a known-good conversation up to turn N-1` |
| 9 | `error` non-null does **not** imply score 0 — a timed-out or turn-capped run is still graded on what it produced; only *setup* failures yield no graders | DOC | `non-null does not imply score 0` |
| 10 | `--threshold` defaults to **1.0**; any case below it exits 1 | DOC | `A case passes when its (with-arm) score >= threshold` |
| 11 | The target must precede `--tag`, `--allow-tools` and `--json` or they consume it | DOC | `or they will consume it` |
| 12 | Limits: `max_turns` 10 (≤200), `timeout_seconds` 300 (≤3600), `runs` 3 (≤50), **64 MiB** child stdout | DOC | `64 MiB of child stdout` |
| 13 | An `llm` grader passes on **at least 2 of 3** judge votes; the judge is a small fast model by default | DOC | `votes PASS on the rubric in at least 2 of 3 votes` |
| 14 | `--max-cost-usd` breach skips remaining cases, marks `partial` / `cost_ceiling`, **exit 2** | DOC | ``with reason `cost_ceiling`, exit 2`` |
| 15 | The command is early access; `CLAUDE_CODE_WALNUT_SPIRE=1` opens it | CODE + RUN | `is currently in early access` |

Claim 15 was re-run directly: without the variable the command prints the
early-access line; with it, the same invocation reports `No eval cases found`.

## Claims from observation only

Not in the bundled reference. Each was seen in a live run during research; none has
been replicated across sessions, so treat them as strong leads rather than settled.

| # | Claim | Why it matters here |
|---|---|---|
| 16 | **`tool_used: Skill` passes in the no-plugin baseline arm** — it counts *attempted* tool_use blocks with no check that the call resolved | The reason every case grades an output token the skill uniquely produces, never the Skill call |
| 17 | A **bare `SKILL.md` folder with no manifest** is auto-detected as the plugin under test — contradicting the bundled reference, which says a plain skill never is | Lets each condition be a bare skill directory |
| 18 | For a `disable-model-invocation` skill, `/plugin:skill` at **position 0** of the prompt is consumed client-side and leaves no `Skill` tool_use; mid-sentence, it unlocks the real tool | Background to the mirror decision; the suite avoids both by stripping the flag instead |

## Settled in step-4 recon

Class **RUN**, observed on this machine against 2.1.245. Commands and observed
mechanisms are in `4-recon.md`; run artifacts under
`evals/seven-steps-primer/results/`.

| # | Claim | Observed |
|---|---|---|
| 19 | `--eval-dir` accepts a **path**, not only a bare directory name | `--eval-dir evals/seven-steps-primer` resolved and ran |
| 20 | Results land at `<eval-dir>/results/<ISO-timestamp>/` — `aggregate-result.json` beside `report.html` | five timestamped directories, one per probe |
| 21 | A copied bare-`SKILL.md` directory resolves as the plugin, and the ownership check passes on a `cp -R` copy | `Plugin under test: "_condition" (no version)` |
| 22 | **The plugin is named after the DIRECTORY, not the SKILL.md `name:` field** | directory `_condition` won over `name: seven-steps-primer` |
| 23 | With the flag stripped, the model invokes the skill from a natural-language prompt — no slash command needed | `Skill called 1x`, Δ +1.00 against the no-plugin arm |
| 24 | A **hand-written** two-record transcript resumes correctly; recording and trimming a real session is unnecessary | the resumed turn recalled a token planted only in the transcript |
| 25 | `tool_used` absence graders are **unsound** when `Bash` is granted | one run scored 1.00 on `Edit called 0x` + `Write called 0x` + a `{source: file}` regex proving the file was rewritten |
| 26 | `{source: file}` reads the workspace file after the run and sees Bash-made mutations | same run — the mitigation works |
| 27 | A case's `allowed_tools` is **intersected** with the operator `--allow-tools` grant; both are required | `not granted (missing --allow-tools grant …)`, run proceeded anyway |
| 28 | Cases run in **lexicographic** order, so a control case sorts ahead of scored ones | `control-all-steps` ran first and consumed the cost ceiling |
| 29 | `graders: []` in `case.yaml` is valid when `graders/*.md` supply them — the merge precedes the minimum-one check | six cases loaded clean |
| 30 | Resuming a `history_file` case writes a `<sessionId>.jsonl` **into the case directory** | stray transcript left beside `history.jsonl` |

Claim 22 matters more than it looks: because every condition is copied to the same
`_condition/` path, all three present to the model as the same plugin name. That is
useful — no condition can be identified by its plugin name — but any `input_match`
on a skill identifier has to use the directory-derived name, not the frontmatter one.

Claim 30 is why `evals/*/**/[0-9a-f]*.jsonl` needs ignoring; otherwise every replay
run leaves junk in the case directory.
