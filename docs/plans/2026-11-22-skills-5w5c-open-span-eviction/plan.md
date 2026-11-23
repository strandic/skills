# skills-5w5c — a running call keeps its span until it ends

Ticket `skills-5w5c` (no siblings folded) · authority: the owner's ruling Q1 (option A) in [decisions.md](decisions.md), 2026-11-22, after a design interview (research `reports/research/report.md`) · planned 2026-11-22 (claude-opus-5-5; skill 0.11.0) at base `1f961fb plan(skills-1tr4): research lane, design interview Q1-Q2 ruled, sketch in progress` · proposed branch `fix/5w5c-open-spans` in `.worktrees/5w5c`, cut from `origin/main` after a fetch, with this plan's `plan(skills-5w5c)` commits cherry-picked; PR + squash. Parallel companion streams skills-oz54 and skills-1tr4 share `register.tsx`, the tests file, the version and the changelog: rebase at run time on whatever merged first. Lessons read: none in the tagged `- Lesson (<tag>)` format (`grep -n '^- Lesson (' docs/plans/lessons.md` prints nothing, exit 1). The untagged lessons in that file were read: skills-v2tm containment through links `no: the change follows no path`; skills-v2tm oracle from the contract's words `matches §4` (V1–V5 expect hand-written row literals; the attack lanes found no value computed by the mod); skills-v2tm mutants per round `matches §7` (5 mutants on the sketch's own lines, each caught); skills-bnbu a stated wait counts every bounded call `no: the change adds no wait`; skills-bnbu probe a docs word `matches §2` (the README's "every" was run against rewrites, back-dated markers and the 50-tree cap, attack2 L5, and dropped); skills-cm2l enumerate every catch `no: the change adds no catch`; skills-cm2l put the comments a change makes false into the sketch `matches §2` (2c, 2d); skills-cm2l rule the version at the gate `matches §3` (no version in the plan); skills-lhwh trivial note shape `no: briefed, not trivial`; skills-lhwh pass `--base` to check_pr `matches §5`; skills-4eqz re-probe an old matcher `no: no matcher reused`; skills-4eqz cut the run branch from the remote base `matches` the header above.

## 1. What (the defect or goal, measured)

`mods/shawarma-companion/hooks/register.tsx` at the base keeps a writing call's time span in two capped lists: `windows` (the last 64 writing calls, :62-63) and `turnWindows` (the current main turn's, cleared at a main turn end, :741-744). The span is created open (`to = Infinity`) before the call runs (:709-711), and closed and re-remembered as the newest when the call ends (:713-717). `claim` reads only those two lists (:243).

A background subagent's call can outlive a main turn end and 64 newer writing calls. Its span is then in neither list. If the 15 s check lists a marker the call writes partway through, `claim` finds no span for it, and `lastSeen` (:250) records the marker as seen. When the call ends and its span comes back, the marker is no longer new, so it is never claimed. The session's own run reads `1 run in another worktree` for the rest of the session.

Measured on the base (test V1, §4): `Expected: { during: ["main-1 · trivial", "other tree: wt-7 · trivial"], after: [same] }`, `Received: { during: ["main-1 · trivial", "1 run in another worktree"], after: [same] }`.

## 2. The design

The whole change is a patch beside this brief: [sketch/sketch.patch](sketch/sketch.patch), paths relative to `mods/shawarma-companion/` (`hooks/register.tsx`, `tests/band.test.tsx`, `README.md`; 3 files, 145 insertions, 2 deletions; no version or changelog change, decided at run time). `EXECUTED (inputs: the Partition rows below; `claude plugin test` on the sketch → `308 pass` / `0 fail` / `Ran 308 tests across 1 file.`, four runs; attack lanes K1–K7 and L1–L6)`. Copy it as it is; §3 freezes its shapes. Line numbers below are the sketch's.

- **2a** A module `Set`, `openWindows` (:64-72), holds the span of each writing call the engine has not ended or abandoned. The `tool.call` hook adds the span right after remembering it in the two lists (:752). Nothing evicts from this set.
- **2b** A per-call `release()` (:753) deletes the span from `openWindows`. It runs (i) as the first statement of the call's `.finally`, before `await $.clock.now()` (:759), and (ii) when `next.signal` aborts: at once if it is already aborted, else through a one-time `abort` listener (:754-755). `windows` and `turnWindows` are unchanged.
- **2c** `claim` reads `[...windows, ...turnWindows, ...openWindows]` (:251).
- **2d** README, claim rules (:36): two sentences after "A marker another session writes at that same moment is claimed too.": "A call counts until the engine ends or abandons it, however long it runs, so a long subagent call claims a new marker it writes partway through. A call that never ends keeps counting: until then, a new marker another session adds in a scanned worktree is claimed too."

