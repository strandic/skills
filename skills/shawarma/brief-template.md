# <ticket> — <title>

Ticket `<id>` (+ folded siblings and why) · authority: <the ticket's rulings / ADR / evidence> · planned <date> (<model>) at base `<commit subject>` [· refreshed <date>, supersedes `<old path>`] · proposed branch `<name>` in `<worktree path>` (created by `run`), PR + <merge style>. Everything in §3 is **frozen**: whoever needs to change it stops and reports. Commands: see the house rules — not restated here, except in §5. Lessons read: <n> matching since the last retro marker, cited in §2 — or `none`.

## 1. What (the defect or goal, measured)

The evidence, each number with the command or committed document that produced it, `file:line`. Workers cannot open the tracker or your scratch: never cite either as evidence.

## 2. The design

The change, as a code sketch wherever a sketch is shorter than prose. Every sketch is marked `EXECUTED (inputs: …)` — over the rows of its Partition table, no more — or `UNEXECUTED — do not copy (why)`. Rejected options: one line pointing at the ticket's ruling.

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|

**Attack readings** (from the attack lane, one per §7 line): `<line> → <reading>` or `NOT RUN (why)`. A reading that changed a sketch says which lines; a reading that holds names its §4 test.

**What the planner saw** — spike findings that did not stop the plan: the reading, and why it does not contradict a ruling, a gate rule or the contract.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|

Signatures, data shapes, docstring rules. If the change has an error surface: exception → error code → what the caller can do next. A row that points at a sketch line ("2e") makes that line contract text.

## 4. Tests

Numbered and named, file per test, one reason to go red each. Synthetic data only.

- *red* — must fail on the tests commit; the assertion as executed on the base, verbatim from the spike, so a collection error cannot pass for it and a paraphrase cannot weaken it.
- *guard* — green before and after; pins what must not change.

**Existing tests that change** (the spike's patched suite run, new fixtures in place; a flipped expectation is a ruling):

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|

Predicted red set on the tests commit (the pasted sketch-out run plus the §4 reds): **…**; guards green. Anything else is a finding.

## 5. Accept gate

- tests green; full suite and lint green, passed AND skipped compared with the base
- review findings applied, or declined in the PR with a class word
- live-data run: <what, where; orchestrator only; aggregates only>, on the final commit; a script it needs is a lane file, never scratch; readings with no rule are observations, recorded here
- rules, written now — for each: the rule · the command line it runs and the output fields it reads · the dataset and slice that binds, read in aggregate or case by case · its settle clause (when read, how many readings; none = once) · its dry-run reading with the fix patched in (or `DRY-RUN ON STAND-IN`) · the reading where it FAILS on the named data (nearest wrong fix, or the unfixed base) — a rule with no FAIL reading is deleted and the binding test listed here
- orchestrator follow-ups: <re-runs, other tickets>

## 6. Worst impact

One line: the worst a hostile or malformed input or state can do through this change. ⇒ adversarial lane, or the named executed stand-in that replaces it (then the code-review lane runs).

## 7. Lanes

| lane | model | files | done when |
|---|---|---|---|
| 1t tests | Sonnet | <test files> | §4 written from this brief only; red set reported |
| 1i implement | Sonnet | <source files> | §2–3 applied; §4 green; blocked ⇒ stop and report |
| 3a adversarial | Opus | read-only, scratch dir | *(template text: fill the ids, edit nothing else)* the `NOT RUN` lines <ids> · the `enumerate:` rows not pinned as §4 tests <ids> · the hostile corpus; executed, output under `reports/3a/`, each finding with a reproduction |
| 3b code review | Sonnet | read-only, scratch dir | *(template text)* only when 3a does not run: the `mutant:` rows below · invariants and this brief · claims check on prose; output under `reports/3b/` |

Attack lines, one per row, each one input or one verb sequence with the oracle that grades it — the expected reading stays in the planner's notes; a class word ("any", "every", "beyond") is an `enumerate:` row with its source; one line per repeated group the diff touches, its rejecting input named. The plan-time attack lane (Sonnet, output under `reports/0a/`) runs them before the freeze:

- `<attack> → oracle <name>`
- `enumerate: <finite list, source> → oracle <name>`

Mutants for 3b, one per row:

- `mutant: <neutered behaviour> → <tests expected red>`

More than one implementer only with an argued line here: disjoint files and no shared new symbol, key or contract.

## 8. Out of scope (recorded so nobody drifts)

Interacting tickets, deferred work, contracts that do not change. Out-of-diff review findings: ticket, unless <condition>.

## 9. Amendments (append-only after `run`; §1–8 are not edited)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why |
|---|---|---|---|---|---|
