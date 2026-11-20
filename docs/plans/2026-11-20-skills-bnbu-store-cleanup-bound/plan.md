# skills-bnbu — the store clean-up is bounded per call, not per pass

Ticket `skills-bnbu` (+ folded `skills-6y0d`, one unreadable store entry stops every session's clean-up: same function, and its fix needs the per-pass deadline; folded by Q2) · authority: the owner's rulings Q1, Q2 (design interview), Q3, D1, D2, D3 (plan ending) in [decisions.md](decisions.md), 2026-11-20 · planned 2026-11-20 (claude-opus-5-5; skill 0.11.0) at base `2e63362 plan(skills-cm2l): spike, attack lane, sketch — paused on Q4–Q6` (the mod's files are the same at `6843c0e`) · proposed branch `fix/bnbu-prune-deadline` in `.worktrees/bnbu`, PR + squash. Lessons read: none in the tagged `- Lesson (<tag>)` format (`grep -n '^- Lesson (' docs/plans/lessons.md` prints nothing, exit 1). The three untagged skills-v2tm lessons in that file were read: containment through links `no: the change follows no path`; oracle from the contract's words `matches §4` (each bound in U1, U2, U7 is a hand count written beside the test); mutants per round `matches §7` (nine mutants run on the sketch's own lines).

## 1. What (the defect or goal, measured)

`restore()` (`mods/shawarma-companion/hooks/register.tsx:294-314` at the base) runs once per new session id, inside the refresh of `session.start` (:673), the first writing `tool.call` (:702), `turn.complete` (:712) or the 15 s check (:625). After reading the session's own entry, it lists the store's keys and examines up to `MAX_PRUNE` = 100 other `claims:` entries. Each `store.get` is raced against 2 s on its own (`within`, :307) and each `store.delete` too (`bounded`, :311). Nothing bounds the loop.

Measured on the base (engine clock of the kit, 100 fresh or expired other entries; commands in §4):

- every read answering in 0.5 s or 1.9 s: the first Bash call is still held at the test's 10 s cap (U1);
- `store.delete` never answering: held 200 s (U2); 9 400 ms with deletes answering in 1.9 s (attack A3);
- session start, reads in 1.9 s: held at the 10 s cap (U7).

skills-6y0d: the pass ends at the first read that fails or runs late (:308). `store.keys()` answers "in insertion order" (§2 Sources), so one bad entry inserted first ends every session's pass: 150 expired entries stay after three session ids (U4), 50 stay after a rejecting first entry (U3).

## 2. The design

The whole change is a patch beside this brief: [sketch/sketch.patch](sketch/sketch.patch), paths relative to `mods/shawarma-companion/` (`hooks/register.tsx`, `hooks/model.ts`, `tests/band.test.tsx`, `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`; 6 files, 186 insertions, 19 deletions). `EXECUTED (inputs: the Partition rows below; `claude-personal plugin test` on the sketch → `285 pass` / `0 fail`; the attack lane's A1–A9 and D1–D6)`. Copy it as it is; §3 freezes its shapes.

- **2a** `restore` keeps its own-entry read (`bounded`, 2 s; a failure throws, as before), then calls `prune($, id, now)`.
- **2b** `prune` starts one `$.clock.after(RUN_MS)` deadline and races each store call of the pass against it: the key listing, each entry read, each delete. The timer is cancelled in a `finally`.
- **2c** A read that rejects, or answers `undefined` (a key listed but unset), skips its entry. A call still running at the deadline ends the pass (`return`), a read or a delete alike.
- **2d** The pass reads at most `MAX_PRUNE` entries, from `pruneStart(id, keys.length)`, wrapping. `pruneStart` (in `model.ts`) is FNV-1a of the id's UTF-16 code units, mod the count, 0 for a count of 0.
- **2e** The judgement is the base's: an entry `parseClaimed` refuses, older than `CLAIM_TTL_MS`, or dated past now + `CLAIM_TTL_MS` is deleted.
- **2f** README, CHANGELOG (0.3.1, Fixed), plugin.json 0.3.1 (D1).

Rejected options: a background pass and a background pass with a deadline (Q1); "skip, no offset" and "don't fold" (Q2); re-reading before each delete and deleting no other session's entries (Q3).

**Sources** (plan step 1; research report `reports/research/report.md`, re-read by the attack lane, `reports/attack/report.md` §A10):

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §1 key order | `claude-code.d.ts:4131-4133@2.1.329` | "Returns every key set, in insertion order." | verified |
| §1 the engine does not cut the hold | `claude-code.d.ts:6289-6292@2.1.329` | "the clock stops while a `next(e)` call or any `$` call of the hook's is in flight (a `$.clock` wait excepted)" | verified |
| §2 2b the deadline timer | `claude-code.d.ts:4210-4224@2.1.329` | "Calls `fn` once after `ms` milliseconds; `cancel()` before then stops it. One `clock.after` dispatch: `fn` runs when it resolves, and never when a hook refuses it." | verified |
| §2 2c an unset key reads `undefined` | `claude-code.d.ts:4112-4135@2.1.329` | "Returns the value under `key`, or `undefined` when unset." | verified |
| §4 the kit clock moves only when the test moves it | `claude-code.d.ts:20760-20771@2.1.329` | "moves only when the test moves it … each wait is held." | verified |
| §8 no compare-and-set (Q3) | `claude-code.d.ts:4126-4130@2.1.329` | `set: (key: string, value: unknown) => Promise<void>` / `delete: (key: string) => Promise<void>` | verified |

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| reads slow, under 2 s | the store answering late (`hold`) | U1 at 0.5 s and 1.9 s; U7 at session start | sketch 2 500 ms / 5 reads, 3 900 ms / 3 reads, U7 3 reads; base 10 000 ms cap |
| delete never answers | a hanging store | U2 | sketch ≤ 2 s, 2 reads; base 200 s, 101 reads |
| delete slow (1.9 s) | the store | attack A3 | sketch 1 900 ms; base 9 400 ms |
| read rejects | a store fault | U3; attack D1, D4 | sketch skips (50 deleted); base 0 deleted |
| read never answers, inserted first | one bad entry | U4; attack A8 (50 ids) | sketch [50, 16, 0]; A8 [100, 33, 12, 1, 0 × 46]; base 150 each |
| read answers `undefined` | a key listed but unset, or a fault | U6; attack D5 | sketch keeps it; base deletes the live entry |
| key listing: slow, rejects, never, non-array, non-strings, unprefixed | the store | Q6-5, Q6-6; attack A3, A6 | same as the base on each row |
| key count: 0, own only, 1, 100, 101, 151, 5 000 | other sessions | S13, S30; attack A6, A9 | at most 100 reads; 101 and 5 000 rows start where Python predicts |
| two passes at once, one id | `session.start` and a Write before `restoredFor` is set; a reload | attack A1, D6 | sketch 3 800 ms each; no fresh entry deleted |
| `/clear` during a pass | the id changes | attack A2 | sketch [2 800, 3 800, 0, 0] ms; both ids' entries kept |
| a late delete that lands | the store | attack A4 | lands after the pass; with the owner rewriting the entry, 1 live entry deleted (base 2): Q3 |
| clock timer refused | another hook | attack A5 | sketch and base held past 60 s: D2, bean skills-vmhr |
| ids for `pruneStart` | the engine's session id | U5; attack A7 (81 values) | equal to an independent Python FNV-1a |

**Attack readings** (one per §7 line):

- A1 → sketch held [3800, 3800] ms (base [17000, 17000]); f1–f3 kept; `claims:new-1` written. Holds.
- A2 → sketch [2800, 3800, 0, 0] ms; `claims:a`, `claims:b` and f1 kept. Holds.
- A3 → sketch at most 1 900 ms on each of 12 rows (hand bound 2 100); no fresh entry deleted. Holds.
- A4 → with the owner rewriting during a held delete: 1 live entry deleted (base 2). Pre-existing race; accepted by Q3, bean skills-hybo.
- A5 → a refused timer leaves the read hanging past 60 s on sketch and base. Docs changed to state the condition (2f); D2, bean skills-vmhr.
- A6 → no fresh or unprefixed key deleted; 101 keys: 67 deleted (Python 67); 5 000: k3137…k3236 (Python the same). Holds.
- A7 → 81 of 81 values equal the Python FNV-1a; ids can share a start, so the README says "usually" (2f). Holds.
- A8 → sketch [100, 33, 12, 1, 0 × 46], equal to the Python simulation; base 150 × 50. Holds; pinned at three ids by U4.
- A9 → 100 reads, 0 deletes, on sketch and base. Holds.
- A10 → each quote verified or paraphrased, none not found; the Sources rows above quote the verified ones.
- D5 (lane's own) → a read answering `undefined` deleted a live entry on the base and on the first sketch: the sketch changed (2c), test U6.

**What the planner saw:**

- S1 Two passes for one id start at the same offset and repeat the same reads and deletes (A1). Harmless: the second delete removes nothing more; the hold stays under 4 s.
- S2 The first update waits at most about 4 s, not 2: the own-entry read keeps its 2 s (Q1), then the pass has 2 s. U1 reads 3 900 ms. The README and CHANGELOG say so (2f).
- S3 A late delete can land after the pass returned (A3, A4). It removes only an entry judged expired, future-dated or malformed, unless its owner rewrote it meanwhile (Q3).
- S4 In the kit, a `$.clock.after` called inside a test's `hold` did not resolve, and a test's own time counter has to move after `clock.advance`, not before. U1 and U7 use a release queue driven by the test for this.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `mods/shawarma-companion/hooks/register.tsx` | implementer | 2a, 2b, 2c, 2d, 2e: `restore` calls `prune($, id, now): Promise<void>`, which does not throw; `pruneStart` imported |
| `mods/shawarma-companion/hooks/model.ts` | implementer | 2d: `export function pruneStart(sessionId: string, count: number): number` — FNV-1a (offset basis `0x811c9dc5`, prime `0x01000193`, `Math.imul` then `>>> 0`) over `charCodeAt`, `% count`; `count <= 0` gives 0 |
| `mods/shawarma-companion/tests/band.test.tsx` | implementer | §4 |
| `mods/shawarma-companion/README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json` | implementer | 2f, as in the patch |

Error surface: `prune` does not throw to its caller (A3, enumerate). Per store call of the pass: rejected → that entry is skipped (a key-listing rejection ends the pass with no delete, A3); `undefined` read → skipped; no answer by the deadline → the pass ends. The caller sees only the time held: at most RUN_MS after the own read, when the engine fires the timer (A5).

## 4. Tests

All in `mods/shawarma-companion/tests/band.test.tsx`, block `skills-bnbu: one deadline per prune pass (Q1); a failed read skipped, sessions start apart (Q2)`. Synthetic stores only. Run: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion`.

- **U1** *red* ×2 — every `store.get` answers in 500 ms / 1 900 ms, 100 fresh other entries: the first Bash call is held 4 s or less, 5 / 3 reads asked (hand count in the test's comment). Executed assertion on the base: `Received: { heldMs: 10000, asked: 21, others: 100 }` and `{ heldMs: 10000, asked: 6, others: 100 }`.
- **U2** *red* — `store.delete` never answers, 100 expired: held 2 s or less, 2 reads. Base: `Received: { atMost2: false, gets: 101 }`.
- **U3** *red* — the first-inserted entry's read rejects: it is kept, the 50 expired after it deleted. Base: `Received: { bad: true, old: 50 }`.
- **U4** *red* — the first-inserted entry's read never answers; ids a, b, c in turn: expired left `[50, 16, 0]` (independent Python simulation). Base: `Received: { seen: [150, 150, 150], hang: true }`.
- **U5** *red* — `pruneStart` values `[6, 26, 36, 1, 0, 0]` (independent Python FNV-1a). Base: `Received: "undefined"`.
- **U6** *red* — a listed entry whose read answers `undefined` is kept; an expired one deleted. Base: `Received: { live: false, old: false }`.
- **U7** *red* — session start, reads in 1 900 ms: held 4 s or less, 3 reads. Base: `Received: { heldMs: 10000, asked: 6, others: 100 }`.
- Guards (green before and after): S13 (what is pruned), S30 (at most 100 examined), Q6-5 (each store call hanging: answers within 2 s + 60 s), Q6-6 (key list of another shape), Q7-3 (100 hung reads: one advance).

**Existing tests that change** (plan step 2):

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|
| S30 | the pass now starts at `pruneStart('sess-1', 151)` = 6, so the future-dated entry at index 0 is not read | assertions kept; the future-dated entry moves to index 50 of the fixture, read from 0 or 6 (D3) | passes on the base modules and on the sketch |

Predicted red set on the tests commit (the final test file on the base modules, pasted): **`277 pass` / `9 fail` / `Ran 286 tests across 1 file.`** — U1 ×2, U2, U3, U4, U5, U6, U7, and the kit's `the file ran to its end` (a rejection nothing handled: U1's unreleased reads on the base); guards green.

## 5. Accept gate

- suite, lint and review per run steps 3–4; lint is `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin validate mods/shawarma-companion` (sketch: `✔ Validation passed`) and `~/.npm-global/bin/tsc -p <tsconfig>` (tsc 6.0.3) on a copy of the mod's tsconfig outside the repo whose `files` names `plugin-authoring/types/claude-code.d.ts@2.1.329` (sketch: exit 0, no output; a wrong fix `pruneStart(keys.length, id)`: `error TS2345`; the types path wrong: `error TS6053 … not found`)
- live-data run: `DRY-RUN ON STAND-IN` — the engine's store cannot be slowed or made to fail on the real engine (s6qg lane report, NOT RUN), so the kit's synthetic stores are the stand-in; said in the PR
- rules:
  - **R1** mod suite: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion`, reading the `N pass`, `M fail` and `Ran N tests` lines, `<graded>/<expected>` = ran / 285. Dataset: the synthetic tests of `tests/band.test.tsx`, read in aggregate; U1–U7 bind. Settle: read once on the final commit. PASS: `failed: 0` (the `0 fail` line) and ran ≥ 285. Dry-run reading with the fix patched in (`.worktrees/bnbu-spike`): `285 pass` / `0 fail` / `Ran 285 tests across 1 file.`. FAIL reading on the nearest wrong fix (a late read skips instead of ending the pass, mutant m3): `282 pass` / `3 fail`; on the base modules: `277 pass` / `9 fail`. Cannot run: a missing folder reads `claude plugin test: /nonexistent-dir: no such plugin folder`, no `pass` line — which differs from PASS.
- orchestrator follow-ups: after merge, reinstall the mod (marketplace update to 0.3.1); beans skills-hybo (Q3) and skills-vmhr (D2) stay open; close skills-6y0d with this PR.

## 6. Worst impact

A live store entry deleted, so a resumed session loses its claims and its own run reads as "in another worktree" (wrong output) — reachable only through the pre-existing read-then-delete race (Q3, A4) — or a first update held past 4 s when the engine refuses the timer (D2, A5). ⇒ adversarial lane.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines: none in this brief, a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests A3, A6, A7, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (plan time, `reports/attack/report.md`):

- A1 two passes at once for one new id (`session.start` and a Write before the first pass ends), reads in 1.9 s → oracle engine ms held against the hand bound 4 000, and the store Map against a hand key set
- A2 a `/clear` one second into a pass → oracle the store Map after two more calls, hand-written entries
- A3 enumerate: `store.keys`, `store.get`, `store.delete` × answers at once, in 1.9 s, rejects, never (12 rows) → oracle engine ms held against the hand bound 2 100 after the own read, and deleted keys against a hand list
- A4 a delete held past the deadline that lands later, with and without the owner rewriting the entry → oracle the store Map after two more calls
- A5 the deadline timer refused or dropped while a read hangs → oracle engine ms held
- A6 enumerate: key lists `[]`, own only, 1 other, 100, 101, 5 000, a non-array, non-strings, unprefixed keys → oracle a per-key diff against the base and against the hand rules (30 days, future, malformed)
- A7 enumerate: ids `''`, `'a'`, 10 000 chars, a non-BMP character, one-character neighbours × counts 0, 1, 2, 151, 2^31 → oracle an independent Python FNV-1a over UTF-16 code units
- A8 one never-answering entry inserted first, 150 expired, 50 ids in turn → oracle a Python simulation of the rule
- A9 5 000 fresh other entries answering at once → oracle the count of `store.get` events
- A10 re-read of the research report's quotes at the cited d.ts lines → oracle the d.ts text

Mutants for 3b (each patched into the sketch, `claude plugin test` on the final §4 file; outputs in the planner's scratch `bnbu/mutants/<name>.txt`):

- `mutant: if (read.kind === 'failed') return (a failed read ends the pass) → U3 red, and the kit's file-end check (m1-no-skip)`
- `mutant: const start = 0 → U4 red (m2-start-0)`
- `mutant: if (read.kind === 'late') continue → U1 ×2, U7 red (m3-late-continue)`
- `mutant: await race($.store.delete(key)) with no late check → U2 red, gets 3 (m4-delete-late-continue)`
- `mutant: an undefined read judged as malformed → U6 red (m5-undefined-judged)`
- `mutant: i < keys.length (no MAX_PRUNE cap) → S30, U4 red (m6-no-cap)`
- `mutant: return (hash + 1) % count → U4, U5 red (m8-start-offby1)`
- `mutant: within($, $.store.keys()) for the key listing → no test red: equivalent, the deadline already starts before the listing (m7-keys-own-bound)`
- `mutant: the deadline timer not cancelled → no test red: no observable output in the kit (m9-no-cancel)`

## 8. Out of scope

- The read-then-delete race (Q3): bean skills-hybo; a limit in the PR.
- A refused or dropped clock timer leaves every 2 s bound open (D2): bean skills-vmhr; the README states the condition.
- skills-cm2l (a failed check empties the rows) is planned in parallel on the same mod; its brief changes `refresh`/`stale`, not `restore`. Whichever PR merges second rebases; the CHANGELOG version entries may need renumbering.
- The 30-day rule, `parseClaimed`, the key filter and `MAX_PRUNE` stay as they are.
- Out-of-diff review findings: ticket, unless one reaches §6's worst impact through a changed line.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|

unruled: none
