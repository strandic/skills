# skills-cm2l: lane 3a adversarial review report

Head `cea5da2`, branch `fix/cm2l-check-survives-failure`. The orchestrator's diff of the implementation against §2's sketch is empty, so the A1 stat and A2 stale-label rows were not re-run.

## Result in brief

- **The change holds against every attack aimed at §3's error surface and the earlier `NOT RUN` lines.** Atom reads and writes rejected inside `stale()`, `refresh()`, `claim()` and `failed()` all ran. Each one-off failure gives band `[]` and pane `Shawarma state could not be read.` for one pass, then the full rows come back. No head run had an unhandled rejection. The base leaks one when its catch's write is refused.
- **One own finding of medium weight, pre-existing:** a single failed listing of a tree's `.shawarma` folder still empties the band and stops the check. This is the ticket's symptom, reached by a fourth path that the change does not cover (F1).
- **§6's cost bound is wrong as written.** I measured 130 fs calls per pass, against the claimed 121 (F2).
- Everything else is low: races where an older refresh overwrites a newer one, and limits that come from the state store itself.

## Setup

- Scratch folder: `S=/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/c1e1be1d-815d-4a37-964f-d9c10f46049f/scratchpad/lane3a`.
- Copies:
  - `S/mod`: head, with atom gates added.
  - `S/base`: base from the main checkout, with the same gates.
  - `S/base-catchgated`: `base`, plus a gate on the base catch's un-awaited `update`.
  - `S/modclean`, `S/baseclean`: unpatched copies.
- Probe file in each copy: `tests/probe.test.tsx`, made of `S/harness.tsx` (band.test.tsx lines 1–222, identical on head and base) + `S/common.tsx` + one of `S/probes1.tsx`…`S/probes4.tsx`.
- Command for every run: `cd S/<copy> && CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test .`. Each probe prints `R|id|json`.

**How the atom failures were injected (A3, A4, 2c).**
- The kit's `state.get`/`state.set` hooks fall through to core, and `globalThis` is not shared between the test file and the hooks module. I measured that: a gate based on `globalThis` read 0 hits.
- So I rewrote every `await read($, X)` / `await update($, X, …)` in both copies as `await gate($, op, 'X') ?? await read/update(...)`. `gate` asks `$.fs.exists('/__lane3a/<op>/<atom>')` and throws when the test's `hold` answers true.
- Liveness: D1 counted 4 reads each of `rowsAtom`, `hiddenAtom` and `claimsAtom` in 60 s.
- Side effect: the gate adds an `exists /__lane3a/…` call per atom operation, so 18 existing fs-count tests fail in the gated copies. Every count below leaves those calls out.
- Clean-copy suites with the probe file: head 292 pass / 0 fail, base 278 pass / 0 fail.

**Unhandled-rejection detector.** The kit reports one as `(fail) the file ran to its end` followed by `a rejection nothing handled: <msg>`. Liveness check: a deliberate `void Promise.reject(new Error('deliberate'))` gave exactly that line.

**Oracles.** All of them are independent of the code under test:
- band and pane text, read through `$.ui.mount` from the kit;
- the fake world's call log;
- the kit's own rejection report.

## Planner `NOT RUN` lines re-run: A3 (atom reads and writes), A4 (`failed` refused), and Partition row 2c (`failed` itself rejects)

Setup for every case below (`probes1.tsx`): a row W1 in ROOT, plus a trivial run in WT that shows as the more-row (`claimed: [ROOT]`). The band reads `["skills-x — the thing · run W1 · since 14:01 · 0 decisions","1 run in another worktree"]`. I armed the gate, advanced 15 s, then read band and pane.

In the table, "full row back" means `["skills-x — the thing · run W1 · since 14:01 · 0 decisions","1 run in another worktree"]` again, or the same with W2 where the marker changed.

| case | head: during | head: next pass | base: during → after |
|---|---|---|---|
| AT0 control (no arm, marker → W2) | W2 row + more-row | same | same |
| AT1 read rowsAtom once | `[]`, pane `Shawarma state could not be read.` | full row back; 13 fs calls in 60 s | `["1 run in another worktree"]`, never recovers; 8 fs calls in 60 s |
| AT2 read hiddenAtom once | same as AT1 | same as AT1 | same as AT1 |
| AT3 read claimsAtom once (in `claim`, in `stale`) | same as AT1 | same as AT1 | same as AT1 |
| AT5 update rowsAtom once (refresh in check) | `[]`, pane failed | W2 row + more-row | more-row only, for good |
| AT6 update hiddenAtom once | same as AT5 | same as AT5 | same as AT5 |
| H8 update claimsAtom once (session id changed during check; `hits=1`) | `[]`, pane failed | full row back | more-row only, for good |
| AT4 update claimsAtom once, no id change | gate `hits=0` | — | `NOT RUN` (the write is not reached without an id or claim change; H8 covers it) |
| AT7 update rowsAtom always: `failed()` refused at its first write | `["…run W1…","1 run in another worktree"]` while the marker says W2; pane failed | the same for all 60 s; 16 fs calls in 60 s; W2 back 15 s after disarm | see AT7c |
| AT7c, same with the base catch's write gated (`S/base-catchgated`) | head: band W1 row; 17 fs calls in 60 s; **no unhandled rejection** | — | base: band W1 row; 14 fs calls; **`a rejection nothing handled: injected atom update rowsAtom`** |
| AT8 read rowsAtom once + update hiddenAtom always: `failed()` refused at its second write | `["1 run in another worktree"]`, pane failed | same while armed; full row 15 s after disarm | `["1 run in another worktree"]` for good |
| AT9 update rowsAtom once + update hiddenAtom always | `["1 run in another worktree"]` | same as AT8 | same as AT8 |
| AT10 every rows/hidden read and update always | W1 row (stale step), pane failed, 0 fs calls in 60 s | W2 back after disarm | more-row only |
| AT11 read rowsAtom always | `[]`, pane failed, 0 fs calls per pass | full row 15 s after disarm | more-row only, for good |

