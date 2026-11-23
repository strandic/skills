# skills-oz54 — every session call gives up after 2 s

Ticket `skills-oz54` (no siblings folded) · authority: the README contract "Each call to the session or the store gives up after 2 seconds" (`mods/shawarma-companion/README.md:40` at the base), the s6qg ruling Q6 (session id, project root and store calls raced against 2 s), and the owner's rulings Q1, D1 (reversed by Q2), D2, D3, D4, D5, Q2, D6, D7 in [decisions.md](decisions.md), 2026-11-22 · planned 2026-11-22 (claude-opus-5-5; skill 0.11.0) at base `f1ed7f4 beans: close skills-bnbu and skills-6y0d — fixed in shawarma-companion 0.3.1 (PR 12); lessons for skills-bnbu` · proposed branch `fix/oz54-session-bound` in `.worktrees/oz54`, PR + squash, rebased at run time on whatever merged first (PR 13 skills-cm2l; skills-lhwh merges first among the companion streams, D7; the parallel companion streams skills-1tr4 and skills-lhwh share register.tsx, the tests file, the version and the changelog). Lessons read: none in the tagged `- Lesson (<tag>)` format (`grep -n '^- Lesson (' docs/plans/lessons.md` prints nothing, exit 1). The untagged lessons in that file were read: skills-v2tm containment through links `no: the change follows no path`; skills-v2tm oracle from the contract's words `matches §4` (each bound in V1–V10 is a hand count written in the test's comment); skills-v2tm mutants per round `matches §7` (16 mutants on the sketch's own lines); skills-bnbu a stated wait counts every bounded call on the path `matches §2` (the README's numbers were measured with every session call slow at once: attack A7, A7e, A8); skills-bnbu probe a docs word against the values the code still treats the other way `matches §2` (a give-up and a rejection read alike at 39 of 39 sites: attack A3).

## 1. What (the defect or goal, measured)

`mods/shawarma-companion/hooks/register.tsx` at the base awaits ten `$.session` calls with no time limit, only a `.catch`: `cwd` at :219, :396 (twice, the second the fallback of `root`), :649, :706, :719, :737; `root` at :396 and :417; `usage` at :585 and :765. Only `id` (:210) and one `root` (:220) go through `bounded`. The engine does not cut them: a `tool.call` hook may hold its `$` calls 20 minutes, a `ui.render` hook 30 s (§2 Sources).

Measured on the base (the kit's engine clock; commands in §4):

- `session.cwd` never answering: the first Bash call never runs (:706 comes before `next(e)`): V1, held past the test's 60 s cap.
- `session.root`, `session.usage` never answering: the call held past 60 s (V2, V3, V6); a band drawing with context on never answers (V4); a turn end never answers (V8).
- The 15 s check with `session.cwd` never answering: a changed marker is not redrawn for 30 s (V5; attack A1: the next tick recovers it).

The README says "Each call to the session or the store gives up after 2 seconds" (:40). That is false for the session half.

## 2. The design

The whole change is a patch beside this brief: [sketch/sketch.patch](sketch/sketch.patch), paths relative to `mods/shawarma-companion/` (`hooks/register.tsx`, `tests/band.test.tsx`, `README.md`; 3 files, 201 insertions, 11 deletions; no version or changelog change, decided at run time). `EXECUTED (inputs: the Partition rows below; `claude plugin test` on the sketch → `297 pass` / `0 fail` / `Ran 297 tests`, three runs; attack lanes A1–A11 and B1–B5, B1 re-run on this sketch)`. Copy it as it is; §3 freezes its shapes. Line numbers below are the sketch's.

- **2a** Every `$.session.cwd()`, `.root()` and `.usage()` call goes through the existing `bounded($, …)` (`within` raced against `RUN_MS` = 2 000 ms on `$.clock.after`, timer cancelled after the race; a rejection or no answer in time throws). Sites: :227 (`claim`), :405 (`discover`, a subagent's root, then its cwd fallback), :406 (`discover`), :427 (`discover`), :595 (`snapshot`), :612 (`readMainCwd`), :725 (the `tool.call` hook, before `next(e)`), :784 (the `ui.render` hook). Each site keeps its own `.catch`: a give-up reads exactly as a rejection (attack A3, 39 of 39 sites).
- **2b** (Q1) The three reads that refresh the known working directory — after a main tool call (:738), at a main turn end (:756), in the 15 s check (`stale`, :667) — call a new `readMainCwd($)` (:611-615): it sets `mainCwd` to the answer, or to `null` on a give-up or a rejection, and sets the new module flag `isCwdLost` (:80) to whether it got none. `refresh` throws right after its discovery while `isCwdLost` is set (:621), so every refresh — a subagent's and the check's included — draws nothing until a later main read answers; `session.start` clears the flag with `mainCwd = e.cwd` (:709). (Attack B1 and B4 d: forgetting alone let a subagent's discovery label the trees by the project root, and a check already running redraw from the trees found before a move.)
- **2c** README :40 (the version and the changelog's Fixed entry are set at run time, after rebasing on whatever merged first: orchestrator rule, Q2 ruling). The README states: each session call gives up after 2 s and counts as failed; a give-up of the working directory forgets it; a session that never answers holds each writing call 2 s before it runs; one update asks the session at most eight things, so it waits at most 16 s for the session, on top of git, files and the store; every 2 s limit relies on the engine's timer.

Rejected options: keep the last known directory on a give-up (Q1 B: wrong "other tree:" label, attack A4); fix only the README (the hang stays, research report §6); remember a give-up until the turn ends (D3 B); draw the row without the context figure (D2 B).

**Sources** (plan step 1; research report `reports/research/report.md`, re-read by the attack lane, `reports/attack/report.md` §A10):

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §1 session calls have no engine limit | `claude-code.d.ts:3339-3352@2.1.330` | "Returns the directory the session runs in, absolute." / `cwd: () => Promise<string>;` / `root: () => Promise<string>;` | verified |
| §1 the engine's limits on `$` calls | `claude-code.d.ts:6728-6734@2.1.330` | "On `tool.list` and `ui.render` a hook's `$` calls hold it for 30 seconds in all, then fail it; … On `tool.call`, `tool.check`, `tool.judge`, `tool.run` and `classic.PreToolUse` for 20 minutes" | verified |
| §1 the tool runs inside `next(e)` | `claude-code.d.ts:4969-4974@2.1.330` | "Each `next(e)` runs the hooks beneath, then core (the permission prompt, the tool itself)." | verified |
| §2 2a the timer | `claude-code.d.ts:4221-4224@2.1.330` | "Calls `fn` once after `ms` milliseconds; `cancel()` before then stops it. One `clock.after` dispatch: `fn` runs when it resolves, and never when a hook refuses it." | verified |
| §2 D2 a render's first answer | `claude-code.d.ts:5054-5061@2.1.330` | "A repaint reuses the answer; a clock invalidates." / "On the terminal a new row is blank until its first answer" | verified (the second quote starts at :5059) |
| §4 the kit clock | `claude-code.d.ts:21581-21586@2.1.330` | "Answers `$.clock` from a clock in memory that moves only when the test moves it" | verified |

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| answers at once | the engine | the suite; V7 | sketch 296 pass; 11 timers asked by a first Bash call, none fired (A9) |
| answers at 1 999 ms | a slow engine | A2 (cwd, root, usage) | equal to the instant run, except the claims entry's time |
| answers at 2 001 ms | a slow engine | A2 | equal to the rejecting run |
| rejects | an engine fault | A3, 39 sites | equal to never answering in band and claims |
| never answers | an engine fault | V1–V6, V8, V9; A1 every site alone | each site settles in 2 000 ms; base held past 60 s (check: 30 s) |
| never answers, two writing calls and a check at once | parallel calls | A5 | 3 800–4 000 ms each, check 2 000–2 200 ms |
| every session and store call never answering | an engine fault | A7 a–c | start 6 000–8 000 ms, Write 10 000 ms, turn end 8 000–10 000 ms, band `[]` |
| a give-up then in-time answers at 1 999 ms | a slow engine | A7e | Write 16 000 ms, 8 session calls |
| the 15 s check, all session calls never | an engine fault | A7d; V5 | 12 000 ms (round 1); V5 redraws at 21 000 ms on the ruled sketch |
| a move to another worktree, then a late cwd | `/cd`, a worktree move | V10; A4; B1 | this sketch: nothing drawn while lost, the right labels at the next main call (V10); round-1 sketch: `other tree:` on the own tree |
| the directory lost, then a subagent event | a subagent | V9; B4 d | this sketch: nothing drawn; forget-only sketch: `[m, other tree: w]` in 12 of 12 rows |
| the directory lost, then a session start | `/clear`, resume | V13 | rows drawn again |
| sequences of 3 (Bash, turn end, check) × cwd (instant, late, never, rejects) × one move | every event | B1, 6 912 runs on this sketch | 0 label differences from the instant control; 5 292 absences; 396 rows wrong against the truth, all equal to the control's (skills-mizx) |
| the 15 s check, cwd never, others at 1 999 ms | an engine fault | B3 | about 16 s, so the next tick starts while it runs (S7) |
| a refused clock timer | another hook | A6 | held past 30 s, sketch and base (README states it) |
| subagent call, root then cwd never | a subagent | V6 | 6 s at most |
| render with context on, usage late 2–30 s | a slow engine | A11 | no row that drawing (D2); base draws it late |

**Attack readings** (one per §7 line):

- A1 → (round-1 sketch line numbers) every reached site settles in 2 000 ms (base held past 60 s; the 15 s check 30 s on the base). :398, :219 and the subagent fallback were run paired with an earlier rejection: 2 000 ms each. Holds; V1–V6, V8, V9.
- A2 → 1 999 ms equal to instant; 2 001 ms equal to reject (cwd, usage); root reaches only :220, bounded on the base too. Holds.
- A3 → band and claim trees equal in 39 of 39 pairs; the claims entry's time differs in 13 (written 2 s later). Holds.
- A4 → the round-1 sketch labelled the session's own tree `other tree:` after a move with a 3 s late cwd. Changed the sketch: 2b (Q1), test V10 (red on the round-1 sketch: `"other tree: w · trivial · since 14:00"` ×3).
- A5 → 3 800–4 000 ms per writing call, the check 2 000–2 200 ms; no unhandled rejection. Holds.
- A6 → held past 30 s on sketch and base. The README states the condition (2c).
- A7 → the README's first numbers were false (Write 16 000 ms, 8 calls; check 12 000 ms, 6 calls). Changed the README (2c).
- A8 → maximum session calls per path: main tool.call 8, subagent 7, turn end 7, check 6 (8 with no known directory), start 4 (6 without `e.cwd`), render 1. The README says eight (2c).
- A9 → 11 / +5 / +7 / +1 timers (first Bash, second, turn end, render); none fired after 10 s. V7 now checks a timer was asked (D5).
- A10 → 47 of 48 quotes verified; one off by a line (Sources above corrected).
- A11 → usage at 2.5 s: base draws the row at 2.6 s, sketch draws none that drawing; the next drawing draws it. Accepted (D2).
- B1 → on the forget-only sketch, 48 rows labelled `other tree: w` against the control (a turn end's give-up during a running check) and B4 d: changed the sketch (2b, the `isCwdLost` flag). Re-run on this sketch: 6 912 runs, 0 label differences, 5 292 absences; every row wrong against the truth equals the control's (pre-existing, skills-mizx). Holds; V5, V9, V10.
- B2 → one rejecting read after a call: the next read in that update answers, rows kept. Every cwd read rejecting: the band empties until the next main call or turn end; base keeps the rows. Accepted under Q1 (S2).
- B3 → hand counts: main tool.call 8, subagent 7, turn end 7, check 8, start 4 (6 without `e.cwd`), render 1; worst measured 16 000 ms with 8 calls. The README's "eight … 16 seconds" holds. A check can run past the next 15 s tick (S7).
- B4 → "never labels … by a folder the session may have left" is false: cases a, b, c mislabel with no failed call (pre-existing: skills-mizx, skills-laqh), and d mislabelled through the forget (fixed by 2b, V9). The README sentence narrowed (2c).
- B5 → after a forget, the next main Bash call or turn end equals the control (567 of 567 each); a subagent event now draws nothing (V9); the 15 s check stays stopped until a main event (the empty refresh stopped it).

**What the planner saw:**

- S1 `session.root` at base :396 and :417 had no limit, although s6qg Q6 ruled the project root raced against 2 s. The sketch conforms (2a).
- S2 A rejected working-directory read after a call, at a turn end or in the check now also forgets the directory, so that update draws nothing where it kept the old rows (Q1 covers a give-up and a rejection alike, 2b); it stays empty until a main call or turn end reads the directory, since the empty refresh stops the 15 s check (B2, B5).
- S3 A give-up of `usage` in a refresh, like its rejection, empties the band and stops the 15 s check until the next hook (`watch(false)`); unchanged from a rejection on the base, and skills-cm2l (PR 13) changes the check's failure path.
- S4 One unnamed failure in 10 runs of the base suite (`285 pass` / `1 fail` / `Ran 286`); none in 8 runs of the sketch. The same flake as skills-4yek (on PR 13's branch); R1's settle clause re-reads.
- S5 The sketch's register.tsx, README and tests apply on PR 13's head `95b016c`: `310 pass` / `0 fail` (round-1 sketch). The version, the changelog and the end of the test file conflict (D1).
- S7 With every session call slow, one 15 s check can take about 16 s, so the next tick starts while it runs (B3). Two checks then run at once; each is bounded, and the band is rewritten by the later one.
- S6 Pre-existing gaps the attack lane found, filed (D4): skills-mizx (the 15 s check reads the new directory but not the current tree), skills-laqh (a subagent call whose root read fails counts the own run as in another worktree), skills-rb3j (existing tests leave a rejection nothing handles).

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `mods/shawarma-companion/hooks/register.tsx` | implementer | 2a, 2b, in the functions `claim`, `discover`, `snapshot`, `refresh`, `stale`, the new `readMainCwd($: EngineInterface): Promise<void>`, the new module flag `isCwdLost: boolean`, and the `session.start`, `tool.call`, `turn.complete` and `ui.render` hooks inside `register`; no other line changes but the `RUN_MS` doc comment. `hooks/model.ts` is not touched. |
| `mods/shawarma-companion/tests/band.test.tsx` | implementer | §4 |
| `mods/shawarma-companion/README.md` | implementer | 2c, as in the patch (the paragraph of :40 only) |
| `mods/shawarma-companion/CHANGELOG.md`, `.claude-plugin/plugin.json` | orchestrator at run time | the next free patch version after rebasing on skills-lhwh (D7); a Fixed entry for this ticket |

Error surface: no new error reaches a caller. Per call: a rejection or no answer in 2 s throws inside `bounded` and the site's `.catch` applies (A3, enumerate) — the cwd before a tool call: null (a relative file path claims nothing); the working directory after a main call, at a main turn end, in the check: forgotten and marked lost, and every refresh draws nothing until a main read answers or a session starts (2b); `discover`'s cwd: the refresh draws nothing; a root: null; `usage` in a refresh: the refresh draws nothing; `usage` in a drawing: that drawing draws nothing. The caller sees only the time held: at most 2 s per session call, when the engine fires the timer (A6).

## 4. Tests

All in `mods/shawarma-companion/tests/band.test.tsx`, block `skills-oz54: every session call gives up after 2 s`. Synthetic engine answers only. Run: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin test mods/shawarma-companion` (the `claude` binary of the personal install).

- **V1** *red* — `session.cwd` never answers: the first Bash call runs at 2 s (pending at 1 999 ms) and answers 4 s after; nothing drawn. Base: `Expected: { before: 0, after: 1 }`, the tool never ran.
- **V2** *red* — `session.root` never answers, the cwd in no listed tree: the call answers by 4 s. Base: held at the 60 s cap.
- **V3** *red* — `session.usage` never answers with a row to draw: answers by 2 s, nothing drawn. Base: held.
- **V4** *red* — context on, `usage` never answers at drawing time: the drawing answers by 2 s with nothing drawn. Base: held.
- **V5** *red* — `session.cwd` stops answering after the first call: the 15 s check draws nothing by 19 s, rows still at 18 999 ms (hand count: the check's cwd, then `claim`'s). Base: held, rows kept.
- **V6** *red* — a subagent Bash call, `root` and `cwd` never answer: answers by 6 s. Base: `Received: { atMost6: false, text: undefined }`.
- **V8** *red* — after a session start, `cwd` never answers: a turn end answers by 4 s, nothing drawn. Base: held.
- **V9** *red* — the directory lost by a rejecting read after a call, then a subagent Bash call: nothing drawn; the next main call draws `w` current. Base: the rows kept. Forget-only sketch: `[m, other tree: w]` after the subagent call.
- **V13** *red* — the directory lost, then a session start: rows drawn again. Base: rows never lost. Mutant with no clear at session start: `lost: [], after: []`.
- **V10** *red* — after a move and a 3 s late cwd: nothing drawn at each of three looks (no `other tree: w`), then the next main call with the cwd answering draws `[w · …, other tree: m · …]`. Base: the right labels after waiting (the ruled behaviour is to draw nothing). Round-1 sketch: `other tree: w` ×3.
- **V7** *guard* — every session call answering: after a Bash call, a drawing with context on and 10 s, a 2 s timer was asked and none fired. Green on the base; red when `within` drops its cancel.
- Guards (green before and after): Q6-5 (id, root and store calls hanging), K9, "row: a failing usage call with context on draws nothing", "tool call: the cwd failing after the call still returns the result".

**Existing tests that change** (plan step 2): none. The suite with the sketch and every new test in: `297 pass` / `0 fail`.

Predicted red set on the tests commit (the final test file on the base modules, pasted): **`287 pass` / `11 fail` / `Ran 298 tests across 1 file.`** — V1, V2, V3, V4, V5, V6, V8, V9, V10, V13, and the kit's `the file ran to its end` (the base's hung calls); V7 and the guards green.

## 5. Accept gate

- suite, lint and review per run steps 3–4; lint is `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin validate mods/shawarma-companion` (sketch: `✔ Validation passed`) and `~/.npm-global/bin/tsc -p <tsconfig>` (tsc 6.0.3) on a copy of the mod's tsconfig outside the repo whose `files` names `plugin-authoring/types/claude-code.d.ts@2.1.330` (sketch: exit 0, no output; a wrong fix `bounded($, $.session.cwd)`: `error TS2345`)
- live-data run: `DRY-RUN ON STAND-IN` — the real engine's session calls cannot be made slow or silent, so the kit's synthetic answers are the stand-in; said in the PR
- rules:
  - **R1** mod suite: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin test mods/shawarma-companion`, reading the `N pass`, `M fail` and `Ran N tests` lines, `<graded>/<expected>` = ran / 297. Dataset: the synthetic tests of `tests/band.test.tsx`, read in aggregate; V1–V10 and V13 bind. Settle: read once on the final commit; when it reads a failure outside the skills-oz54 block, read twice more and paste all three: PASS needs two of three with `failed: 0` and the skills-oz54 block passing in all three (S4). PASS: `failed: 0` (the `0 fail` line) and ran ≥ 297. Dry-run reading with the fix patched in (`.worktrees/oz54-spike`): `297 pass` / `0 fail` / `Ran 297 tests across 1 file.` ×3. FAIL reading on the nearest wrong fix (the directory kept when lost, `mainCwd = read ?? mainCwd`): `296 pass` / `1 fail` (V5); on the base modules: `287 pass` / `11 fail`. Cannot run: a missing folder reads `claude plugin test: /nonexistent-dir: no such plugin folder`, no `pass` line — which differs from PASS.
- orchestrator follow-ups: at run time, rebase on main after PR 14 (skills-lhwh, 0.3.3, adds tests at the end of band.test.tsx: expect a conflict there, keep both blocks) merges (D7), then set the next free version with a changelog entry (Q2); the plugin is reinstalled only by the orchestrator; skills-mizx, skills-laqh, skills-rb3j stay open (D4).

## 6. Worst impact

The band shows a wrong label (a tree marked current or `other tree:` wrongly) after a give-up — closed for a give-up by 2b (V9, V10, B1), with the pre-existing path through the 15 s check left to skills-mizx — or every writing call held 2 s and each update up to 16 s while the session never answers (D3), or a hold with no end when the engine refuses the timer (A6). ⇒ adversarial lane.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines: none in this brief, a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests A3, B1, B4, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (plan time; round 1 `reports/attack/report.md`, round 2 `reports/attack2/report.md`):

- A1 enumerate: every `$.session.` call site of the sketch (`grep -n '\$\.session\.'`), each never answering alone, through each hook that reaches it → oracle engine ms held against 2 000 × the hand-counted session calls on the path, and the base control
- A2 cwd, root, usage answering at 1 999 ms and 2 001 ms → oracle a per-field diff of band texts and the stored claims against the instant run and the rejecting run
- A3 enumerate: each site × (rejects, never answers), 39 pairs → oracle a per-field diff of band texts and stored claims between the two
- A4 a move to another worktree, then a cwd answering at 3 s → oracle the band texts of the same run with instant answers
- A5 two writing calls and the 15 s check at once, cwd never answering → oracle engine ms against hand bounds, and the kit's unhandled-rejection line
- A6 the `clock.after` dispatch refused, cwd never answering → oracle README :40's timer sentence
- A7 every session and store call never answering, or answering at 1 999 ms after a give-up → oracle README :40's numbers
- A8 enumerate: session calls per path (tool.call main and subagent, turn end, check, start, render), counted from the code → oracle README :40's "at most eight"
- A9 the count of `clock.after(2000)` dispatches per hook, every call answering → oracle a hand count of bounded calls, and none fired after 10 s
- A10 re-read of the research report's quotes at the cited d.ts lines → oracle the d.ts text
- A11 a drawing with context on, usage at 2.5 s, 25 s and never → oracle d.ts:5054-5061
- B1 enumerate: sequences up to length 3 of (writing call, turn end, check) × cwd (instant, 3 s late, never, rejects) × one move → oracle the band texts of the same sequence with instant answers
- B2 a rejected cwd after a call, no move → oracle a per-field diff of the band, sketch against base
- B3 the README's "eight things … 16 seconds" on the ruled sketch → oracle a hand count per path and the worst measured hold
- B4 enumerate: ways the known directory goes stale without a give-up (a `/cd` and the check, a subagent call, a session start) → oracle the band texts with instant answers, against README's "never labels the trees by a folder the session may have left"
- B5 after a forget, a writing call with the cwd answering at once → oracle the band texts of the instant run at that step

Mutants for 3b (each patched into the sketch, `claude plugin test` on the final §4 file; outputs in the planner's scratch `m2/<name>.txt`):

- `mutant: :227 without bounded → V5 red (m227)`
- `mutant: :405 root without bounded → V6 red (m405)`
- `mutant: :405 cwd fallback without bounded → V6 red (m405b)`
- `mutant: :406 without bounded → V1, V8 red (m406)`
- `mutant: :427 without bounded → V2 red (m427)`
- `mutant: :595 without bounded → V3 red (m595)`
- `mutant: :612 without bounded → V1, V5, V8, V10 red (m612)`
- `mutant: :725 without bounded → V1, V6 red (m725)`
- `mutant: :784 without bounded → V4 red (m784)`
- `mutant: :612-614 mainCwd = read ?? mainCwd → V5 red (keepOnLost)`
- `mutant: :614 isCwdLost = false → V5, V9 red (readNoLost)`
- `mutant: :621 the isCwdLost throw removed → V5, V9 red (noLostThrow)`
- `mutant: :709 no clear at session start → V13 red (startNoClear)`
- `mutant: within without its timer cancel → K9, V7 red (mcancel)`

## 8. Out of scope

- The 15 s check does not re-read which tree is current after the directory changes: skills-mizx (D4).
- A subagent call whose root read fails counts the own run as in another worktree: skills-laqh (D4).
- The unhandled rejection in existing tests: skills-rb3j (D4).
- A refused clock timer leaves every 2 s bound open: skills-vmhr (bnbu D2); the README states it.
- skills-cm2l (PR 13) changes `refresh`, `stale` and `watch`; skills-1tr4 changes `model.ts` (`rowText`, `clean`); skills-lhwh changes the pane's drawing of decisions.md. This change touches `stale` (one line, :667) and `refresh` (one line, :621) and rebases on whichever merged first. Out-of-diff review findings: ticket, unless they make a §3 line or R1 false.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
| W0 | 2026-11-22 | default | base | `f1ed7f4` → `c3c525d` | `git diff --name-only f1ed7f4 c3c525d -- mods/shawarma-companion` ∩ the sketch and §4 files: `hooks/register.tsx`, `tests/band.test.tsx`, `README.md`. The sketch's register.tsx and README hunks apply with one conflict (the doc comment above `refresh`, changed on main; main's kept), and their +/- lines equal the sketch's (`diff` of the two hunk sets prints nothing); the test block is appended after main's last test unchanged. Reds re-run: base modules with the new tests `304 pass` / `10 fail` / `Ran 314 tests` (V1, V2, V3, V4, V5, V6, V8, V9, V10, V13; the kit's `the file ran to its end` no longer appears on this base); sketch `314 pass` / `0 fail` / `Ran 314 tests`. R1's floor stays `ran ≥ 297`. |
| W3-R1 | 2026-11-22 | the owner | §2 2b, §3 register.tsx, §4 | 2b "every refresh … draws nothing until a later main read answers" (the trees found before a loss kept in `lastTrees`) → a lost read also sets `lastTrees = null`; `stale`, finding no trees while the directory is lost, reads it again and then refreshes from a new discovery. §4 adds V14 (red on `1a6d0cc`: afterCheck `[m, other tree: w]`) and V15 (guard; red on the variant that keeps the band empty until a main event) | On the run base the 15 s check keeps running after a failed refresh (PR 13), so it redrew from the trees found before a move: B1 re-run 270 wrong-label reads in 222 of 6 912 runs. With this fix: 0 label differences that the all-instant run does not also show (396 reads differ, each the truth where the instant run is wrong), 26 064 absences; at most 4 session calls on the check's lost path. Suite `316 pass` / `0 fail` / `Ran 316 tests`. |
| W3-R2 | 2026-11-22 | the owner | §2 2c, §3 README | README :40 "draws nothing until a later tool call or turn end of the main session reads it again, so it does not go on labelling the trees by the folder it last read" → "forgets the one it knew and the worktrees it found from it, and draws nothing until the working directory is read again: at the main session's next tool call or turn end, at the next 15-second check, or when a session starts. It then finds the worktrees again from the folder it reads." The 0.3.4 CHANGELOG entry narrowed the same way | The check alone brought rows back (review 3a P2, review 3b finding 1); the read before a tool call forgets nothing (review 3b finding 2). |
| W3-C1 | 2026-11-22 | default | §2 Attack readings B1, B5; S2; §6 | B1 "0 label differences", B5 "the 15 s check stays stopped until a main event", S2 "since the empty refresh stops the 15 s check", §6 "closed for a give-up by 2b (V9, V10, B1)" → true on the plan base `f1ed7f4` only; on the run base they read as in W3-R1 (closed by W3-R1, V14) | Observations recorded at the plan base; the run base changed the check (PR 13). |
| W3-R3 | 2026-11-22 | the owner | §2 2b, 2c, §3 register.tsx and README, §4 | W3-R1's `if (isCwdLost) lastTrees = null` in `readMainCwd` → removed; `stale` takes the fresh-discovery branch when `lastTrees === null \|\| isCwdLost`, and after its own `readMainCwd` returns `refresh($)` when the read was lost. README :40 "forgets the one it knew and the worktrees it found from it" → "forgets the one it knew". §4 adds V16 (red on `b3e6c4e`: tick1 kept `[m, other tree: w]`) and V17 (red there: the pane read `plan dir outside its tree`) | Fix review round 2: the check's own lost read left rows drawn up to 15 s, and dropping the trees made the pane call an inside plan dir outside for about 2 s. Readings on this fix: sweep 3 500 runs, 196 wrong-label reads unlike the instant run, all equal to the pre-fix code's (skills-9u5j); B1 6 912 runs, 0; at most 5 session calls on the check's lost path. Suite `318 pass` / `0 fail` / `Ran 318 tests`. |
| W3-R4 | 2026-11-22 | the owner | §3 register.tsx and CHANGELOG, §4 | `turn.complete`'s clean-up guard `isMain && lastTrees?.isFromGit === true` → `isMain && !isCwdLost && lastTrees?.isFromGit === true`. CHANGELOG "until it reads it again, … or at a session start" → "until it has the folder again: it reads it at … or takes it from a session start". §4 adds V18 (red on `29f8f15`: the band read `1 run in another worktree`; green on `c3c525d`) | Fix review round 3 G1: W3-R3 C's kept trees let a lost turn end clear the turn's folders before any list. Suite `319 pass` / `0 fail` / `Ran 319 tests`. skills-f7a9 closed: its loss came in with W3-R3 C, not before. |
| W3-R5 | 2026-11-23 | the owner | §3 register.tsx, §4, §5 | `refresh` → returns `isPlaced` (its own `snapshot` finished against a list with `isFromGit`); `turn.complete`'s guard `isMain && !isCwdLost && lastTrees?.isFromGit === true` → `isMain && isPlaced`; `stale`'s `return refresh(...)` → `{ await refresh(...); return }`. §4 adds V19 (red on `3132753`: the band read `1 run in another worktree`). §5 adds skills-k6zu (another session's marker claimed across a lost turn end) | Fix review round 4 F1: the guard read shared state, so a 15 s check that read the directory during a lost turn end let it clear folders its own refresh never placed. Suite `320 pass` / `0 fail` / `Ran 320 tests`. |
