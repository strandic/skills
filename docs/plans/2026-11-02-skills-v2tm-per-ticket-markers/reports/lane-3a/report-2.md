# lane 3a (plan-time), round 2 — saved from the lane's final message

Read-only. f1fc87e + the new `sketch/sketch.patch` (2135 lines), fresh checkout; `claude plugin test .` → 131 pass, 0 fail. Engine 2.1.316; git 2.48.1 (Homebrew) and Apple git 2.54.0; no git older than 2.36 found (old `-z` behaviour via a fake `git`).

Scratch `S=/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a1fe7339-7fa8-440d-973c-d1d5d4792ad5/scratchpad/attack-v2tm`. Attack file `$S/repo/mods/shawarma-companion/tests/attack2.test.tsx` + fixture `tests/realz.ts` (real `-z` output); own fake world. `$S/atk2` → 51 pass (readings `$S/attack2b.err`, `$S/attack2c.err`); `$S/atk5/tests/a5-{0..9}.test.tsx` (A5 split; one file passed the 600 s limit) → 1500 pass, 193 s (readings `$S/a5.err`). Real-engine probes: `$S/dumpmod2`, `$S/fakebin-hang/git` (`sleep 10`), `$S/fakebin-old/git` (exit 129, `unknown switch 'z'`).

**Oracle check.** A5 recomputes rows, labels and order from the fake fs and clock, calling no sketch function. One oracle bug (a tree added twice counted twice, `wtAdd,wtAdd,turnEnd`) excluded, not a finding. The spike's geometric table was not found in D; the cost spot-check uses the lane's own sizes.

## Earlier findings
| id | status | reading |
|---|---|---|
| F1 | fixed | real `-z` parses `"/S/grepo/a\n\nworktree /S/evil"` as one path; real engine roots main, that path, vialink; no injected row. Truncated → fallback (`walk:1`). |
| F2 | fixed in the band; pane not (N2) | band flips to `stale:` within one check after 12 h (29000 ms after the mark at 15 s sampling); a future marker reads `stale:` then current once the clock reaches it. |
| F3 | fixed | `start+1` → earlier; `+0.9999` → earlier; `+1.0001` → earlier (a double at ~1.79e12 has spacing ~2.4e-4 ms; nearest value is `start+1`). |
| F4 | still open (by design) | A5: 84 of 85 violations are `sameMtime` then `check`/`h12`/`future` with no turn end between; drawn step stale; labels right everywhere. |
| F5 | fixed | no bidi control in band or pane for ticket, step, title or plan dir. U+2028 still passes (N6). |
| F6 | fixed | see R-A7. |
| F7 | fixed (Q6) | W=100, M=200: cold 130 = 50 + 4·20, steady 90, check 70. |
| F8 | fixed | fail → same turn `[]` (cached roots) → fixed in the same turn `[]` → after the turn end `live · trivial`. No repo: the 102-level walk reruns each turn end (102 stats per turn, 0 per call). |
| F9 | fixed | kit `timeoutMs=2000`; not done at 1999 ms, done at 2000 ms; an answer after the timer is ignored until the next turn; one at 1999 ms is used. Turn end with a hung git: 2000 ms. Real: hung git `refreshMs=2005` → fallback; old git `refreshMs=10` → fallback. |
| F10 | fixed for widths ≥ label + ticket | widths 10/20/30/40/60 → `stale: sk…`, `stale: skills-v2tm …`, … Below the label's width the ticket is cut, the label kept (N7). |