Rejected options: an age limit on open spans (Q1 B: brings V1 back past the limit); no code change (Q1 C).

**Sources** (plan step 1; research `reports/research/report.md`, re-read by both attack lanes):

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §2 2b an interrupted call settles | `claude-code.d.ts:5892-5893@2.1.330` | "The outermost hooking mod's host hears it before that mod's `next(e)` on an interrupted call settles" | verified |
| §2 2b `next.signal` | `claude-code.d.ts:8349-8355@2.1.330` | "Aborts when the call this dispatch belongs to is abandoned: the user interrupted, a hook above settled first, or this hook ran out of budget." / `readonly signal: AbortSignal;` | verified; present on `tool.call`'s `next` (`Events`, :6390) |
| §1 a background call outlives the main turn | `claude-code.d.ts:159-161@2.1.330` | "an agent or a command already in the background runs on and reports as it would." | verified |
| §1 `agentId` marks a subagent's call | `claude-code.d.ts:396-405@2.1.330` | "The id of the loop this call runs in: for a subagent or a teammate, the `id` `$.agent.list()` gives it; absent on the main loop." | verified |
| §6 no engine bound on how long `next(e)` stays pending | `claude-code.d.ts:6730-6733@2.1.330` | "for 20 minutes, a stream's reads included, not counted while `next(e)` … is in flight" | verified |
| §4 a hot reload starts empty | `reference.md:122@2.1.330` | "`register` runs again in a fresh environment" | verified |

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| call resolves normally | the engine | K1 normal; suite | released; head 13/13 K1 rows, base 1/13 |
| call resolves with `isError` (interrupt shape) or `{deny}` | the engine | K1 | same as normal |
| call rejects | a hook beneath | K1 reject | same as normal |
| the end-time clock read rejects or never answers | a clock fault | V4; K1b | released from the set (V4); the span stays open in `windows`/`turnWindows`, base = head (S2) |
| a hook above answers first, the call beneath never ends | another plugin | V3; K7c, K7c2; L1 A | released on the abort; base = head |
| the signal already aborted when the listener is added | another plugin, slow cwd read | L2 | released; mutant without the check claims |
| two long calls, one ends | parallel subagents | V2 | the other's span stays |
| a call that never ends | an engine or tool fault | V5; O1 | over-claim for the session (Q1 accepted) |
| a main-loop long call | the main loop | K3 | claimed after a main turn end + 64 subagent writes; base not |
| `/clear` mid-call | the user | K2 | the tree lands under the new session id; another session's marker after the call ended is not claimed |
| `session.start` mid-call | a resume | K5 | claimed; base not |
| a non-writer tool (Read, Glob) | the model | K7b | claims nothing, base = head |
| sequences of length 3 from S over {E, T, W, C, O} plus a trailing C or O | every event | K4, 108 runs | head 108/108 against the contract; base 104 |
| the same with an abandon unit A | another plugin | K4a, 147 runs | head 127, base 123; the 20 misses are S1, base and head alike |
| many open calls × many markers | parallel subagents | cost: n = 0…400 × m = 1, 200; K6 n = 800 | head = base within noise (n = 400, m = 200: 13.55+1.14 s vs 13.63+1.12 s user+sys; 374 vs 370 MB) |
| many calls ending normally (listeners left) | the model | L4, 2 000 and 10 000 writes | head = base within noise; set size 0 |
| a hot reload mid-call | a settings change | NOT RUN (the kit has no reload; a reload starts with an empty set, so it can only under-claim, as on the base) | — |
| a user interrupt | the user | NOT RUN (not expressible in the kit: `$.turn.abort` absent on the test `$`); its result shape is K1's `isError` row | — |

**Attack readings** (one per §7 line):

