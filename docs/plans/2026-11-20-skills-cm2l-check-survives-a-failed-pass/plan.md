# skills-cm2l — shawarma-companion: the 15 s check survives a failed pass

Ticket `skills-cm2l` + folded `skills-0wsk` (same handler, same lines; its fix alone stops the check on the base: ruling Q3) · authority: the owner's rulings Q1–Q6 and D1–D3 in [decisions.md](decisions.md) (design interview and plan ending, 2026-11-20) · planned 2026-11-20 (claude-opus-5-5; skill 0.11.0) at base `2e63362 plan(skills-cm2l): spike, attack lane, sketch — paused on Q4–Q6` · proposed branch `fix/cm2l-check-survives-failure` in `.worktrees/cm2l`, PR + squash. Lessons read: none in the tagged `- Lesson (<tag>)` format (`grep -n '^- Lesson (' docs/plans/lessons.md` prints nothing, exit 1). The three untagged skills-v2tm lessons were read: containment through links `matches §2 S2` (Q4 refreshes a not-readable plan dir; the real path is asked before the list, N22 green); oracle from the contract's words `matches §4` (each new expectation hand-written from the rulings' and README's words; the lane's flags on copied values fixed in C3 and C9); mutants per round `matches §7` (8 mutants, each executed against the final tests).

## 1. What (the defect or goal, measured)

While a row is drawn, `watch` (`mods/shawarma-companion/hooks/register.tsx:593-603` at `a70d50c`) runs `stale` every 15 s. One failed fs call there empties the row and ends the check, so the row stays empty until the next tool call or turn end, even after the error clears. Three paths, each executed on the base:

- a picked row whose file read fails is left out (`register.tsx:562-570`); with no row left, `refresh` calls `watch($, false)` (`:589`) and the check stops. Probe: one failed read of `decisions.md` in a check → band `undefined`; after the error clears, 0 fs calls in the next 60 s.
- `stale` throws (a rejected `$.fs.exists` at `:631`) → the timer's catch (`:598-601`) empties the rows; the next pass finds no row and stops. Same readings. The catch leaves the more-row's counts as they were (skills-0wsk): band `["1 run in another worktree"]` after the failed pass.
- one failed listing of a plan dir leaves `… · 0 decisions · plan dir not readable: <dir>`; each later pass only asks `exists`, whose `true` matches "not readable", so no update starts (attack lane A1+, ruling Q4).

## 2. The design

The whole change is a patch beside this brief: [sketch/sketch.patch](sketch/sketch.patch), against `1eed2e3`, for `mods/shawarma-companion/` (`hooks/register.tsx`, `tests/band.test.tsx`, `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`; 5 files, 253 insertions, 32 deletions). `EXECUTED (inputs: the Partition rows below; `claude plugin test` on the sketch → `291 pass` / `0 fail`; the attack lane's probes A1–A11)`. Copy it as it is; §3 freezes its lines.

- **2a** `export const UNREAD = 'could not be read'`; in `snapshot`, a picked marker whose `rowOf` rejects is pushed as a problem row: its ticket, marker, tree, time and labels, `planDir: ''`, `step: ''`, `title: ''`, `decisions: 0`, `problem: UNREAD`. Nothing read earlier is kept (Q1).
- **2b** `refresh` keeps a running check after a failed pass: `watch($, rows || more-row || (next.scan.status === 'failed' && check !== null))`. A refresh that fails with no check running starts none.
- **2c** `failed($)`: `lastScan` failed, `lastListed` null, rows `[]`, hidden counts all zero (Q3). The timer: `$.clock.every(CHECK_MS, () => void stale($).catch(() => failed($)).catch(() => undefined))`.
- **2d** `stale`'s early stop also requires `lastScan.status !== 'failed'`.
- **2e** in `stale`, a row with `problem === UNREAD` or a `plan dir not readable` problem sets `isChanged` (a full refresh, which asks the real path before listing) each pass, with no limit (Q2, Q4).
- **2f** in `stale`, `$.fs.exists(row.planDir).catch(() => null)`; null starts the refresh.
- **2g** the pane's `<n> markers could not be read.` line, `reasonFor`'s `could not be read` and `Scan.unread` are removed (Q6).

Rejected options: keep the last row dimmed (Q1 C, ruled out: it may show out-of-date content); back off or give up (Q2 B, C); keep 0wsk apart (Q3 B); fix the `0 decisions` count here (Q5: bean skills-6loo).

**Sources** (plan step 1; research report `reports/research/report.md`; no 2.1.329 types file exists, so every line is @2.1.325; the 2.1.326–2.1.329 changelog has no `clock`, `fs` or `state` entry):

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §2 2c · a rejected callback does not end the interval | `claude-code.d.ts:14598@2.1.325` | "export type TimerCall = (ms: number, fn: () => void) => Timer;" | verified (A4: the check made 11 fs calls in 60 s with `clock.now` failing for good) |
| §2 2c · only a refused period ends it | `claude-code.d.ts:3710@2.1.325` | "a refused period ends the interval." | verified (A11a reproduces it; bean skills-vtd4) |
| §2 2f · `exists` rejects only a network location | `claude-code.d.ts:3517@2.1.325` | "Returns whether the path exists; rejects only a network location" | paraphrased (the lane injected the rejection with `hold`) |
| §2 2a · `read` rejects a missing file | `claude-code.d.ts:3480@2.1.325` | "Rejects when missing, or over 4 MiB" | verified (A7 used `hold`: the fake world's read of a missing file returns `''`) |
| §6 · a reload drops the timer | `claude-code.d.ts:3674@2.1.325` | "a hot reload of the plugin cancels its pending waits with the old environment." | verified (A6) |

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| 2a marker read rejects | another process, permissions | C6 marker; R2 ×2; R3-2 | `shawarma: skills-x: could not be read`, then the full row one pass later |
| 2a plan.md read rejects | same | C6 plan.md | as above, new title after |
| 2a decisions.md read rejects | same | C1, C2 | as above, `2 decisions` after |
| 2a `exists` after a failed list rejects | a network mount | C6 exists | as above |
| 2a 20 + 1 unreadable markers | many runs | 21 markers test | 20 problem rows, `+1 more not shown` |
| 2a labels on the row | other tree, earlier session, stale | C7; lane A2 (stale) | `earlier session: shawarma: skills-z: could not be read`, `other tree: shawarma: skills-y: could not be read` |
| 2a marker deleted between list and read | the run ending | lane A7 | the problem row one pass, then `[]` |
| 2b refresh fails, check running | `usage` rejects | C5 | band `undefined`, then `… run W2 …` one pass later |
| 2b refresh fails, no check | tool call, turn end, band off | G1; lane A5 | 0 fs calls in 60 s |
| 2c `stale` throws | `clock.now` rejects | C4; lane A3 | band `[]`, pane `Shawarma state could not be read.`, then row and more-row back |
| 2c `failed` itself rejects | a refused state write | `NOT RUN (state hooks fall through to core in the kit)` | — |
| 2e read keeps failing | permanent EACCES | C2; C9 | 4 reads in 4 passes; 21 calls per pass at 20 and 40 markers |
| 2e plan dir fails to list once | permissions | C10; N11 | full row one pass later; `stat … resolve` before `list` |
| 2f `exists` rejects on a not-found row | a network mount | C3 | the row as before, then the W2 marker one pass later |
| 2g pane on an unreadable row | press, command | R3-2; C8; lane A10 | `shawarma: a: could not be read (/repo/.shawarma/active-a)` |
| reload with a problem row in state | a hot reload | lane A6 | first draw restarts the check; the row is read again in one pass |

**Attack readings** (`reports/attack/report.md`; base `1eed2e3` vs the sketch before Q4):

- A1 → holds: each `rowOf` await gives the problem row then the full row; base `[]` then `[]`. Pinned by C1, C6 ×3.
- A1+ → finding: a failed plan-dir list or stat leaves the not-readable row; fixed by Q4 (2e), pinned by C10 and N11.
- A2 → holds: labels as `labelOf`; pinned by C7.
- A3 → holds for `clock.now` (C4); `NOT RUN` for atom reads and writes (the kit's state hooks fall through to core).
- A4 → `NOT RUN` for a refused `failed`; 11 fs calls in 60 s with `clock.now` failing, no unhandled rejection.
- A5 → holds; the wrong fix without `check !== null` reads 8 calls and fails G1 (mutant m3).
- A6 → holds; A7 → holds; A10 → holds (C8).
- A8 → pre-existing, same on both: one hung read per pass; note on skills-y1gt (D3).
- A9 → holds: 2 / 6 / 21 / 21 calls per pass at 1 / 5 / 20 / 40 unreadable markers; pinned by C9.
- A11 → (a) pre-existing: a refused period stops the check for good; bean skills-vtd4 (D2). (b) 83 fs calls in 600 s with a pass failing for good, by ruling Q3. (c) holds: decisions.md unreadable at a tool call draws the problem row.

**What the planner saw**:

- S1 A marker deleted between its listing and its read draws `could not be read` for one pass (lane A7). True as written (the read failed); gone at the next pass.
- S2 Q4's refresh of a not-readable plan dir asks the real path before listing (N11's log: `stat … resolve`, `list`, `exists`), so containment holds; N22 (a link out) stays green.
- S3 The not-readable row still shows `0 decisions` (N11 pins it): Q5, bean skills-6loo.
- S4 A pass that never ends (a hanging read) is not bounded by this change: same as the base (A8, skills-y1gt).

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `hooks/register.tsx` | implementer | lines 2a–2g as in the sketch |
| `tests/band.test.tsx` | implementer | the `describe('cm2l: the 15 s check survives a failed pass')` tests of §4 and the five changed tests |
| `README.md` | implementer | the unreadable row and its re-read; the 15 s check's exception after a failed update; the not-readable plan dir's full update; the two pane lines removed |
| `CHANGELOG.md`, `.claude-plugin/plugin.json` | implementer | `0.3.1` (D1): Fixed ×3, Removed ×1 |

Error surface: a failed file call in a row → the `UNREAD` problem row (the reader can wait 15 s or fix the permission); a failed pass → no rows, no counts, pane `Shawarma state could not be read.`, the check goes on; a failure in `failed` → swallowed, the check goes on. No new throw leaves the module.

## 4. Tests

All in `tests/band.test.tsx`, synthetic data only, expected values hand-written from the rulings and the README.

- C1 *red* — decisions.md fails once in the check: `expect(await bandText($)).toBe('shawarma: skills-x: could not be read')`, then `'skills-x — the thing · run W1 · since 14:01 · 2 decisions'`. Base: `Received: undefined`.
- C2 *red* — a read that keeps failing: `expect(... === \`read ${DEC}\`).length).toBe(4)` over 60 s. Base: `Received: 0`.
- C3 *red* — `exists` rejects once on a not-found row: `toMatch(/· run W1 ·/)`, then `toMatch(/· run W2 ·/)`. Base: `Received: undefined`.
- C4 *red* (skills-0wsk) — a check that throws: band `toEqual([])`, pane `'Shawarma state could not be read.'`, then both rows back. Base: `Received: ["1 run in another worktree"]`.
- C5 *red* — a refresh that fails inside the check: `toMatch(/^skills-x — the thing · run W2 ·/)` one pass later. Base: `Received: undefined`.
- C6 ×3 *red* — marker / plan.md / `exists` fail once: the problem row, then `'skills-x — the new thing · run W2 · since 14:02 · 1 decision'`.
- C7 *red* — labels: `['earlier session: shawarma: skills-z: could not be read', 'other tree: shawarma: skills-y: could not be read']`.
- C8 *red* — the command's pane: `` `shawarma: skills-x: could not be read (${MARKER})` ``.
- C9 ×2 *red* — 20 and 40 unreadable trivial markers: `toBe(1 + 20)` calls per pass.
- C10 *red* — the plan dir fails to list once: the full row one pass later (Q4).
- G1 *guard* — a refresh that fails with no check running: `expect(log.length).toBe(n0)` over 60 s.

**Existing tests that change** (plan step 2; ruled Q4, Q6):

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|
| lane 3a round 3 fixes > R3-2 | the unread marker is a row | `'shawarma: a: could not be read (/repo/.shawarma/active-a)\nOther tickets: b'` | red on the base, green on the sketch |
| review round 2 > R2 the only marker | same | `'shawarma: u-1: could not be read (/repo/.shawarma/active-u-1)'` | same |
| review round 2 > R2 two markers | same | `'shawarma: u-2: could not be read (…/active-u-2)\nOther tickets: u-1'` | same |
| review round 3 > 21 markers | same | 20 problem rows u-20…u-01 (newest first), `+1 more not shown` | same |
| review round 5 > N11 | Q4 | one marker read; `stat … resolve`, `list`, `exists` of the plan dir; row unchanged | same |

Predicted red set on the tests commit (the final test file on the base modules, `claude plugin test`, pasted): **`273 pass` / `18 fail` / `Ran 291 tests across 1 file.`** — the 5 changed tests and the 13 new red tests; G1 green.

## 5. Accept gate

- suite, lint and review per run steps 3–4
- live-data run: `DRY-RUN ON STAND-IN — real run pending, orchestrator only`: no live session with a failing fs call to read; the synthetic tests stand in.
- rules:
  - **G1** mod tests: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion`, reading the `N pass`, `M fail` and `Ran N tests` lines. Dataset: the synthetic tests of `tests/band.test.tsx`, read in aggregate. Settle: read once on the final commit. PASS: `failed: 0` (`0 fail`) and `ran ≥ 291`. Dry-run reading with the fix patched in (`.worktrees/cm2l-spike`): `291 pass` / `0 fail` / `Ran 291 tests across 1 file.`. FAIL reading on the nearest wrong fix (2e removed: problem rows never re-read): `282 pass` / `9 fail`; on the base modules: `273 pass` / `18 fail`. Cannot run: `claude-personal plugin test /nonexistent-dir` reads `claude plugin test: /nonexistent-dir: no such plugin folder`, exit 1, no `pass` line — which differs from PASS.
  - **G2** manifest: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin validate mods/shawarma-companion`, reading the last line. Dataset: the mod folder, one case. Settle: read once. Dry-run reading with the fix patched in: `✔ Validation passed`. FAIL reading: `NOT RUN (no wrong fix of this change touches the manifest's shape; the version string is the only manifest edit)` — G2 is kept as a guard and its binding test is the validator itself. Cannot run: a missing folder reads `✘ Validation failed`, exit 1.
  - **G3** types: `~/.npm-global/bin/tsc -p <tsconfig>` (tsc 6.0.3), reading the exit code; `<tsconfig>` is a copy of the mod's outside the repo whose `include` names `plugin-authoring/types/claude-code.d.ts@2.1.325` and the mod's `hooks`, `types`, `tests`. Dataset: the mod's source, one case. Settle: read once. Dry-run reading with the fix patched in: exit 0, no output. FAIL reading: `NOT RUN (unexecuted: no type-level wrong fix named)`. Cannot run: a wrong types path reads exit 2 with `error TS` lines.
- orchestrator follow-ups: beans skills-6loo (Q5) and skills-vtd4 (D2); the note on skills-y1gt (D3).

## 6. Worst impact

A row that shows a step, title or count from before a failed read (wrong output), or a check that runs every 15 s for the rest of the session while a pass keeps failing (ruled by Q2 and Q3; at most 1 tree listing + 6 calls × 20 rows per pass, no process). ⇒ adversarial lane.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines A3 (atom reads and writes) and A4 (`failed` refused), and the Partition's `NOT RUN` row (2c `failed` itself rejects), a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests (A1 stat, A2 stale label), only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (plan time, `reports/attack/report.md`):

- A1 enumerate: every await in `rowOf` and `isPlanInside` that can reject (marker read; `exists` after a failed list; plan.md read; decisions.md read; plan-dir list; real-path stat) → oracle band text, literal, during and one pass after
- A2 enumerate: labels on an unreadable row — none, `other tree: `, `stale: `, `earlier session: `, two at once → oracle `labelOf` in model.ts plus the literal problem text
- A3 enumerate: every uncaught await in `stale()` throwing once → oracle band `[]`, pane `Shawarma state could not be read.`, rows back one pass after
- A4 `failed()` refused → oracle no unhandled rejection; fs calls in the next 60 s
- A5 a failed refresh at a tool call, a turn end, with the band off → oracle fs calls in 60 s
- A6 a hot reload with an unreadable row in state → oracle the first draw and the next pass's rows
- A7 a marker deleted between its listing and its read → oracle rows over two passes
- A8 a read that never answers, 1 and 20 rows, 120 s → oracle hung calls and fs calls, head vs base
- A9 n = 1, 5, 20, 40 unreadable markers → oracle fs calls per pass against 1 + 6 × 20
- A10 the pane on an unreadable row, pressed and by the command → oracle the pane's text, literal
- A11 free attacks on §6 → oracle band rows and fs-call counts, literal

Mutants for 3b, each executed against the final §4 files (`claude plugin test`):

- `mutant: 2e branch removed (no re-read of problem rows) → N11, C1, C2, C6 ×3, C9 ×2, C10 red (282 pass / 9 fail)`
- `mutant: 2e without the 'plan dir not readable' clause (no Q4) → N11, C10 red (289 pass / 2 fail)`
- `mutant: m3 'next.scan.status === 'failed'' without '&& check !== null' → G1 red (290 / 1)`
- `mutant: m4 failed() does not zero the hidden counts → C4 red (290 / 1)`
- `mutant: m5 stale's early stop without 'lastScan.status !== 'failed'' → C4, C5 red (289 / 2)`
- `mutant: m6 exists without '.catch(() => null)' → C3 red (290 / 1)`
- `mutant: m7 refresh's watch without the failed-scan clause → C5 red (290 / 1)`
- `mutant: m8 the problem row given 'step: 'run'', 'title: 'x'' → 21 markers, C1, C2, C6 ×3, C7 red (284 / 7)`

## 8. Out of scope

The `0 decisions` count on a not-readable row (Q5, skills-6loo); a refused timer period ending the check (D2, skills-vtd4); hanging reads (skills-y1gt, D3); every other open shawarma-companion bean. The marker format and the skill's text do not change. Out-of-diff review findings: ticket, unless the finding shows wrong output reached through lines 2a–2g.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
| W3-R1 | 2026-11-22 | the owner | §8 | — → a failed listing of a tree's `.shawarma` folder during the 15 s check (the band empties, the pane says `No shawarma marker in the last scan.`, the check stops) is out of scope: ticket skills-3hy6 | pre-existing on the base with the same readings (0 fs calls in the 60 s after the error clears); outside lines 2a–2g; the fix needs its own design |
| W3-R2 | 2026-11-22 | the owner | §8 | — → a late refresh drawing an older step for one 15 s pass, including when the check re-reads an unreadable row (2e), is out of scope: ticket skills-lm8d; the PR states the limit | the race is pre-existing on the base (a check refresh's late marker read); 2e adds one more way in; it lasts one pass |
| W3-P1 | 2026-11-22 | the owner | §3 (2f comment, README) | 2f comment `which draws the row as UNREAD` → `which draws the row again from what it reads now`; README: the unreadable row also covers a plan folder that does not list and whose existence cannot be asked; a not-found row also updates when the ask fails | the old text did not match what the code does: one rejected `exists` draws the not-found row again |
| W3-Da | 2026-11-22 | the owner | §4 | — → C11 *red on the label mutant*: a stale unreadable row reads `['stale: shawarma: skills-s: could not be read']` | a mutant setting the problem row's stale flag to false passed every test; C11 fails on it with `Received: ["earlier session: shawarma: skills-s: could not be read"]` |
| W3-Db | 2026-11-22 | the owner | §2 | — → the doc comments of `refresh` and `stale` and the `problem` field's doc in `types/index.d.ts` describe the problem row and the re-read | each said what the code did before the change |
| W3-Dc | 2026-11-22 | the owner | §6 | `at most 1 tree listing + 6 calls × 20 rows per pass` → at most 50 tree listings + 5 calls × 20 rows (150) per pass, no process; 130 measured at 50 trees and 20 rows whose plan dirs never list | the stated bound left out the tree listings beyond the first |
| W3-Dd | 2026-11-22 | default | §2 | `refresh` doc: `a failed discovery draws nothing` → `a failed discovery or pass draws nothing`; `problem` doc: `a file of the row failed to read; every other field but the labels is empty` → the three reads or a plan dir that neither lists nor can be asked whether it exists; only ticket, marker, tree, since and labels set | the fix-review lane ran both sentences: a failed usage call after discovery draws nothing, and the unreadable row keeps its ticket, marker, tree and time |
| W4-Da | 2026-11-22 | default | §8 | — → one review-lane suite run in ten failed one test that was not captured: out of scope, ticket skills-4yek | twelve repeated runs at the head all passed; the code under review was identical to the commit before it |
