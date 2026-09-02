# Harness facts — sourced

Every claim this plan makes about `claude plugin eval`, with its evidence.

**Why this file exists.** There is no public documentation page for `plugin eval`.
The authoritative text ships *inside the CLI binary*, so a plan that asserts harness
behaviour with no citation is a plan whose foundations a reader cannot check — the
"verdicts without evidence" failure mode, applied to our own design rather than to a
recon report. Anything below marked UNVERIFIED must not be relied on until a run
settles it.

**Pinned version:** `2.1.250`. Re-verified against it by execution. Originally established on
2.1.245; every behavioural claim survived two releases unchanged, and no prose in the
bundled reference changed at all — it is byte-identical across 2.1.245 → 2.1.250
(67,496 chars, md5 `d00cd967…`, `diff` exit 0).

**Markers must dodge minified identifiers.** Two CODE markers broke in 2.1.250 for a
second, unrelated reason: the minifier renamed local variables, so `e.min??1,i=e.max??…`
and `"without"?{...h,pluginDirs:[]` stopped matching although the code is unchanged.
They are now anchored on the stable half only — `.max??Number.POSITIVE_INFINITY`,
`pluginDirs:[]}:`. A CODE marker that includes a single-letter identifier is a marker
that expires at the next build.

**Read this before trusting a failed marker.** In 2.1.246 the reference stopped being an
inline ASCII string in the bundle and became a Bun single-file-executable asset stored as
**UTF-16LE**. `strings` emits only printable ASCII runs, so the entire document went
invisible to the old recipe — 11 of 15 markers "broke" while nothing about them or the
harness had changed. A marker that stops resolving is therefore **not** evidence that a
fact moved; it is first evidence that the *bundling* moved. Check with the decode recipe
below before concluding anything.

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
BIN="$(ls -d ~/.local/share/claude/versions/* | sort -V | tail -1)"

# CODE claims — minified JS, still plain ASCII
strings -n 20 "$BIN" | grep -F '<marker>'

# DOC claims — the reference is UTF-16LE since 2.1.246, so `strings` cannot see it
python3 -c 'import sys; print("FOUND" if sys.argv[2] in
  open(sys.argv[1],"rb").read().decode("utf-16-le",errors="ignore") else "MISSING")' \
  "$BIN" '<marker>'
