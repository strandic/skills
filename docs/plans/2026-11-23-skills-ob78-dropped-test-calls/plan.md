# skills-ob78 — a call a test does not await has its rejection handled

Ticket `skills-ob78` (no siblings folded) · authority: the owner's ruling Q1 (option A) in [decisions.md](decisions.md), 2026-11-23, after a design interview · planned 2026-11-23 (claude-opus-5-5; skill 0.11.0) at base `324197d plan(skills-5w5c): §9 rows for G1-G3, H1, W4-V; …` (origin/main, PR 18 in) · branch `skills-ob78-abort-handled` in `.worktrees/skills-ob78`, cut from `origin/main` after a fetch; PR + squash. skills-1tr4 also edits the end of `band.test.tsx` and the mod's version: it rebases after this PR (orchestrator). Lessons read: none in the tagged `- Lesson (<tag>)` format (`grep -n '^- Lesson (' docs/plans/lessons.md` prints nothing, exit 1). The untagged lessons were read: skills-v2tm containment through links `no: no path followed`; skills-v2tm oracle from the contract's words `matches §4` (O1's expected outcome is the kit's own file-end check, not a value the sketch computes); skills-v2tm mutants per round `matches §7`; skills-bnbu stated wait `no: no wait added`; skills-bnbu probe a docs word `matches §2` (the scan's doc comment, A5); skills-cm2l enumerate every catch `matches §7` (A4: every promise the mod drops); skills-cm2l comments made false `no: no existing comment describes the dropped calls`; skills-cm2l rule the version at the gate `matches §3` (0.3.6, assigned by the orchestrator, confirmed at the gate); skills-lhwh trivial note `no: briefed`; skills-lhwh and skills-4eqz `--base origin/main`, branch from the remote base `matches` the header and §5; skills-4eqz loose matcher `matches §7` (A5, the scan's regex); skills-cb5t decisions check at the plan ending `matches §5`; skills-cb5t run note before the last readings `matches §5`; skills-cb5t check_pr result cell `matches §5`; skills-cb5t bash loops `no: no loop in a gate`; skills-oz54 re-run the enumeration at W0 `matches §5` (A1 re-run at W0 if the base moved); skills-oz54 decide a clean-up from the operation's result `no: no clean-up`; skills-oz54 "pre-existing" quotes a base reading `matches §2` (S2, S3 readings); skills-oz54 decisions line per §9 default `matches §5`; skills-oz54 repo check_pr beside the installed one `matches §5`.

## 1. What (the defect or goal, measured)

`mods/shawarma-companion/tests/band.test.tsx` at the base starts 16 calls with a statement-level `void` (:1269, :2003, :2135, :2140, :2145, :2162, :2948, :3073, :3092, :3112, :3178, :3439, :3595, :3647, :3833, :3873). A held call (a test hook answering with a promise that never settles) is let go by the test kit about 10 s of real time after it starts; it then rejects, and the dropped promise has no handler. The kit fails the file if it is still running then:

```
(fail) the file ran to its end [0.00ms]
  a rejection nothing handled: The operation was aborted.
  no implementation for tool.call
```

Measured (`claude plugin test` on scratch copies, the ticket's 6 s idle test appended at the end):
- full file at the base: `327 pass` / `1 fail` (the two lines above);
- oz54 V17 alone (`void bash($, 'true')`, :3647) at 9cc8494: `2 pass` / `1 fail`, "The operation was aborted.";
- 5w5c V5 alone (`void $.tool.call({… 'hang' …})`, :3873) at the base: `2 pass` / `1 fail`, "no implementation for tool.call";
- the same two with `.catch(err => console.log('CAUGHT', String(err)))` on the dropped call: `CAUGHT AbortError: The operation was aborted.` / `CAUGHT HooksError: no implementation for tool.call`, `2 pass` / `0 fail`.

**At runtime, outside tests: no, with one unexecuted exception.** The rejection is the test's own: the test stands in for the engine as the hook's caller and drops the promise. At runtime the engine is the caller and handles a hook that fails or overruns (Sources). The mod's own code drops two promises, and both end in a handler: `register.tsx:682` `() => void stale($).catch(() => failed($)).catch(() => undefined)`, and `:863` `void openOn($, row.marker)`, where `openOn` (`:745-747`) catches its `update` and maps `$.ui.open`'s rejection to a value. `within()` attaches its handler to `work` as the call starts (`:187`, `:335`). `$.ui.log` returns `void` (Sources). Attack line A4 made each of 17 `$` calls the mod uses reject, and never answer, under the kit with a 12 s tail: `68 pass` / `0 fail` over 34 files, no `a rejection nothing handled` line. The exception: if `$.ui.open` threw synchronously, `openOn` would reject and `:863` would leave it unhandled; the kit cannot raise that, so it is NOT RUN (S5, D2). The evidence is the kit's, not a live engine's.

## 2. The design

The whole change is a patch beside this brief: [sketch/sketch.patch](sketch/sketch.patch) (`mods/shawarma-companion/tests/band.test.tsx`, `scripts/test/mod-tests.test.mjs`; 2 files, 79 insertions, 16 deletions). `EXECUTED (inputs: the Partition rows below; `claude plugin test` on the final sketch → `327 pass` / `0 fail` / `Ran 327 tests across 1 file.` ×2; `node --test scripts/test/mod-tests.test.mjs` → `ℹ tests 2 ℹ pass 2 ℹ fail 0`; `claude plugin validate` → `✔ Validation passed`)`. Copy it as it is; §3 freezes its shapes. Line numbers below are the sketch's.

- **2a** `band.test.tsx:215-220`, after the `bash` helper: a doc comment that says `drop` also hides a rejection during the test (A2b), and `const drop = (work: Promise<unknown>): void => { work.catch(() => undefined) }`.
- **2b** Each of the 16 lines `void X` becomes `drop(X)`, X unchanged (:1271, :2005, :2137, :2142, :2147, :2164, :2950, :3075, :3094, :3114, :3180, :3441, :3597, :3649, :3835, :3875).
- **2c** `band.test.tsx:3886-3897`: a new last block `skills-ob78: …` with test O1 (§4).
- **2c'** O1 holds no `expect`: its oracle is the kit's file-end check, named in a comment (A2 flag: the first sketch's `expect(true).toBe(true)` was a tautology).
- **2d** `scripts/test/mod-tests.test.mjs` (new): lists `mods/<mod>/tests/*.test.ts(x)`, a linked mod folder followed (`stat`, not `readdir`'s `isDirectory`: A5); test "the mods have test files to read" (at least one); test "no line of a mod test starts with void …" collects every line matching `/^\s*void\b/` (A5: `\s` missed `void(x)` and a lone `void`) as `path:line: text` and asserts the list is empty. Its header states the rule as lines, not code: a `void` at a line's start inside a string or comment fails too, and other ways to leave a call unawaited are not seen (A1, D1).

Why the check is a node test, not a kit test: a kit test cannot read a source file. `import text from './band2.test.tsx' with { type: 'text' }` reads `Missing 'default' export`; a `.txt` reads `is not named like code and was not loaded` (executed, scratch copy of the mod).

Rejected options: a permanent 10 s idle test at the file's end (Q1 B); releasing every held call at its test's end (Q1 C).

**Sources** (plan step 1):

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §1 the kit lets a held call go after ten seconds of real time | `plugin-authoring/types/claude-code.d.ts:21584-21586@2.1.330` | "A held wait resolves when an advance crosses the time it is due, and is dropped when its dispatch aborts; one held past a hook's budget (ten seconds of real time) is let go, as a hook that overran." | paraphrased: the sentence is about a held `$.clock` wait; the call held here is a test hook awaiting a never-settling promise, which overruns its own budget (next row). The ten-second figure is the kit's budget; the delay itself was not timed. |
| §1 the engine handles an overrunning hook | `plugin-authoring/reference.md:256@2.1.330` | "A hook runs inside one dispatch with a budget of its own time (a `next` or `$` call in flight does not count …), and `next.signal` aborts" | verified |
| §1 `$.ui.log` cannot reject | `plugin-authoring/types/claude-code.d.ts:2842@2.1.330` | `log: (text: string, options?: UiLogOptions) => void;` | verified |

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| dropped call held past the test's end, no handler (:3597, :3649, :3875) | a test with a `never()` hold | V17 alone at 9cc8494; V5 alone at the base; with `.catch` | fail → `0 fail` |
| dropped call with a success handler only (`.then(f)`, 8 sites) | a test | full suite + 12 s tail, sketch | `327 pass` / `0 fail` |
| dropped call already handling both (`.then(f, g)`, 4 sites) | a test | same run | unchanged, pass |
| a promise rejecting at once, and one rejecting in a chained `then`, given to `drop` | O1 | sketch | O1 pass, `0 fail`; mutant `drop` without catch: `(fail) the file ran to its end … rejected after drop` |
| the whole file, 12 s idle tail | the ticket's probe | base / sketch / nearest wrong fix | `327 pass` / `1 fail` (aborted) / `327 pass` / `0 fail` / `327 pass` / `0 fail` |
| the scan over the test file | `node --test` | base / sketch / nearest wrong fix | `fail 1` (16 lines listed) / `pass 2`, `fail 0` / `fail 1` |
| other forms of dropping a call (bare call, `;`-joined `void`, `.then(f)` statement, array, unawaited `Promise.all`) | a future test | A1 | each fails under the kit; the scan misses all five (D1); `drop(X)` clears each |
| a rejection during the test, given to `drop` | a mod hook defect | A2b | hidden (`2 pass` / `0 fail`; with `void`: `1 fail`, the file-end line) — S1 |
| the mod's `tool.call` hook throwing | a mod defect | A2 | the engine absorbs it, the call resolves: base `69 pass` / `257 fail`, sketch `70` / `257`, same failing tests |
| the scan over a hostile corpus, final regex | — | A5 + planner re-run | flagged: `void(paren)`, a lone `void`, CRLF, a `.test.ts`, a linked mod; not flagged: `voidable()`, `a(); void b()`, `tests/helper.ts` |
| the mod's 17 `$` calls rejecting, and never answering, with the 12 s tail | the engine | A4 | `68 pass` / `0 fail` over 34 files, no file-end line |

The nearest wrong fix is `.catch(() => undefined)` on the three sites with no handler only (:3595, :3647, :3873).

**Attack readings** (one per §7 line; `reports/attack/report.md`):

- A1 → the kit fails all seven dropping forms; the scan flags two (`void` at a line's start, spaces or tab). Changed the scan's header to say what it checks (2d); D1.
- A2 → the engine absorbs a throwing hook, so this line could not see the weakening; A2b (a promise rejecting during the test) shows `drop` hides it: S1, stated in `drop`'s doc (2a).
- A3 → the sketch with the 12 s tail at the end (×3), after the oz54 block and after the 5w5c block: `328 pass` / `0 fail` each; base with the tail: `327 pass` / `1 fail`, "The operation was aborted.". Holds; R3.
- A4 → no unhandled rejection from the mod under the kit; the synchronous `$.ui.open` throw at `:863` NOT RUN (the kit cannot raise it): S5, D2. Side reading: `fs.exists` at `:551` and `:729` has no 2 s bound: S6, D3.
- A5 → the first regex missed `void(x)`, a lone `void` and a linked mod folder; flagged `void` inside strings and comments. Changed 2d (regex `\b`, `stat`) and stated the line rule; planner re-run on the final scan above.
- A6 → rows 2 and 3 verified; row 1 paraphrased (reworded above).
- Flags → O1's `expect(true).toBe(true)` removed (2c'); the `drop` doc, the scan header, `modTests` doc and O1's names reworded to what each does.

**What the planner saw:**

- S1 Four dropped calls have no assertion on their result: :2147 `drop(turnEnd($))`, :3597 and :3649 `drop(bash($, 'true'))`, :3875 the never-ending call. If the mod's hook rejected there during the test, the kit's file-end check used to report it; with `drop` it does not. The other 12 tests assert the call's result or timing. Accepted with Q1 (error direction "too much handled"); A2 measures it.
- S2 The suite has a pre-existing flake: `skills-5w5c … V5` failed 1 in 5 base runs (`325 pass` / `1 fail`, `Received: []`) and 1 in 4 sketch runs; another run at the base failed `skills-5w5c … V1` once. An open ticket covers an unnamed suite flake ("one unnamed test failure in 22 suite runs at skills-cm2l head"). R1's settle clause re-reads.
- S3 `node --test scripts/test/*.test.mjs` fails on the base and the sketch alike: `every marketplace entry names a plugin.json with the same name and version` (`actual: ['shawarma-companion', '0.3.5']`, `expected: … '0.2.0'`), and once the timing test `cost: classifying four times …`. Base `tests 678 · pass 675 · fail 1 · skipped 2`; sketch `tests 680 · pass 677 · fail 1 · skipped 2`. Not this change's; R2 reads the new file alone.
- S5 `register.tsx:863` `void openOn(…)`: a synchronous throw from `$.ui.open` would reject `openOn` with nothing to handle it, at runtime too. NOT RUN: the kit cannot make `$.ui.open` throw synchronously. Pre-existing (same line on the base); not in this tests-only change: D2.
- S6 `fs.exists` at `register.tsx:551` and `:729` is not raced against the 2 s bound the other calls use; one that never answers holds the hook until the engine's budget (A4 side reading). Pre-existing: D3.
- S4 The ticket blames the skills-oz54 V-tests alone. The skills-5w5c V5 test is a second source with a different message; both are fixed here.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `mods/shawarma-companion/tests/band.test.tsx` | implementer | 2a, 2b, 2c, as in the patch. No other line changes. |
| `scripts/test/mod-tests.test.mjs` | implementer | 2d, new, as in the patch |
| `mods/shawarma-companion/CHANGELOG.md`, `.claude-plugin/plugin.json` | orchestrator at run time | 0.3.6 (assigned by the orchestrator; confirmed at the gate against origin/main); a Fixed entry: tests only, no change to the mod's behaviour |

Error surface: no hook or engine call changes (the diff touches only `tests/band.test.tsx` and `scripts/test/`; A2, A4); `drop` is used only in tests.

## 4. Tests

Synthetic data only. Kit: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test mods/shawarma-companion`. Node: `node --test scripts/test/mod-tests.test.mjs`.

- **T1** *red* — `scripts/test/mod-tests.test.mjs` "no line of a mod test starts with void …". Base test file: `fail 1`, `actual` lists the 16 lines (`mods/shawarma-companion/tests/band.test.tsx:1269: void bash($, 'true').then((r: unknown) => { out = r })` … `:3873: void $.tool.call({ tool: 'Bash', command: 'hang', agentId: 'a1' } as any)`), `expected: []`.
- **T2** *guard* — same file, "the mods have test files to read": green before and after.
- **O1** *guard* — `band.test.tsx`, block `skills-ob78: drop handles the rejection of a promise a test does not await`: `drop` given a promise that rejects at once and one that rejects in a chained `then`; the file ends with no `a rejection nothing handled` line. Green on the sketch; on the mutant `drop = (work) => { void work }`: `327 pass` / `1 fail`, `(fail) the file ran to its end … a rejection nothing handled: skills-ob78 O1: rejected after drop` (O1's own row reads `(pass)`: the file-end line is its oracle). It cannot be red on the tests commit's base code in a way the base produces, as `drop` is new: it is a guard.

**Existing tests that change** (plan step 2):

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|
| the 16 tests holding the 2b lines | none breaks; the line is rewritten | same assertions | final sketch suite `327 pass` / `0 fail` ×2 |

Predicted red set on the tests commit (the tests commit holds the whole patch, as no mod code changes; the red reading is T1 against the base test file, pasted above): **T1**; T2, O1 and the kit suite green.

## 5. Accept gate

- suite, lint and review per run steps 3–4; lint is `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin validate mods/shawarma-companion` (no hook file changes; read once).
- live-data run: none — the change is in tests; the runtime answer (§1) rests on A4.
- rules:
  - **R1** mod suite: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test mods/shawarma-companion`, reading the `N pass`, `M fail` and `Ran N tests` lines, `<graded>/<expected>` = ran / 327. Dataset: the synthetic tests of `tests/band.test.tsx`, read in aggregate; O1 and the 16 rewritten tests bind. Settle: read once on the final commit; when it reads a failure outside the skills-ob78 block, read twice more and paste all three: PASS needs two of three with `failed: 0` (S2). PASS: `failed: 0` (the `0 fail` line) and ran ≥ 327. Dry-run reading with the fix patched in (`.worktrees/ob78-spike`): `327 pass` / `0 fail` / `Ran 327 tests across 1 file.` ×2. FAIL reading on the nearest wrong fix (`drop` without its catch): `327 pass` / `1 fail` / `Ran 328 tests` (the file-end line counts as a test). Cannot run: a missing folder reads `claude plugin test: /nonexistent-dir: no such plugin folder`, no `pass` line — which differs from PASS.
  - **R2** scan: `node --test scripts/test/mod-tests.test.mjs`, reading the `ℹ tests`, `ℹ pass` and `ℹ fail` lines, `<graded>/<expected>` = tests / 2. Dataset: every `mods/*/tests/*.test.ts(x)` file in the tree, read case by case. Settle: once on the final commit. PASS: `fail 0` and `tests 2`. Dry-run reading (final sketch): `ℹ tests 2 ℹ pass 2 ℹ fail 0`. FAIL reading on the base test file: `ℹ tests 2 ℹ pass 1 ℹ fail 1`, 16 lines listed; on the nearest wrong fix (catch on the 3 handler-less sites only): `ℹ pass 1 ℹ fail 1`. Cannot run: the file missing reads `Could not find 'scripts/test/mod-tests.test.mjs'` (executed on the base) and no `ℹ tests` line — which differs from PASS.
  - **R3** the ticket's reproduction: the R1 command on a scratch copy of the final mod with the 12 s idle test appended (text in §7 A3), reading `M fail` and any `a rejection nothing handled` line, `<graded>/<expected>` = ran / 328. Dataset: the whole file plus the tail. Settle as R1. PASS: `0 fail`, no such line, ran ≥ 328. Dry-run reading (final sketch + tail): `328 pass` / `0 fail` / `Ran 328 tests across 1 file.`. FAIL reading on the base + tail: `327 pass` / `1 fail` / `Ran 328 tests`, `a rejection nothing handled: The operation was aborted.`. The nearest wrong fix (3 sites, first sketch's file) also reads PASS here (`327 pass` / `0 fail`): R2 binds it. Cannot run: as R1.
- orchestrator follow-ups: set 0.3.6 and the changelog (§3); `check_pr.py` with `--base origin/main` (repo copy beside the installed one); tell skills-1tr4 that a call its tests leave running goes through `drop(…)`, and R2 fails on a statement-level `void`.

## 6. Worst impact

A promise rejecting during one of the four tests in S1 goes unreported by the kit's file-end check, so a defect there could pass the suite (A2b measured it; a throwing hook does not reach that path, A2). Nothing changes at runtime: no hook file changes. ⇒ the code-review lane, with A2 and A4 as the executed stand-in for the adversarial lane.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines: A4's synchronous `$.ui.open` throw (S5), a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests A1, A4, A5, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (plan time; `reports/attack/report.md`):

- A1 enumerate: the ways a test starts a call and does not await it — `void X` at line start (spaces; tab), `void X` after `;`, a bare call statement, `X.then(f)` as a statement, a promise in an array never awaited, an unawaited `Promise.all`, `drop(X)` as the control — each with a held call and the 12 s tail → oracle the kit's `the file ran to its end` line, beside the scan's verdict
- A2 the mod's `tool.call` hook made to throw at its first line, base and sketch → oracle the two per-test pass/fail lists, diffed
- A3 the sketch suite with the 12 s tail at the end (×3), after the oz54 block, after the 5w5c block → oracle the kit's file-end line
- A4 enumerate: every promise `register.tsx` and `model.ts` create and do not await or return → oracle a kit probe making each underlying `$` call reject, and never answer, with the 12 s tail: no `a rejection nothing handled` line
- A5 enumerate: the scan over `void` in a template literal or block comment at line start, `  void(x)`, `\tvoid x`, CRLF endings, a `.test.ts` file, a mod with no `tests` folder, a non-test file under `tests/` → oracle hand-written verdicts from the contract "a line of a `mods/*/tests/*.test.ts(x)` file whose first non-whitespace token is `void` fails; nothing else does"
- A6 re-read the Sources rows → oracle the d.ts and reference.md text

Mutants for 3b (each patched into the sketch; outputs in the planner's scratch `run-<name>.txt`):

- `mutant: band.test.tsx:216 drop = (work) => { void work } → O1 file-end line red, R1 327/1 (mutant-nocatch)`
- `mutant: mod-tests.test.mjs regex /^void\b/ (no leading whitespace) → T1 green on the base test file (every base site is indented): caught by T1's base reading`
- `mutant: mod-tests.test.mjs regex /^\s*void\s/ (the first sketch's) → misses void(x) and a lone void: caught by the hostile corpus only (A5), not by a §4 test`
- `mutant: band.test.tsx one drop( site reverted to void → T1 red (scan-wrong)`

## 8. Out of scope

- The suite flake (S2): the open flake ticket. The marketplace version test (S3): not this change's.
- The mod's code: no hook changes; the runtime answer is §1 and A4.
- skills-1tr4 appends tests at the end of `band.test.tsx`: it rebases after this PR, keeping both blocks. Out-of-diff review findings: ticket, unless they make a §3 line or a rule false.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
| W3-R1 | 2026-11-23 | the owner ("Go with reco") | §1, §3 (`scripts/test/mod-tests.test.mjs`, CHANGELOG) | §1 "let go by the test kit about 10 s of real time after it starts" → about 5 s, measured by the review lane: a dropped call's rejection handler logged 5057 ms and 5479 ms in the full file and 5008 ms in a one-test file, against `Date.now()` checked with the kit's own timer. The scan header says "about 5 s"; the 0.3.6 changelog says "about five seconds" and "the test file, if still running" (was "any test file still running": two files run in parallel read `3 pass` / `0 fail` with the idle wait in the other file). The scan finds the repository with `fileURLToPath` (was `URL.pathname`, which reads `ENOENT … sp%20ace/mods` in a checkout path holding a space); new regression test `scripts/test/mod-tests-root.test.mjs`, `fail 1` on the pre-fix scan, `pass 1` after. R1–R3 unchanged. | The review lane found the timing and the "any file" wording false by execution, and the path read broken in a folder whose name holds a space. |


## Defaults at this stop

> **What this is about:** the new check catches a dropped call only when it is written as `void` at the start of a line. A bare call, `x; void y` on one line, a `.then(f)` statement, a promise kept in an array, or an unawaited `Promise.all` all fail under the kit the same way but pass the check (A1). No line in today's tests uses those forms. A: keep the line check and say in its header what it does not see (executed: A1 table; the scan header in 2d). B: no static check, rely on `drop` and review alone (executed: the base's 16 sites came in through review). Recommend A. Residue: the header sentence.

> **What this is about:** in the mod's own code, the row button calls `openOn` without waiting for it. `openOn` handles every failure the kit can make, but if `$.ui.open` threw before returning a promise, the failure would go unhandled at runtime too. The kit cannot make it throw that way, so this is unexecuted (S5). It is the same on the base. A: a new ticket, not folded, keeping this change tests-only (unexecuted). B: fold a `.catch` onto `register.tsx:863` here (unexecuted; makes this a mod change). Recommend A. Residue: the new ticket.

> **What this is about:** `fs.exists` at `register.tsx:551` and `:729` is the one engine call the mod does not give up on after 2 s; one that never answers holds the hook until the engine's own budget (A4 side reading, pre-existing). A: a new ticket (executed: the A4 probe reached `fs.exists` and the hook waited for the kit to let it go). B: fold it here (unexecuted; a mod change). Recommend A. Residue: the new ticket.

unruled: D1 the scan sees only `void` at a line's start (A1) — default keep, stated in its header
unruled: D2 `void openOn` at `register.tsx:863` and a synchronous `$.ui.open` throw (S5) — default a new ticket, not folded
unruled: D3 `fs.exists` at `register.tsx:551`, `:729` has no 2 s bound (S6) — default a new ticket, not folded