## Lines
| id | command | raw reading | verdict | |
|---|---|---|---|---|
| R-A1 | hostile names: empty, 4096×z, `U+202Eevil`, `U+2066isoU+2069`, `a\nb`, `ls` U+2028 `sep`, 70 emoji, `..` | empty → no row; no bidi in any row; `a b`; U+2028 drawn; z and emoji rows len 120; no lone surrogate | holds; N6 | own |
| R-A2 | step RLO, title RLO, title LRI, dir RLO not found | control drawn as a space; `bandBidi:false`, `paneBidi:false` ×4 | holds | — |
| R-A3 | parser: real `-z`, empty, `\0` only, newline form, odd/no trailing NUL, single NUL between records, relative, double space, head not `worktree`, `prunable` in a branch name, `/`, `///`, bare; engine: exit 129, exit 0 newline form, exit 0 empty, truncated | null for empty, `\0` only, newline form, head-not-worktree; odd/missing trailing NUL → `/a`; single NUL between records → `/b` lost (git cannot emit it); relative and `worktree  /x` skipped; `refs/heads/prunable` not prunable; `/`, `///` → `/`; bare skipped; all four engine cases → fallback, rows `own` only | holds | — |
| R-A4 | F8 retry; no repo | see F8 | holds | — |
| R-A5 | `enumerate:` 10³ = 1000 sequences over {appear, sameMtime, delete, wtAdd, wtRemove, runFails, turnEnd, check, h12, future}, 1200 grading points | 85 violations: 84 F4, 1 oracle bug; 0 label errors; 0 order errors; 0 current rows for a deleted marker | holds except F4 | listed |
| R-A6 | boundaries | age exactly 12 h → current; 12 h + 1 ms → stale; 12 h − 1 ms → current; now+60000 → current; +60001 → stale; +60000.5 → stale | holds (strict `>`) | — |
| R-A7 | caps and costs | W=50,M=1: 50 listed, no more-row. W=51,M=1: 50 listed, `+1 more not shown`. W=1,M=20: 20 rows. W=1,M=21: `+1 more`, cold 81 = 1+4·20. W=60,M=30: cold 130, steady 90, check 70, `+20 more`. W=100,M=200: cold 130, `+130 more`. Own marker as 21st newest: drawn first, `+6 more`. **Only marker in tree 51: `[]`, no more-row. 3 markers hidden in tree 51 → `+1 more`. 52 trees, marker-less past 50 → `+2 more`. Hidden marker touched each period: 41 ops per check (bound W+M = 21; unchanged 21).** | caps hold; N3, N4 | own |
| cost.md | geometric spot-check in a kit subprocess (`timeout`; no `ulimit -v` on macOS), W∈{8,64} × M∈{8,256}, 10 calls each | ops per call 24/48/66/90 = min(W,50) + 2·min(M,20); ms per 10 calls 16/50/52/80; peak RSS 271056896 B (51 tests), 292405248 B (1500 tests) | holds | — |
| R-A9 | hang; late; early; turn end | see F9 | holds | — |
| R-pane | chosen live marker pushed out of the top 20; chosen stale row; stale row in the pane | pushed out: `k5Exists:true`, pane `k5: no longer active`. Stale chosen: band `stale: old — y …`, pane `**old — y** · run W1` (no label); pane of `dead` lists `Other live tickets: old` (old stale); `Other live tickets: dead` while the band shows `stale: dead` | N1, N2 | own |

## New findings
- **N1** the pane says "no longer active" for a live run pushed past MAX_ROWS (`chosen` matches no drawn row). Wrong output. Repro `R-pane chosen live marker pushed out of the top 20` → `{"k5Exists":true,"pane":"k5: no longer active"}`. Fix: tell gone from hidden, or say "not shown".
- **N2** the pane presents stale and earlier rows as live (D5 a, Q5 on the pane): no label on the title line; `Other live tickets:` lists stale/earlier tickets. Repro `R-pane chosen stale row`, `R-A6 stale row in the pane`.
- **N3** `+n more not shown` mixes units (markers unread + trees unscanned) and can be absent: 3 markers in an unscanned tree → `+1`; 2 marker-less unscanned trees → `+2` with nothing hidden; markers only in unscanned trees → nothing drawn and no more-row (`rows.length === 0` returns early) although Q6 says one dimmed row past either cap. Repro `R-A7 51 trees, the only marker in the 51st`, `… markers in tree 1 and 51`, `… 52 trees no markers past 50`.
- **N4** a refreshing check breaks Q6's check bound: `lastListed` covers hidden markers, so one hidden marker rewritten every period makes each check re-read all 20 drawn rows: 41 ops vs W+M = 21, nothing drawn changes. Either count a refreshing check as "changed" (W+4M) or sign only the drawn markers plus the hidden count. Repro `R-A7b plan markers, a hidden marker touched each period` → `[41,41,41,41]`, unchanged 21.
- **N5** git without `-z` (< 2.36) always falls back; sibling worktrees missed silently (acceptable direction); README should say so. Real old git NOT RUN.
- **N6** U+2028/U+2029 pass `clean`; U+2028 drawn. Terminal effect NOT RUN. Low.
- **N7** at very narrow widths the ticket is cut before the label (`stale: sk…`). Low.

Spike rules: cost.md now applied by caps and tests (spot-check matches). q5 follow-ups for `chosen` vs a hidden marker (N1) and for `hiddenAtom` (N3) not applied. Nothing committed or pushed.
