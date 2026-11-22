# Lane 3b code review: skills-cm2l (the 15 s check survives a failed pass)

Repo: `/Users/jonathan/Documents/strandic-skills/.worktrees/cm2l`, head `cea5da2`. All runs used copies in `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/c1e1be1d-815d-4a37-964f-d9c10f46049f/scratchpad/lane3b/`. Command: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test <copy>`. The `claude-personal` alias expands to that command. The mutant runner is `.../lane3b/scripts/mutate.py <name>`, the attack tests are in `.../lane3b/scripts/attacks.tsx`, and the raw outputs are in `.../lane3b/out-*.txt`.

**Overall:** all 8 listed mutants are killed with exactly the expected counts and test names. Two of my own mutants survive the suite: o1 is a real test gap (a missing `stale:` label would go unnoticed), and o3 is the final catch on the timer, whose path the brief already records as NOT RUN. A third survivor, o4, cannot change behaviour. There is one pre-existing gap in the fix: a failed `.shawarma` listing still stops the check (F5). The rest are prose and comment drift.

**Control (unpatched head copy):** `291 pass` / `0 fail` / `Ran 291 tests across 1 file.` Every mutant below was run after this control.

**The head matches the sketch:** applying `sketch/sketch.patch` to `1eed2e3` gives byte-identical copies of all 5 files (register.tsx, band.test.tsx, README.md, CHANGELOG.md, plugin.json). The code matches §2 2a–2g as written. The 2a row carries ticket, marker, tree, since, isEarlier, isStale and isOtherTree, with `planDir ''`, `step ''`, `title ''`, `decisions 0` and `problem UNREAD`. 2g leaves no remnant: a grep finds no `unread`, no pane count line and no reason string.

## Mutant table

| mutant | expected | observed | failing tests | verdict |
|---|---|---|---|---|
| 2e branch removed (`if (false) {`) | 282/9: N11, C1, C2, C6×3, C9×2, C10 | 282 pass / 9 fail | N11, C1, C2, C6 marker, C6 plan.md, C6 exists, C9 20, C9 40, C10 | kill (as expected) |
| 2e without `plan dir not readable` clause | 289/2: N11, C10 | 289 / 2 | N11, C10 | kill (as expected) |
| m3: no `&& check !== null` | 290/1: G1 | 290 / 1 | G1 | kill (as expected) |
| m4: failed() keeps the hidden counts | 290/1: C4 | 290 / 1 | C4 | kill (as expected) |
| m5: early stop without `lastScan.status !== 'failed'` | 289/2: C4, C5 | 289 / 2 | C4, C5 | kill (as expected) |
| m6: exists without `.catch(() => null)` | 290/1: C3 | 290 / 1 | C3 | kill (as expected) |
| m7: refresh's watch without the failed-scan clause | 290/1: C5 | 290 / 1 | C5 | kill (as expected) |
| m8: problem row `step: 'run'`, `title: 'x'` | 284/7: 21 markers, C1, C2, C6×3, C7 | 284 / 7 | 21 markers, C1, C2, C6 ×3, C7 | kill (as expected) |
| o1 (own, 2a): `isStale: false` on the problem row | — | 291 / 0 | none | **survive** (F1) |
| o2 (own, 2c): failed() does not clear `lastListed` | — | 290 / 1 | C4 | kill |
| o3 (own, 2c): timer without the final `.catch(() => undefined)` | — | 291 / 0 | none | **survive** (F2) |
| o4 (own, 2f): drop `isThere === null \|\|` | — | 291 / 0 | none | survives, but cannot change behaviour (F3) |
| o5 (own, 2c): failed() does not set `lastScan` failed | — | 290 / 1 | C4 | kill |

## Findings

**F1. A stale unreadable row losing its `stale:` label goes unnoticed (o1 survives).** Lane A2 checked the stale label but no test pins it. C7 covers only `earlier session:` and `other tree:`. Under o1, a stale unreadable row reads `earlier session:` instead of `stale:`, which hides that the run probably stopped (the README says stale wins).
- Reproduction: test T1 in `scripts/attacks.tsx`. A trivial marker at `STARTED + 120_000 - 13 h` with `read` failing, then `bash 'true'`, then read the band at 8 rows.
- Head: `["stale: shawarma: skills-s: could not be read"]` (pass).
- o1: `["earlier session: shawarma: skills-s: could not be read"]` (T1 fails, 297/1).
- Base: `[]`.
- New (it comes with 2a).

**F2. The final `.catch(() => undefined)` on the timer (2c) is not pinned by the suite (o3 survives, 291/0).** The brief marks this path NOT RUN. Two runs of mine show the catch does real work:
- T5. A seam patched into the copy's `failed()` makes it throw while `clock.now` rejects (two passes), then the error clears. Head: band `undefined` during, then `"skills-x — the thing · run W1 · since 14:01 · 0 decisions"` one pass later, 4 fs calls, no unhandled rejection. On o3 + seam, T5 also passes.
- With the 7 attack tests appended (any 2 of them suffice), o3 and the base end with `(fail) the file ran to its end` and `a rejection nothing handled: environment 488: $.state.get refused: no hooks module of that name is loaded …`. Head with the same tests: `298 pass / 0 fail`.
- So the base had a latent unhandled rejection: a check from a torn-down environment fires, and its catch handler's state call is refused. The head swallows it. The failure is timing-dependent. Two trivial pad tests did not trigger it on o3. Two row-drawing pad tests triggered it on the base only. It is not a reliable kill.
- Pre-existing on the base; the head fixes it.

**F3. Part of the 2f line is dead code (o4).** After 2e, every `plan dir not readable` row `continue`s before line 657. Only `plan dir not found` rows reach `isChanged = isThere === null || isThere !== row.problem.startsWith('plan dir not readable')`, so the expression is always `isThere !== false`. Dropping `isThere === null ||` cannot change behaviour (null !== false is true). This is a possible simplification, not a defect.

**F4. The 2f code comment is false.** The comment says: `// cm2l: an exists that rejects starts the refresh, which draws the row as UNREAD.` (register.tsx:654). The refresh draws UNREAD only if `exists` rejects again inside `rowOf`. A single rejection draws the not-found row again.
- Reproduction: T2. A not-found row, then `exists` rejects once in the check.
- The pass's calls: `list /repo/.shawarma`, `list /repo/.worktrees/w/.shawarma`, `read …/active-skills-x`, `stat <DIR> resolve`, `exists <DIR>`.
- Band: `"skills-x · 2026-1… · run W1 · since 14:01 · 0 decisions · plan dir not found: /repo/docs/plans/2026-10-16-skills-x-thing"`, not `could not be read`.
- C3's own expectation agrees with this. Base: `undefined`. New.

**F5. A failed `.shawarma` listing during the check still empties the band and stops the check for good.** The ticket covers this class of failure, but §1 does not list this path.
- Reproduction: T7. One tree, a drawn row, then `fail.add('list /repo/.shawarma')` and a 15 s pass, then the error is cleared and the clock advanced 60 s.
- Head: before, the full row. During: `undefined`. After: band `undefined`, **0 fs calls in 60 s**.
- Base: identical readings.
- Cause: `markersOf` reads a failed listing as "no markers", so the refresh finds no rows and `watch($, false)` stops the check. It is not a failed pass. The row comes back only at the next tool call or turn end.
- Pre-existing, same on head and base. It is outside lines 2a–2g, so by §8 it goes to a ticket. It shows no false content, only absence.

**F6. Prose and comment drift (claims check).**
- README: "If the marker, `plan.md` or `decisions.md` fails to read, the row reads only `shawarma: <ticket>: could not be read`". This is incomplete. A fourth cause draws the same row: the plan dir does not list and `exists` rejects. T3, at a tool call with `list DIR` failing and `exists DIR` rejecting: head `"shawarma: skills-x: could not be read"`, base `undefined`.
- README: "For a `plan dir not found` row, the 15-second check only asks whether the folder exists, and an update runs when that changes." This is incomplete. An update also runs when the ask fails (T2: `stat … resolve` and `exists` follow in the same pass).
- register.tsx:583, refresh's docstring: "Never throws: a failed discovery or read draws nothing rather than a stale row." This is now false for a read: C1 draws the problem row. It is unchanged context, not in the hunk.
- register.tsx:620–628, stale's docstring: "A plan dir the row says is not found or not readable … is not listed, only asked whether it exists". This is now false for not-readable rows: N11's pass logs `stat … resolve`, `list`, `exists`. It also does not mention the UNREAD re-read. Unchanged context.
- types/index.d.ts:26–30, the `problem` doc, lists four values and omits `could not be read`. It is not part of the diff.
- Every other sentence in the README and CHANGELOG hunks matches a run:
  - problem row and label: C7, T1
  - "shows nothing it read before": m8 kill
  - re-read each pass: C2 (4 reads in 60 s)
  - full row at the first good check: C1, C6
  - pane adds the path: C8, R2
  - not-readable full update, real path before list: N11, C10
  - failed update leaves the band empty, the check goes on, rows come back: C4, C5
  - the counts are cleared: C4
  - pane lines removed: grep finds none
- Test names and comments are true. The C9 comment ("one listing … then one marker read per drawn row, at most 20") matches T4: 21 calls per pass at 40 markers, only `list` and `read`.

## §3 error surface (my own attacks, all on head)

- A failed file call in a row gives the UNREAD row: C1, C6, and T3.
- A failed pass gives no rows, no counts, the pane line `Shawarma state could not be read.`, and the check goes on: C4.
- A failure in `failed()` is swallowed and the check goes on: T5 (seam), no unhandled rejection. The base's teardown rejection is gone (F2).
- Timer leak: T6. A pass fails for good for 60 s, then the error clears and the marker is deleted. The check stops: band `undefined`, **0 fs calls in the next 60 s**.
- No wrong output was reached through 2a–2g. No problem row carries a step, title or count from before a failed read (m8 kill; the C6 readings).

## Repo state

`git -C /Users/jonathan/Documents/strandic-skills/.worktrees/cm2l status --short` printed nothing (exit 0). HEAD is still `cea5da2`. Nothing in the repo was edited, staged, committed or stashed.