```

Verified on 2.1.250: **14/14 DOC markers recover** under the decode, having returned
zero hits under `strings`; the five CODE markers recover under `strings`. Pick the newest
version by `sort -V`, not `tail -1` on an unsorted listing — 2.1.247 sorts after 2.1.250
lexically, and the wrong binary is a silently wrong answer.

Note also that `claude` may not execute the newest installed version: 2.1.247 was on
disk while 2.1.250 was what actually ran. Confirm with `--version` rather than `ls`.

Whole-file reconstruction is possible but not worth it: parse the Bun module graph from
the `\n---- Bun! ----\n` trailer and decode. Per-claim verification is what citations
need.

## Claims the design rests on

| # | Claim | Class | Marker |
|---|---|---|---|
| 1 | `scaffold_script` runs `bash <script>` in the empty workspace **before credentials exist**, minimal env, **2-minute hard limit**, no ssh keys or credential helpers; **off unless `--scaffold`**; a failure scores the run 0 | DOC | ``scaffold_script` runs as `bash <script>`` |
| 2 | A plugin path that **is a symlink** is rejected by the ownership check | CODE | `is a symlink (or can be read as a link)` |
| 3 | `files` / `file_exists` see only files **created during the run** — not contents, not pre-existing (including scaffold-created), not merely modified | DOC | `not their contents, and not files that already existed` |
| 4 | `tool_used` `min` defaults to **1**, so `max: 0` alone can never pass; "must not call" is `min: 0, max: 0` | CODE | `.max??Number.POSITIVE_INFINITY` |
| 5 | Only a read-only tool set is granted; `Bash`, `Write`, `Edit`, `WebFetch`, `WebSearch`, `mcp__*` need `--allow-tools` | DOC | `Operator grant for tools beyond the read-only set` |
| 6 | The baseline arm is the same case with **no plugin at all** | DOC | `each case runs twice: with the plugin and without any plugin` |
| 7 | Under `with-without`, `tool_used: Skill` is demoted to a with-only indicator and excluded from the score; under `--ablation none` the same grader **is** scored | DOC | `grader **is** scored there` |
| 8 | `context.history_file` replays a transcript to turn N-1 and evaluates turn N | DOC | `replay a known-good conversation up to turn N-1` |
| 9 | `error` non-null does **not** imply score 0 — a timed-out or turn-capped run is still graded on what it produced; only *setup* failures yield no graders | DOC | `non-null does not imply score 0` |
| 10 | `--threshold` defaults to **1.0**; any case below it exits 1 | DOC | `A case passes when its (with-arm) score >= threshold` |
| 11 | The target must precede `--tag`, `--allow-tools` and `--json` or they consume it | DOC | `or they will consume it` |
| 12 | Limits: `max_turns` 10 (≤200), `timeout_seconds` 300 (≤3600), `runs` 3 (≤50), **64 MiB** child stdout | DOC | `64 MiB of child stdout` |
| 13 | An `llm` grader passes on **at least 2 of 3** judge votes; the judge is a small fast model by default | DOC | `votes PASS on the rubric in at least 2 of 3 votes` |
| 14 | `--max-cost-usd` breach skips remaining cases, marks `partial` / `cost_ceiling`, **exit 2** | DOC | ``with reason `cost_ceiling`, exit 2`` |
| 15 | The command is early access; `CLAUDE_CODE_WALNUT_SPIRE=1` opens it | CODE + RUN | `is currently in early access` |
| 40 | A grader file's **trimmed markdown body fills one frontmatter key** when that key is absent: `criteria` for `llm` and `baseline`, `pattern` for `regex`. There is no comment-stripping step, so an HTML comment in an `llm` body is part of `criteria` | CODE | `llm:"criteria",baseline:"criteria",regex:"pattern"` |
| 41 | `criteria` is interpolated **straight into the judge prompt** — `Criterion:\n${criteria}` — with nothing between the file and the judge. Fencing a design note in `<!-- -->` therefore hides it from nobody | CODE | `You are grading the output of a coding agent against a criterion.` |
| 42 | `input_match` is a **regex over the JSON-encoded tool input**, not a substring test | DOC | ``optional `input_match` (regex over the JSON-encoded tool input)`` |
| 43 | A `regex` grader's `pattern` is a **JavaScript RegExp source in every `match` mode**; `match` (`contains` default, `not_contains`, `count:N`) only chooses how many hits it must produce | DOC | ``The pattern is (or is not) found in the target; `count:N` requires exactly N.`` |

Claim 15 was re-run directly: without the variable the command prints the
early-access line; with it, the same invocation reports `No eval cases found`.

**Claims 40-43 are what the graders in `evals/seven-steps-primer/` now rest on.** 40 and
41 together are why every `llm` grader's body holds nothing but its criteria and every
design note lives in a `<case>/<grader>.notes.md` sibling outside `graders/`: a comment
in the body is shipped to the judge verbatim, so "fence it in a comment" removes nothing
and only makes the prompt longer. 42 is what `no-source-edits.md` and
`no-source-writes.md` assume when they anchor on `"file_path"\s*:\s*"…`. 43 is what
`source-untouched.md` assumes when it declares `match: contains` beside a pattern full of
metacharacters — and it is the claim `graders.test.mjs`'s C39 test pins, after an earlier
version of `patternOf` read `contains` as "the pattern is a literal" and escaped it.

The regex grader's own code confirms 43 and adds one operational detail the timings in
`source-untouched.md` depend on: under **every** match mode the harness first runs
`text.match(new RegExp(pattern, flags + 'g'))` and only then branches on `match`. A
pattern that backtracks badly costs that scan whether or not `contains` would have
short-circuited, which is why both `source-untouched.md` patterns are anchored with `^`
and use non-nesting lookaheads.

## Claims from observation only

Not in the bundled reference. Each was seen in a live run during research; none has
been replicated across sessions, so treat them as strong leads rather than settled.

