# <ticket> — <title>

Ticket `<id>` (+ folded siblings and why) · authority: <the ticket's rulings / ADR / evidence> · planned <date> (<model>; skill <version>) at base `<commit subject>` [· refreshed <date>, supersedes `<old path>`] · proposed branch `<name>` in `<worktree path>`, PR + <merge style>. Lessons read: <the house rules' listing of lessons since the last retro marker, pasted>, each `matches §<x>` or `no: <why>`.

## 1. What (the defect or goal, measured)

The evidence, `file:line`. Workers cannot open the tracker, your scratch or ignored reports: never cite them.

## 2. The design

The change, as a code sketch wherever shorter than prose. Every sketch is marked `EXECUTED (inputs: …)` — over the rows of its Partition table, no more — or `UNEXECUTED — do not copy (why)`; a whole-file sketch sits beside the brief. Rejected options: one line pointing at the ticket's ruling.

**Sources** (plan step 1) — one row per outside behaviour a brief sentence relies on:

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|

**Attack readings** (one per §7 line): `<line> → <reading>` or `NOT RUN (why)`. A reading that changed a sketch says which lines; a reading that holds names its §4 test.

**What the planner saw** — spike findings that did not stop the plan: the reading, and why it contradicts no ruling, gate rule or contract.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|

Signatures, data shapes, doc-comment rules. If the change has an error surface: exception → error code → what the caller can do next. Label sketch lines (2a, 2b, …); a row that points at a labelled line makes that line contract text.

## 4. Tests

Numbered and named, file per test, one reason to go red each. Synthetic data only.

- *red* — fails on the tests commit; its executed assertion.
- *guard* — green before and after; pins what must not change.

**Existing tests that change** (plan step 2):

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|

Predicted red set on the tests commit (plan step 2's run, pasted): **…**; guards green.

## 5. Accept gate

- suite, lint and review per run steps 3–4
- live-data run: <what, where; read-only, aggregates only — or `DRY-RUN ON STAND-IN` where the house rules allow no access, said in the PR>; readings with no rule are observations, recorded here at plan time and in the PR's Verification at run time
- rules, written now — for each: the rule · the command line it runs, on a tracked script, and the output fields it reads · the dataset and slice that binds, read in aggregate or case by case · its settle clause (when read, how many readings; none = once) · its dry-run reading with the fix patched in (or `DRY-RUN ON STAND-IN`) · its FAIL reading on the named data (spike q3) · the executed reading when its command cannot run (a tool or an input missing, or its guarded step skipped: the rule reads a trace that the step ran), which must differ from its PASS
- orchestrator follow-ups: <re-runs, other tickets>

## 6. Worst impact

One line: the worst a hostile or malformed input or state can do through this change. ⇒ adversarial lane, or the named executed stand-in that replaces it (then the code-review lane runs).

## 7. Lanes

Written from [lanes.md](lanes.md) at plan step 2: the two lane cells with ids filled, the attack lines, the mutants.

## 8. Out of scope

Interacting tickets, deferred work, contracts that do not change. Out-of-diff review findings: ticket, unless <condition>.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