- K1 → every ending releases the span; head passes the during-call reading only head can pass. Holds; V1, V4.
- K1b → the end-time clock fault leaves the span open in the capped lists, base = head (S2). Changed the doc comment (2a) to say "from this set".
- K2 → holds; not pinned (equal to base without an eviction).
- K3 → holds.
- K4 → 108/108; base differs only on STWC, STWO, SWTC, SWTO. Holds; V1.
- K5 → `session.start` mid-call holds; hot reload NOT RUN.
- K6 → no measurable cost. Holds.
- K7 → K7a (the same event twice) and K7b (a long non-writer call) hold.
- K7c → found F1 (a hook above answers first: span kept open). Changed the sketch: 2b (ii), test V3 (red on the round-1 sketch: `other tree: other-1`).
- L1 → no under-claim against the contract; a tool still running beneath an abandoned call that writes after a main turn end and 64 writes is not claimed, as on the base (D2).
- L2 → holds; the already-aborted check is live (mutant claims).
- L3 → K1, K4 unchanged; K7c, K7c2 now pass.
- L4 → no cost; set size 0.
- L5 → the README's first wording ("every marker", "the marker it writes", "keeps counting") was false for rewrites, back-dated markers, the 50-tree cap and an abandoned call. Changed 2d.
- L6 → verified.

**What the planner saw:**

- S1 A call the engine abandoned keeps its span open (`to = Infinity`) in `windows` and `turnWindows` until a main turn end and 64 writes, so another session's new marker in that time is claimed (attack2 F1, K4a: 20 misses, base and head alike). The same holds when the end-time clock read fails (attack F2, K1b). Pre-existing; this change removes the span from `openWindows` in both cases and adds nothing there. A new ticket is proposed (D3).
- S2 One unnamed failure in five runs of the sketch suite (`Q6-4 store.set answers out of order`, `307 pass` / `1 fail`), outside this change; the same test failed once in attack2's run of a different sketch. R1's settle clause re-reads.
- S3 The kit cannot raise a user interrupt or a hot reload (§2 Partition, NOT RUN rows).

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `mods/shawarma-companion/hooks/register.tsx` | implementer | 2a, 2b, 2c: the new module `openWindows: Set<{ from: number; to: number }>` with its doc comment; in `claim`, the one `spans` line; in the `tool.call` hook inside `register`, the add, `release`, the signal lines and the first statement of the `.finally` with its comment. No other line changes. |
| `mods/shawarma-companion/tests/band.test.tsx` | implementer | §4, a new block at the end of the file |
| `mods/shawarma-companion/README.md` | implementer | 2d, as in the patch (the claim-rules bullet of :36 only) |
| `mods/shawarma-companion/CHANGELOG.md`, `.claude-plugin/plugin.json` | orchestrator at run time | the next free patch version after main at merge time; a Fixed entry for this ticket stating the limit (Q1): a call that never ends keeps claiming other sessions' new markers (V5, K1) |

Error surface: none (K1, K6). No new call can reject or wait: `Set.add`, `Set.delete` and `addEventListener` are synchronous. The only behaviour a caller can see is which trees are claimed.

## 4. Tests

All in `mods/shawarma-companion/tests/band.test.tsx`, block `skills-5w5c: a running call keeps its span until it ends`. Synthetic engine answers only. Run: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test mods/shawarma-companion` (the shell's `claude` is a function that refuses; use the binary).

- **V1** *red* — a long subagent call; a main turn end and 64 writes; a marker the call writes mid-call; the 15 s check lists it: `other tree: wt-7` during and after. Base: `during: ["main-1 · trivial", "1 run in another worktree"]`, `after` the same.
- **V2** *red* — two long subagent calls; after the eviction the first ends; the second's mid-call marker is claimed. Base: `["main-1 · trivial", "1 run in another worktree"]`.
- **V5** *red* — accepted (Q1): a subagent call that never ends, past a turn end and 64 writes: another session's marker is claimed (`other tree: other-1`). Base: `1 run in another worktree`.
- **V3** *guard* — a hook above answers a long call first (`answered above`) while the call beneath never ends; after the eviction another session's marker is not claimed. Green on the base; red on the sketch without 2b (ii) (`other tree: other-1`).
- **V4** *guard* — a long call whose end-time `clock.now` rejects; after the eviction another session's marker is not claimed. Green on the base; red when the release follows the clock read or is missing.
- Guards (green before and after): Q7-1 (N1, a marker written at the end of a long call is claimed).

**Existing tests that change** (plan step 2): none. The suite with the sketch and every new test in: `308 pass` / `0 fail`.

Predicted red set on the tests commit (the final test file on the base modules, pasted): **`305 pass` / `3 fail` / `Ran 308 tests across 1 file.`** — V1, V2, V5; V3, V4 and the guards green.

## 5. Accept gate

- suite, lint and review per run steps 3–4; lint is `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin validate mods/shawarma-companion` (sketch: `✔ Validation passed`) and `~/.npm-global/bin/tsc -p <tsconfig>` (tsc 6.0.3) on a copy of the mod's tsconfig outside the repo whose `files` names `plugin-authoring/types/claude-code.d.ts@2.1.330` and the mod's `hooks/register.tsx`, `hooks/model.ts`, `types/index.d.ts` (sketch: exit 0, no output; a wrong spelling `next.sgnal`: `error TS2551`)
- live-data run: `DRY-RUN ON STAND-IN` — the real engine cannot hold a subagent's call across a turn end and 64 writes on demand, so the kit's synthetic answers are the stand-in; said in the PR
- rules:
  - **R1** mod suite: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test mods/shawarma-companion`, reading the `N pass`, `M fail` and `Ran N tests` lines, `<graded>/<expected>` = ran / 308. Dataset: the synthetic tests of `tests/band.test.tsx`, read in aggregate; V1–V5 bind. Settle: read once on the final commit; when it reads a failure outside the skills-5w5c block, read twice more and paste all three: PASS needs two of three with `failed: 0` and the skills-5w5c block passing in all three (S2). PASS: `failed: 0` (the `0 fail` line) and ran ≥ 308. Dry-run reading with the fix patched in (`.worktrees/5w5c-spike`): `308 pass` / `0 fail` / `Ran 308 tests across 1 file.` ×4 (one earlier run `307 pass` / `1 fail`, Q6-4, S2). FAIL reading on the nearest wrong fix (no release on the signal, 2b (ii) out): `307 pass` / `1 fail` (V3); on the base modules: `305 pass` / `3 fail`. Cannot run: a missing folder reads `claude plugin test: /nonexistent-dir: no such plugin folder`, no `pass` line — which differs from PASS.
