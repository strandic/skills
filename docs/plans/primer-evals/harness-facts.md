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

## UNVERIFIED — must be settled before the numbers mean anything

| Claim | Where it bites |
|---|---|
| Where the harness writes `aggregate-result.json` when both `--eval-dir` and a path target are in play | `ResultsLocator`, an open seam in step 2 |
| Whether `plugin.json`'s `experimental.evals` accepts a **path** or only a bare directory name | Module placement in `0-plan.md` |
| Whether a checksum sentinel actually catches a `sed -i` mutation the tool-name graders miss | The known gap in the absence graders |
| What a trimmed, method-neutral `history_file` must contain for a resumed session to behave as though steps 0–2 happened | Case 5 |

All four are step-4 recon targets. None is a decision anyone can make from a desk.
