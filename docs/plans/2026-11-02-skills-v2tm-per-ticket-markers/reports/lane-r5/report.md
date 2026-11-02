# fresh review lane, round 5 (at cf81e08) — saved from the lane's final message (condensed; raw outputs under `$L5`)

`$L5` = `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a1fe7339-7fa8-440d-973c-d1d5d4792ad5/scratchpad/run-v2tm/lane-r5`. Clone `$L5/repo` (207 pass / 0 fail); probe `$L5/probe` (round-4 probe + `git diff 7851e73 cf81e08`; `SLOW` 1.5 s stat, `XH` hanging exists, `pane-turnend`, `checkrace`); `$L5/probe-r4` at 7851e73; fixtures `$L5/mk.sh`, runner `$L5/runp.sh`; mutants `$L5/mut/`. Oracles: fixture strings and the probe's own fs call counts.

| id | command | raw reading | verdict |
|---|---|---|---|
| F1 | `$L5/runp.sh $L5/probe $L5/w-swap` | after the link: `REAL [active-s1 → $W/outside/p]`, row `shawarma: s1: plan dir outside its tree`; panes outside line, `calls=[]`; no `OUTSIDE` text | fixed |
| F2 | `w-phang` | P1 2007 ms; P2, P3 1 ms, `calls=[]`; next turn one stat 2021 ms | fixed |
| F3 | round-4 mutant list | all 13 killed | fixed |
| F4 | reading | four sentences match, gaps L4, L5 | mostly |
| A1 | `w-swap2` (delete + link out between two updates) | check → band `s1 · x — OUTSIDE TITLE`, pane `OUTSIDE SECRET`, `list …/s`, `read …/s/plan.md`; after turn end too | reads outside: the documented limit (M1) |
| A2 | `w-pt` (pane stat in flight at turn end) | the late write lands after the clear; a folder then created inside reads outside until a second turn end | L1 |
| A3 | `w-hide` | pane-late, folder created inside: outside until turn end, `calls=[]` | as designed; L2 wording |
| A4 | `w-unrslow` vs `w-unrslow-r4` | cf81e08 every refresh ~1510 ms; 7851e73 5, 4, 3, 3 ms | L3 |
| A5 | `w-exh` | `CHECKRACE NO ANSWER in 5000 ms` ×2; engine `fs.exists hook skipped: ran past its 10s budget` | L4 (pre-existing round-4 line) |
| A6 | `w-q2` vs mutant | cf81e08 outside line; Q2 `OUTSIDE TITLE` / `OUTSIDE SECRET` | Q2 survives (M2) |
| A7 | `w-q13` vs mutant | cf81e08 missing, `calls=[]`; Q13 `OUTSIDE SECRET` | Q13 survives (M2) |
| A8 | `w-q9` vs mutant | cf81e08 `plan dir not found`; Q9 `plan dir outside its tree` | Q9 survives (M3) |

## Findings
- **M1 (medium, documented limit)** an inside folder replaced by a link out between two updates, marker unchanged: the check lists through the link, the refresh trusts the kept real path and reads outside (A1). README: "A link changed later, while the marker stays the same, is seen only when the marker is rewritten."
- **M2 (medium, test gap)** Q2 (drop the kept real path only when not found) and Q13 (a kept late record counts as inside) pass 207/207 and read outside on the real engine.
- **M3 (low, test gap)** Q9, Q14 change visible text; Q6, Q7 conservative.
- **L1 (low)** a pane late write landing after the turn-end clear outlives its turn (A2); the refresh's own late write can race the same way.
- **L2 (low, wording)** a pane-only late answer labels a not-found row `plan dir outside its tree` for the turn.
- **L3 (low–medium)** R5 (a): a slow (< 2 s) real-path stat on an unreadable row is paid on every refresh (~1.5 s per call vs ~4 ms before).
- **L4 (low, pre-existing)** `$.fs.exists` in the check, the refresh and the pane has no 2 s limit (A5).
- **L5 (low)** comments and README on "until the turn ends" / "2 seconds once per turn" (A1, L1, L3).

## Mutants
Killed: N1–N7, N9–N17, N19–N23, N25, Q1, Q3, Q4, Q5, Q8, Q10, Q11. Survive: N24 (near-equivalent), Q2, Q13 (read outside), Q9, Q14 (wrong text), Q6, Q7 (conservative), Q12 (equivalent).

Status: `?? reports/gate/` (the orchestrator's); HEAD cf81e08.
