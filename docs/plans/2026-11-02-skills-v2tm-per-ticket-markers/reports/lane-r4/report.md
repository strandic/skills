# fresh review lane, round 4 (at 7851e73) — saved from the lane's final message (condensed; raw outputs under `$L4`)

`$L4` = `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a1fe7339-7fa8-440d-973c-d1d5d4792ad5/scratchpad/run-v2tm/lane-r4`. Clone `$L4/repo` (191 pass / 0 fail, `$L4/base.out`); probe mod `$L4/probe` (7851e73 hook bodies as top-level functions, fs call logging, `HANG` 3 s delay, `REJ` real rejection, `/v2tmr4` script runner); `$L4/run.sh`, `$L4/runp.sh`, `$L4/mut/` (`mutants.py`, `summary.txt`). Oracles: observed call logs and the real handlers' pane text.

| id | command | raw reading | verdict |
|---|---|---|---|
| 1 missing → link out | `$L4/run.sh $L4/w-miss` | PRE1 pane `shawarma: a1: plan dir outside its tree (…/active-a1)`, calls `["stat …/later resolve"]`; check `list .shawarma`, `exists …/later`, refresh `read active-a1`, `stat …/later resolve` → outside; no list or read of `later`; link back inside stays outside (cached; safe); in-flight pane outside | fixed |
| 2 hanging stat | `$L4/run.sh $L4/w-late $L4/w-late/HANG` | cold 6024 ms; steady 4 ms (was 4008); check 2 ms; turn end 6023, session start 6028 ask again; same-turn rewrite 2009 ms; prune ok; re-add 2013 ms | fixed |
| 3 untested | `$L4/mut3` | M3b, M31, M16, M3 each 190/1 killed; M3a now equivalent | fixed |
| 4 docs | reading | the four sentences match | mostly; C–G |
| cost W=2 M=3 | `w-cost` | cold 19/19, steady 8/8, check 5/5 (0 stat), plan files changed 14/14, rewrite 9, next turn 10 | at the bounds |
| cost missing | `w-miss`, `w-swap` | cold 5 ≤ 7; check list + exists, no stat; steady 6 = W+2M+1 | within |
| time | `w-late`, `w-phang` | first call of a turn 2 s per hanging root and row in series; steady 4 ms; pane 2.0 s on every draw | C |
| not readable → listable | `w-unr` | check `exists` only, no refresh; band keeps `not readable` until the tool call; pane stats (inside), lists, reads, shows `U SECRET` | nothing outside read; band and pane disagree until the next call |
| pane, link into another tree | `mw/probe-xtree` | outside line, then the check turns the row outside | pass |
| pane late or rejected | `mw/probe-plate`, `mw/probe-rej` | read as missing; only the stat | pass |
| press after a failed refresh | — | not producible on the real engine; by code the pane returns on `failed` before any call | not executed |

## Findings
- **A (medium-low)** an inside plan folder deleted and replaced by a link out is read through the cached inside real path: `$L4/w-swap` (s1 `docs/plans/s`; `del` → `plan dir not found`; `lnout` → link to `$W/outside/p`); the next check's `exists` starts a refresh, `isPlanInside` hits `realDirs` (same marker and time), lists and reads outside: band `s1 · x — OUTSIDE TITLE`, pane `OUTSIDE SECRET`; lasts until the marker is rewritten. Pre-existing path, now reached in 15 s. Fix: drop the marker's `realDirs` entry when its plan dir does not list.
- **B (medium)** 13 surviving non-equivalent mutants on the changed lines. Reading outside on the real engine: N16 (pane: drop `isMissing = real === null`; `mw/N16-…-rej` → `OUTSIDE SECRET`), N17 (pane guard only `not found`), N22 (check guard only `not found` → `list …/xREJ`), N23 (pane late → path as written → `OUTSIDE SECRET`), N25 (pane compares with the session's own tree's real path → `MAIN TREE BODY`). Others: N3 (late key without time), N11 (check `= exists`: refresh every check, 5 calls vs 2), N20 (pane stat unraced: 3006 ms), N15 (pane root as given: false outside), N21 (problemLine drops the header), N4, N6, N7.
- **C (low)** the pane ignores `lateDirs`: 2 s per pane draw on a hanging not-found row; README says once per turn.
- **D (low)** `realDirs` comment (register.tsx:57–63) says a late stat is asked again next time.
- **E (low)** README "the pane and the 15-second check list and read nothing in that folder either" — the pane does when its own stat finds it inside.
- **F (low)** `stale()` and Pane comments "was never confirmed inside" — false for a not-readable row whose real path is cached, and for A.
- **G (low)** README "one call can reach outside": `exists` and the pane's stat also follow links; "2 seconds once per turn": a same-turn rewrite or a hanging root adds more.

## Mutants
Killed: N1, N2, N5, N9, N10, N12, N13, N14, N19; round-3 M3, M3b, M31, M16, M6. Survive: N3, N4, N6, N7, N11, N15, N16, N17, N20, N21, N22, N23, N25. Equivalent: N24, M3a; M13, M15, M18 as in round 3.

## Call sites
`lateDirs` :71, :248, :253, :330, :427, :449 · `isPlanInside` from `rowOf` :283 (the Pane has its own stat :536) · `stale` from `watch` :370 · `problemLine` :528, :538 · `within` :94, :100, :250, :536 · `lastTrees` set :350, read by `stale` and the Pane :538 · `parseMarker` `rowOf` :274.

Status: empty; HEAD 7851e73.