**What this shows:**
- §3's "a failure in `failed` → swallowed, the check goes on" holds (AT7, AT7c, AT8, AT10).
- "No new throw leaves the module" holds: no `nothing handled` line in any head run.
- Side reading (out of diff): the render hook throws on a refused `rowsAtom` read, and the engine skips the hook. Seen on head in AT11 and on base in AT10 and AT11. This code is unchanged.

## §6 worst impact (1): a row showing a value from before a failed read

| probe | what it does | head | base |
|---|---|---|---|
| H3a | decisions.md unreadable on even passes, count n = 2…7 | each unreadable pass `shawarma: skills-x: could not be read`; each readable pass `… 3 decisions`, `5 decisions`, `7 decisions` (current) | `undefined` from pass 1 on |
| H3b | the marker flips unreadable and readable while its step changes W2…W7 | unreadable passes show the problem row (W2 pass labelled `stale:`, because my synthetic marker time is in the future); readable passes show `run W3`, `run W5`, `run W7` (current) | `undefined` |
| H3c | plan.md title changes, read fails, then clears | `could not be read`, then `skills-x — title two` | `undefined` after the failure |

**Holds:** no failed read left an old value on screen. The old values found come only from races (F3) and from a refused state write (F4).

## §6 worst impact (2): cost while a pass keeps failing