| # | Claim | Why it matters here |
|---|---|---|
| 16 | **`tool_used: Skill` passes in the no-plugin baseline arm** — it counts *attempted* tool_use blocks with no check that the call resolved | The reason every case grades an output token the skill uniquely produces, never the Skill call |
| 17 | A **bare `SKILL.md` folder with no manifest** is auto-detected as the plugin under test — contradicting the bundled reference, which says a plain skill never is | Lets each condition be a bare skill directory |
| 18 | For a `disable-model-invocation` skill, `/plugin:skill` at **position 0** of the prompt is consumed client-side and leaves no `Skill` tool_use; mid-sentence, it unlocks the real tool | Background to the mirror decision; the suite avoids both by stripping the flag instead |
| 33 | A **second preflight**, distinct from the tool-grant one, warns when a file-reading grader cannot pass because nothing in the run can produce the file | Free early warning that `--scaffold` was forgotten |
| 34 | A `{source: file}` grader whose path is absent is a **hard failure**, not a soft "unavailable" | A wrong path fails loudly instead of scoring 0 quietly — which is what the old `fixtures/notesvc/...` paths would have done |
| 35 | A `scaffold_script` escaping its case dir fails **only when `--scaffold` is passed** — the containment check runs at execution, not at load | A broken scaffold path looks healthy in every run that omits the flag |
| 36 | `--json` no longer consumes a following target the way `--tag` and `--allow-tools` still do | Target-first remains the rule; only the failure mode differs |
| 37 | **2.1.251:** a `plugins` entry may not name the case directory, its graders or mocks, "or a directory covering them — a plugin shipped with a case must sit in its own subdirectory". Fails at RUN time, not load | Broke `_condition/` living inside the eval dir; it now sits at `evals/_conditions/current`, which 2.1.250 also accepts |
| 38 | **2.1.251:** a Bash-granting evaluation refuses to run when `~/.docker` holds a symlink anywhere inside it — "keep the store's contents in one plain directory (its root may be a link)". `DOCKER_CONFIG` does not redirect the check | **Blocks this suite entirely on 2.1.251.** Every case grants Bash, and Docker Desktop installs `cli-plugins/*` as symlinks |
| 39 | **2.1.251:** the bundled reference is no longer readable by decoding the binary — the asset is still named (`plugin-eval-a0f9bd9e.md`) but its text appears in no plain encoding, so it is compressed | All 14 DOC markers stop resolving. Grep-based citation ends at 2.1.250 |

## Why the pin is 2.1.250 and not the newest

`claude` executes **2.1.251**, and three of its changes land on this suite: the plugin
path rule (#37), the Docker refusal (#38) which blocks every case outright, and the
compressed reference (#39) which makes DOC citations unverifiable. 2.1.250 is on disk,
every fact here was established against it by execution, and it runs the suite clean —
verified after the upgrade, not assumed.

So sweeps run with `EVAL_CLAUDE_BIN=~/.local/share/claude/versions/2.1.250`, which is
exactly what that seam was resolved for. The pre-registration pins the same number and I2
voids any run whose report disagrees, so the measurement stays reproducible rather than
drifting with whatever is installed.

**The cost of this choice, stated.** Old versions are eventually collected. When 2.1.250
goes, the suite must either move to a version where #38 is resolved or stop granting Bash
— and it cannot stop granting Bash, because absence graders measure nothing when the run
was incapable of acting.

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
| 31 | `--allow-tools <tools...>` is **variadic** — space-separated values, which is why the target must precede it | `.option("--allow-tools <tools...>", …)` |
| 32 | **`--tag` is an INCLUDE filter**: "a case is kept if any given tag matches". There is no exclude form | `--tag` filtering (a case is kept if any given tag matches) |

**Correction to #14, paid for in a real run.** A cost ceiling does not prevent the
*first* agent run — it stops the ones after it. Combined with #28 (lexicographic order),
a "cheap load-only pass" on this suite runs `control-all-steps` to completion first and
cost **$0.15**, not the $0.02 recorded earlier. Filter to a cheap case rather than
relying on the ceiling.

Claim 22 matters more than it looks: because every condition is copied to the same
`_condition/` path, all three present to the model as the same plugin name. That is
useful — no condition can be identified by its plugin name — but any `input_match`
on a skill identifier has to use the directory-derived name, not the frontmatter one.

Claim 30 is why `evals/*/**/[0-9a-f]*.jsonl` needs ignoring; otherwise every replay
run leaves junk in the case directory.
