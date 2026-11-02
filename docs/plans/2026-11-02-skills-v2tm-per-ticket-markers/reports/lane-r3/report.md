# fresh review lane, round 3 (at 3ca75c7) — saved from the lane's final message (condensed; raw outputs under `$L`)

`$L` = `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a1fe7339-7fa8-440d-973c-d1d5d4792ad5/scratchpad/run-v2tm/lane-r3`. Probe mod `$L/probe` (3ca75c7 + `/v2tmr3`, logging fs hooks, a 3 s HANG hook); runner `$L/run.sh`; fixtures `$L/fx-*.sh`; mutants `$L/mut/`. Base 184 pass / 0 fail.

| id | command | raw reading | verdict |
|---|---|---|---|
| F1 | `$L/fx-f1.sh $L/w-f1 && $L/run.sh $L/w-f1` | `/net/v2tm-r3-nohost/p`, `../clone-evil/p`, `docs/../../outside/p`, `/tmp`-spelled inside → each `plan dir outside its tree`; no call names `/net`, `clone-evil`, `outside`; cold 10, steady 7, check 2 | fixed |
| F2 | `lane-r2/fx-att.sh $L/w-att && $L/run.sh $L/w-att` | after the refresh a1 `plan dir outside its tree`; before it (PRE-step1) the pane read `OUTSIDE TITLE … OUTSIDE SECRET` | fixed for the refresh; N1 |
| F3 case | `lane-r2/fx-case.sh $L/w-case` | `WTS/w` real `…/wts/w`; `k1 — case worktree inside …`; cold 8 ≤ 9, steady 4, check 3 | fixed |
| F3 /tmp | `lane-r2/fx-root.sh $L/w-root`, `GIT_DIR=/nonexistent` | `/tmp` roots resolve; w1, m1 inside; c1 (`MAIN` case alias in line 1) outside; cold 30 ≤ 46, steady 16 ≤ 19, check 8 | fixed |
| F4 | mutants M7, M9 | 183 / 1 each | fixed |
| F5 | reading | title rule, "Three parts", same-time sentence for rows | fixed; N5 |
| link root | `$L/fx-lroot.sh` | root `…/lnk/w` real `…/real/w`; k1 inside; x1 (in-tree link to main's folder) outside, no list or read | as specified |
| race | `$L/fx-late.sh $L/w-late && $L/run.sh $L/w-late $L/w-late/HANG` | hanging root used as given; h1, h2 outside, not kept, late answers unused; cold 6022 ms, steady 4008 ms, next turn 6041 ms, check 2 ms no stat | as specified; N2 |
| cost | `$L/fx-cost.sh $L/w-cost` (W=2, M=3) | first call of turn 19 ≤ 19; plan files changed 14 ≤ 14; steady 8 ≤ 8; check 5 ≤ 5, 0 stat; marker rewritten 9 | within bounds |
| missing folder | w-att steady (W=1, M=3) | 8 (read, stat, exists for the missing row) vs W+2M 7 | allowed by R3 (4) |

## Findings
- **N1 (medium)** after a missing plan folder becomes a link out, the pane reads the outside files and the 15 s check lists the outside folder until the next refresh. `$L/fx-miss.sh $L/w-miss && $L/run.sh $L/w-miss` → `PRE-step1 PANE a1 ["# x — OUTSIDE TITLE\n\n## 1. What\n\nOUTSIDE SECRET\n",null] calls=["list …/docs/plans/later","read …/docs/plans/later/plan.md"]`; check `["list …/.shawarma","list …/docs/plans/later",…]`. D11 says nothing there is listed or read "by the refresh, the check or the pane". Cause: `rowOf` keeps `planDir` for `unknown`/`not found` rows (register.tsx:277); `planFiles` (:137, pane :515) and `stale` (:381) list it unchecked. Up to 15 s with the band on; until the next tool call or turn end with it off.
- **N2 (low)** a hanging plan or root stat is asked again each refresh, each waiting 2 s, in series: 2 rows `steady ms=4008`; 1 root + 2 rows `ms=6022`; worst M=20 ≈ 40 s per tool call, W=50 ≈ 100 s per turn start.
- **N3 (low)** an in-tree link still makes the stat (and `exists`) follow it outside (an automount through a link); the README covers outside "as written" only.
- **N4 (low)** surviving non-equivalent mutants: M3a (keep a late answer as outside), M3b (keep a no-real-path answer as outside), M31 (root stat without the race), M16 (resolve every root, not only scanned).
- **N5 (low, docs)** parseMarker doc names `isPlanInside` the caller (it is `rowOf`); README "lists and reads nothing in that folder for that update" holds for the refresh only (N1); "Two limits" omits case-alias spellings and a real-path line 1 against a `/tmp`-spelled root; "the skill writes relative paths" (SKILL.md:19 says "the plan dir"); `plan dir not readable` now also when the stat rejected; the same-time sentence false for the pane (`planFiles` uncached); register.tsx:47 cache also cleared at session.start.

## Mutants (`$L/mut/<name>.out`)
Killed: M1 (8 red), M2 (2), M4, M4b, M5, M17, M10, M28, M6, M7, M8, M9, M11 (7), M14 (2), M21, M24, M25 (4), M27 (65). Survive: M3/M3a/M3b, M31, M16 (N4). Equivalent: M13, M30, M15. M18 memory only.

## Call sites
`within` :74 (callers `run` :87, `realOf` :93, `isPlanInside` :241) · `realOf` :92 (`discover` :170) · `isPlanInside` :235 (`rowOf` :270) · `discover` :155 (`refresh` :335) · `fallback` :203 · `rowOf` :256 (`snapshot` :322) · `snapshot` :308 (`refresh` :337) · `Trees` :46 … `reals` read at :322 · `realDirs` :64, :239, :245, :316 · unchecked plan-dir readers `planFiles` :137 (pane :515), `stale` :381.

Pre-existing: in the fallback, a `.git` file spelling `/tmp` scans the same worktree twice (`/tmp/…/w`, `/private/tmp/…/w`); its rows draw twice.

Status: ` M .beans/skills-v2tm--…md` only.