| probe | head: per pass, 4 passes each | base: per pass |
|---|---|---|
| H7: 50 trees, 20 rows, plan dirs never list | fs=130 runs=0: `list` 70, `read` 20, `stat` 20, `exists` 20 | fs=70: `list` 50, `exists` 20 |
| H7: 50 trees, 20 rows, decisions.md never reads | fs=110 runs=0: `list` 70, `read` 40 | 0 (rows dropped, check stopped) |
| H7: 1 tree, 20 rows, plan dirs never list | fs=81 runs=0: `list` 21, `read` 20, `stat` 20, `exists` 20 | fs=21 |
| H6a: reload with an UNREAD row in state, marker read failing for good | first pass fs=5 runs=1 (the reload's one `discover`), then fs=3 runs=0 ×7; band stays UNREAD | first pass fs=5 runs=1, then 0; band `[]` |
| H6b: reload, `session.cwd` failing for good | fs=0 runs=0 ×8, band `[]`, pane failed; W2 row 15 s after the error clears | stays `[]` |
| H6c: reload, `usage` failing for good | fs=4 runs=1, then fs=2 runs=0 ×7; recovers | stays `[]` |

**What this shows:**
- No process runs in any check pass.
- §6's "at most 1 tree listing + 6 calls × 20 rows" (121) is exceeded: 130 measured (F2).
- From the code, the real ceiling is MAX_TREES (50) tree listings + 5 calls per row × 20 = 150.

## §3 error surface, by attacks of my own

- **H1a (F1).** `fail.add('list /repo/.shawarma')` for one pass, then cleared.
  - Reading, head and base alike: band before `skills-x — the thing · run W1 · since 14:01 · 0 decisions`, during `undefined`, 60 s after the error clears `undefined`.
  - **0 fs calls in those 60 s.** Pane: `No shawarma marker in the last scan.`
  - Confirmed on the unpatched copies `S/modclean` and `S/baseclean` with `S/probes4.tsx`.
- **H1c.** The more-row only, and WT's listing fails once: band `[]`, 0 fs calls in 60 s, on both.
- **H1b.** WT's listing fails once while the own row stays: WT's row is missing for one pass, then back, on both. This reading equals the control's, so it is reported as a reading, not as a pass.
- **H2: the marker reads but the plan dir never lists, in three variants:**
  - other tree + earlier session;
  - own tree + current;
  - other tree + stale.

  Labels follow `labelOf` (for example `other tree: earlier session: skills-x · run W1 · since 13:59 · 0 decisions · plan dir not readable: /repo/.worktrees/w/…`). Head reads 5, then 6 fs calls per pass. After the error clears, the head shows the full row with `2 decisions`. The base keeps the not-readable row (A1+ reproduced). **Holds.**
- **H4: odd ticket names, every marker unreadable.** Names: ESC, newline, `e: could not be read`, U+202E, 200 × `f`, backticks and `**`, `..`, `-`.
  - Head: control characters are cleaned to spaces, for example `shawarma: c d: could not be read` and `shawarma:  evil: could not be read`. One row reads `shawarma: e: could not be read: could not be read`, which is ambiguous but true. The 200-character name is cut with `…`, which hides the problem text. Pane text is cleaned the same way.
  - Base: `[]` and `8 markers could not be read.`
  - **Holds.**
- **H5e: a 2f `exists` rejects late, with a tool call in between.**
  - Head: the not-found row W2 throughout, and the check goes on.
  - Base: band `undefined` after the rejection, and the check stops.
  - **Holds.**

## Interleaving (F3)

- **H5a.** The check's refresh (started by a changed decisions.md time) has its decisions.md read delayed. A tool call meanwhile draws `… 3 decisions`. The delayed read then rejects.
  - Head: `shawarma: skills-x: could not be read` (pane the same) for one pass, then `3 decisions`.
  - Base: band `undefined`, and the check stops.
- **H5b.** A 2e refresh of an UNREAD row has its marker read delayed, and the read answers the old text `run W2`. A tool call meanwhile writes and draws `run W3`.
  - Head, after the late answer: `skills-x — the thing · run W2 · since 14:02 · 0 decisions`. That is a step from before, shown for one pass; the next pass shows `run W3`.
  - Base cannot reach this path: the probe timed out at 5 s with no 2e refresh.
- **H5c.** `stale` is delayed, then throws (`clock.now`). A tool call meanwhile draws W2 and the more-row.
  - Head: `failed()` empties the band, with pane failed, for one pass; then both rows are back.
  - Base: more-row only, for good.
- **H5d.** Pre-existing, the same on both. A check refresh's delayed marker read answers `run W1b` after a tool call drew `run W2`. Band: `stale: skills-x — the thing · run W1b · since 14:03 · 0 decisions` for one pass, then W2.

## Findings

1. **F1: medium · `own` · pre-existing (same on base) · wrong output.**
   - What happens: one failed listing of a tree's `.shawarma` folder during the check hides that tree's rows. When no row or more-row is left, `refresh` sees scan status `ok`, calls `watch(false)`, and the check stops. In H1a, H1c and the clean-copy repro it made 0 fs calls in the 60 s after the error cleared.
   - Wrong output: the pane says `No shawarma marker in the last scan.` while a marker exists.
   - Why it matters: this is the ticket's symptom ("one failed fs call … empties the row and ends the check"), reached through `markersOf`. The failed listing is caught as `null`, read as "no markers", and never counted as a failed pass. §1, A1 and A3 do not list this path.
   - Reproduction: `S/probes4.tsx`, test `H1a`, run in `S/modclean`.
2. **F2: low · `own` · claim error in §6.**
   - With 50 trees and 20 not-readable plan dirs, a pass makes 130 fs calls, above the stated 121 (H7). The bound leaves out the up to MAX_TREES tree listings.
   - The cost is still bounded: about 150 per pass at most, with no process.
   - Base in the same setup: 70 per pass.
3. **F3: low · `own` · races where an older refresh overwrites a newer one.**
   - H5b, new path on head: a 2e refresh shows the old step W2 after W3 was drawn, for one pass. This is wrong output.
   - H5a and H5c: an older failure overwrites a newer success for one pass. Head is better than base, which loses the row for good.
   - H5d: the same race, pre-existing on both.
   - Every case recovers within 15 s on head.
4. **F4: low · `own` · pre-existing (base-catchgated is the same) · limit of the state store.**
   - When every `rowsAtom` write is refused, the band keeps the row from before (W1 while the marker says W2), and the pane says `Shawarma state could not be read.` (AT7, AT7c, AT10).
   - It cannot be fixed inside the mod; it is listed only for §6 (1).
5. **F5: low · `own` · pre-existing.**
   - When `failed()`'s second write (`hiddenAtom`) is refused, the more-row count from before the failed pass stays: `["1 run in another worktree"]` (AT8, AT9).
   - This is skills-0wsk's symptom, but only under a refused state write.
6. **Info · `own` · pre-existing, out of diff.** The render hook throws on a refused `rowsAtom` read, and the engine skips the hook (AT11 head; AT10 and AT11 base).

**Holds (`listed`):**
- A3: atom reads and writes once, AT1–AT6 and H8.
- A4 / 2c (`failed` refused): no unhandled rejection on head; the base leaks one (AT7c).
- §3's error surface.
- The hostile corpus H2, H3, H4, H5e and H6a–c.

## Repo state

I wrote nothing in the repo. `git -C /Users/jonathan/Documents/strandic-skills/.worktrees/cm2l status --short` is not empty. It prints one line, `?? docs/plans/2026-11-20-skills-cm2l-check-survives-a-failed-pass/reports/review-3b/`, which is lane 3b's output folder, not mine. Nothing is tracked or modified. HEAD is still `cea5da2`.