- orchestrator follow-ups: at run time, rebase on main after skills-oz54 and skills-1tr4 (both edit `register.tsx` and the end of `band.test.tsx`; oz54 changes the cwd reads either side of 2a's lines in the `tool.call` hook: expect a textual conflict there, keep both); then set the next free version with a changelog entry (§3); `check_pr.py` with `--base` set to `origin/main`'s SHA read at Wave 0; file the ticket of D3; the plugin is reinstalled only by the orchestrator.

## 6. Worst impact

The band shows another session's run as this session's (`other tree:` on a tree it never worked in) for the rest of the session, when a writing call never ends (accepted, Q1; V5), or for one turn and 64 writes after a call is abandoned or its end-time clock read fails (pre-existing, S1). The change cannot hide a call the engine still runs, except a tool still writing beneath an abandoned call (L1, as on the base). ⇒ adversarial lane.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines: K5 (hot reload) and L1 (the user interrupt), the two NOT RUN rows of §2's Partition, a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests K1, K4, K4a, L1, L5, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (plan time; round 1 `reports/attack/report.md`, round 2 `reports/attack2/report.md`):

- K1 enumerate: the ways `next(e)` ends (resolves, `isError`, `{deny}`, rejects, the hook beneath throws, `clock.now` rejects or never answers in the finally), each after an eviction and before another session's marker → oracle hand-written band rows from the contract "a marker written while one of this session's writing calls has not ended for the engine claims its tree"
- K2 `/clear` mid-call, then a new session id → oracle band rows and the store Map read directly
- K3 a main-loop long call through a subagent turn end, 64 subagent writes, and a main turn end → oracle band rows
- K4 enumerate: every length-3 sequence from S over {E, T, W, C, O}, plus a trailing C or O → oracle a contract function written apart from the mod
- K5 hot reload and `session.start` mid-call → oracle band rows
- K6 n open calls × m markers, n up to 800 → oracle process CPU and RSS, head against base on the same input
- K7 the same event dispatched twice; a long non-writer call; a hook above answering first → oracle band rows
- L1 enumerate: the ways the signal aborts × the marker before or after the abort → oracle hand-written rows from the contract
- L2 the signal already aborted when the listener is added → oracle band rows after an eviction
- L3 K1, K1b, K4, K7c on the revised sketch → oracle round 1's readings
- L4 2 000 and 10 000 calls ending normally → oracle process CPU and RSS against base, the set's size through an instrumented copy
- L5 enumerate: the README's and the doc comment's claims (rewrites, back-dated markers, the 50-tree cap, an abandoned call) → oracle each sentence read literally
- L6 re-read the d.ts rows → oracle the d.ts text

Mutants for 3b (each patched into the sketch, `claude plugin test` on the final §4 file; outputs in the planner's scratch `runs/<name>.txt`):

- `mutant: :759-760 release() after await $.clock.now() → V4 red (m1-after-await)`
- `mutant: :759 release() removed from the finally → V4 red (m2-never-released-finally)`
- `mutant: :251 spans without ...openWindows → V1, V2, V5 red (m3-not-read)`
- `mutant: :754-755 the signal lines removed → V3 red (m4-no-signal)`
- `mutant: :754 the already-aborted check removed, listener only → attack2 L2 red (m_noab; not in the suite: the kit reaches it only through a held cwd read)`

## 8. Out of scope

- An abandoned call's span, or one whose end-time clock read failed, stays open in `windows` and `turnWindows` (S1): the D3 ticket.
- A user interrupt and a hot reload cannot be raised in the kit (S3).
- skills-oz54 changes the cwd reads in the `tool.call` hook and `claim`'s cwd line; skills-1tr4 changes `model.ts` (`rowText`, `clean`). This change touches `claim` (one line, :251) and the `tool.call` hook (the span lines between oz54's two cwd reads), and rebases on whichever merged first. Out-of-diff review findings: ticket, unless they make a §3 line or R1 false.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
| R1 | 2026-11-23 | the human | §3 (register.tsx doc comment; README :36) | "`windows` and `turnWindows` keep their own copy as before" → "hold the same span object, as before, so the call's end closes it there too; an abandoned call's span stays open there until evicted (skills-blde)"; "A call counts until the engine ends or abandons it, however long it runs" → "A call counts while it runs, however long … A call the engine abandons counts on until a main turn end and 64 newer writing calls." | review 3a: the lists hold the same object as the new set (C1), and an abandoned call still claims other sessions' markers until a turn end and 64 writes (A5, same on base) |
| D-R1 | 2026-11-23 | the human | §6 | worst impact names a never-ending call → also: a finite long call's wrong claim of another session's marker lasts the session and a resume (30 days), and its rows can push the own other-tree row below the fold; stated in PR and changelog, no code change | review 3a A2, A2r, A3 |
| D-R2 | 2026-11-23 | the human | §6 | — → an engine without `next.signal` (older than 2.1.325) would leave the span open for good; NOT RUN, noted in the PR | review 3a error surface |


## Defaults at this stop

> **What this is about:** the README's claim rules gain two sentences saying a call counts until the engine ends or abandons it, and that a call that never ends keeps claiming other sessions' new markers. The first wording ("every marker", "the marker it writes", "keeps counting") was false for rewrites, back-dated markers, the 50-tree cap and an abandoned call (attack2 L5), so it was narrowed. A: accept the wording in 2d (executed: each narrowed case read in L5). B: no README change, the limit stated only in the changelog and PR (unexecuted). Recommend A. Residue: none.

> **What this is about:** a call can end for the engine without the mod's clean-up running, when another plugin answers first while the call beneath never ends. Option A alone then kept the span open and claimed other sessions' markers after the call had ended, which Q1 did not accept (attack K7c: `other tree: other-1`). The sketch now also releases the span when the engine marks the call abandoned. A: apply (executed: V3 green, 308/0; the mutant without it 307/1). B: drop it and accept the over-claim (executed: K7c `other tree: other-1`). Cost of A: a tool still writing beneath an abandoned call, after a main turn end and 64 writes, is not claimed — the base does the same (attack2 L1 A-b). Recommend A. Residue: the PR states it.

> **What this is about:** an ended call's span can stay open in the two capped lists `windows` and `turnWindows` (an abandoned call; an end-time clock read that fails), so another session's new marker is claimed for up to a turn and 64 writes. It is the same on the base, and this change does not touch those lists (S1; attack K1b, attack2 K4a). A: a new ticket, not folded (executed reading: base 123/147, sketch 127/147 on K4a). B: fold it in, setting the span's end when the call is abandoned (attack2 `h2`: K4a 147/147 but its L1 "A-b soon" row still over-claims; unexecuted against this brief's tests). Recommend A. Residue: the new ticket.

unruled: D1 the README's two claim-rule sentences (2d) — default accept as written
unruled: D2 release the span when `next.signal` aborts (2b ii): a tool still writing beneath an abandoned call after a turn end and 64 writes is not claimed, as on the base — default apply
unruled: D3 an ended call's span kept open in `windows`/`turnWindows` (abandoned call; failed end-time clock read; S1) — default a new ticket, not folded
