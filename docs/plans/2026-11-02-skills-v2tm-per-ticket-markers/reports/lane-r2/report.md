# fresh review lane, round 2 (at 062cffd) — saved from the lane's final message (condensed; raw outputs under `$S`)

`$S` = `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a1fe7339-7fa8-440d-973c-d1d5d4792ad5/scratchpad/run-v2tm/lane-r2`. Base 175 pass / 0 fail. Oracles: fixture strings and literal strings; no `isInside`/`resolvePath`/`parseMarker` used for expected values.

| id | command | raw reading | verdict |
|---|---|---|---|
| F1 re-run | `$S/fx-f1.sh $S/w-f1 && $S/run.sh $S/w-f1` | h1 (`docs/plans/h -> …/outside/p`), h2 (`via -> ../outside`): `earlier session: shawarma: hN: plan dir outside its tree`; no list/read under the links | fixed |
| F2 re-run | `$S/fx-f2.sh $S/w-f2 && $S/run.sh $S/w-f2` | p1 `/tmp`-spelled line 1: `p1 — inside via tmp · run W1 · … · 1 decision`, pane `INSIDE RECAP`; p2 (folder absent): `plan dir outside its tree` | fixed |
| F3 re-run | kit R2 tests | `1 marker could not be read.` / `2 markers could not be read.` | fixed |
| swap after first check | `$S/fx-att.sh $S/w-att && $S/run.sh $S/w-att` (b1) | `earlier session: b1 · x — OUTSIDE TWO …`, pane `OUTSIDE SECRET 2`; after the marker rewrite: `plan dir outside its tree` | the stated residue, as stated |
| absent folder later made a link out | same run (a1) | cold `plan dir not found`, cache `real:null`; after `ln -s …/outside/p docs/plans/later`: `earlier session: a1 · x — OUTSIDE TITLE …`, pane `OUTSIDE SECRET` | **Finding A** |
| new folder, same time | same run (c1, `touch -r`) | re-stat; `plan dir outside its tree` | ok |
| cache bound | same run, +25 markers then −25 | entries 3 → 23 → 3 | bounded |
| cost, real | same run | cold W=1,M=3 13 ≤ 16; 25 new markers 61 ≤ 101; check 4, no stat; steady 8 vs 7 from the pre-existing `exists` on a missing plan folder | ok on changed lines |
| cost, kit L4 | W=3,M=2 and W=6,M=4, all rewritten | ≤ W+5M, exactly M resolve-stats; steady and check 0 stat | pass |
| tree root in another case | `$S/fx-case.sh $S/w-case && $S/run.sh $S/w-case` | git lists `…/WTS/w` (disk `wts`); realPath `…/wts/w/docs/plans/w`; row `plan dir outside its tree`; pre-fix control (8bb457d) drew `k1 — case worktree inside …` | **Finding B** (regression) |
| tree root through `/tmp` (fallback walk) | `$S/fx-root.sh $S/w-root`, `GIT_DIR=/nonexistent` | `/tmp`-spelled roots: m1, w1 `plan dir outside its tree` | Finding B, second route |
| case alias in line 1 | same run | engine realPath canonicalises case (unlike the d.ts note) | engine note |
| realPath withheld | kit L5 (`noReal`, link out) | `w-1 — FORGED · run W1 …` | as R1 says; the API doc advises denying here |
| pane no-row order | kit L3, 20 picked unreadable | band `+1 more not shown`; pane `20 markers could not be read.` | pass |

Kit attacks L1–L7: `$S/kit/tests/band.test.tsx` (describe `lane r2 attacks`); `$S/kit.out` 179 pass / 3 fail (L1, L5, L6); `$S/kit2.out` 179 / 4 (with L7).

## Findings
- **A** a plan folder with no real path at the first check is not asked again until the marker changes; a link made later leads outside (kit L1, L6; real a1: `OUTSIDE TITLE`, `OUTSIDE SECRET`). Cause: `real: null` cached, `hit.real ?? dir` then passes the text check. Candidate: don't cache a null real path (m16: 175 green, L1, L6 green); cost one stat per pass per row with a missing folder.
- **B** the real path is compared with an unresolved tree root: an inside folder is refused when git or the walk spells the root differently (case, `/tmp`). Fix: resolve each root the same way, or compare with both.
- **C** mutants m2 (drop the `hit.dir` key) and m10 (unread sentence after `No row drawn`) survive the repo suite; L2, L3 kill them.
- **D** docs: D1 README "a file rewritten with the same file time" waits for the next tool call — false for `plan.md`/`decisions.md` in the band (cached by path and time; kit L7 `r-1 — old …`); D2 "Two parts are added" before three bullets; D3 `parseMarker` doc names `isInside` as the caller's check; D4 "title starts with the ticket" vs `namesTicket` (ticket then space or end).

## Mutants (`$S/mut/`)
m1 drop cache killed · m2 drop `hit.dir` **survives** · m3 drop `hit.at` killed · m4 `real ?? dir` → `dir` killed · m5 deny with no real path killed (6 missing-folder tests) · m6 stat without resolve killed · m7 drop the stat's reject handler killed · m8 drop the prune survives (memory only; real 23 → 3) · m9 prune all killed · m10 unread after `No row drawn` **survives** · m11 always `markers` killed · m12 drop unread killed · m13 unread before `No scan` equivalent · m14 cache keyed by root killed · m15 text-only killed · m16 no null caching: fix candidate for A.

## Call sites (062cffd)
`isPlanInside` register.tsx:205, caller `rowOf` :235 · `realDirs` :59, :206, :210, pruned :280 in `snapshot` · `snapshot` :272, caller `refresh` :301 · `rowOf` :221, caller `snapshot` :286 · Pane render :445 (unread :459–461), via `openOn` :362 from press :435 and command :403 · `isInside`: `ownTree` in model.ts and tests.

Worktree status: only ` M .beans/…skills-v2tm…md` plus the orchestrator's untracked `.beans/skills-0wsk…md` and `reports/run/lexfirst/`.
