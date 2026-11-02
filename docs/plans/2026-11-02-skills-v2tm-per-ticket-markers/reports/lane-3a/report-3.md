# lane 3a (plan-time), round 3 — saved from the lane's final message

Narrow pass on the lines changed for N1–N6, plus a regression re-run of the 1000-sequence A5 oracle. Read-only. f1fc87e + `sketch/sketch.patch` (2294 lines), fresh checkout; `claude plugin test .` → 141 pass, 0 fail.

Scratch `S=/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a1fe7339-7fa8-440d-973c-d1d5d4792ad5/scratchpad/attack-v2tm`. Attack file `$S/repo/mods/shawarma-companion/tests/attack3.test.tsx` (round 2's own fake world), run from `$S/atk3` → 17 pass (readings `$S/a3.err`). A5 re-run `$S/atk5r/tests/a5-{0..9}.test.tsx` → 1500 pass, 197 s (readings `$S/a5r.err`).

| id | command | reading | verdict | |
|---|---|---|---|---|
| N1a | 25 markers, press `row:k5`, 5 newer markers push it past 20 | `k5: not shown (past the 20-row limit)` | fixed | — |
| N1b | chosen marker deleted | `a: no longer active` | holds | — |
| N1c | 61 trees; the chosen marker's tree moves past MAX_TREES (git order changes) | band `own …`, `11 worktrees not scanned`; `xLive:true`; pane `x: no longer active` | R3-1 | own |
| N1d | 2 markers; the chosen marker's read fails | band `b · trivial`; pane `a: not shown (past the 20-row limit)` | R3-2 | own |
| N1e | after a press, `session.usage` rejects (refresh fails) | band `[]`; pane `No shawarma plan or run is active.` | D5 b; R3-3 | own |
| N1 reload | `lastPaths` across a reload / before any listing | NOT RUN (the kit cannot reload, pi0y L12). By code: after a reload `chosen` and `rows` may persist while `lastPaths` is empty until `session.start` refreshes; a pane render then says `no longer active` for a hidden live marker | NOT RUN | — |
| N2 | chosen rows stale, earlier, current, malformed | pane `stale: **stl — y** · run W1`, `earlier session: **erl** · trivial`, `**cur** · trivial`, `stale: shawarma: bad: malformed marker (…)`; header `Other tickets: erl (earlier session), cur, bad (stale)`; no "live". Band malformed row `shawarma: bad: malformed marker` (dimmed, no `stale:` word) | fixed; R3-4 | own |
| N3a | the only marker in tree 51 | band `[{"text":"1 worktree not scanned","dim":true}]`; pane `No shawarma plan or run is active.`; a marker then appearing in a scanned tree while idle: still `1 worktree not scanned` after 30 s (no check runs with zero rows) | more-row fixed; R3-3 | own |
| N3b | `moreText` | `null`, `+1 more not shown`, `+3 more not shown · 1 worktree not scanned`, `2 worktrees not scanned`, `+130 more not shown · 50 worktrees not scanned` | fixed | — |
| N3c | 25 markers, 52 trees, bodyColumns 20 | 21 texts, last `+5 more not shown ·…` (fits 20) | holds | — |
| N4a | hidden marker touched, stays hidden | 22 ops (W 2 + M 20), 0 reads; bound 22 | fixed | — |
| N4b | hidden marker rises into the top 20 | first row `k00 · … · run RISEN`, `+5 more`; 43 ops (a refreshing check) | holds | — |
| N4c | two hidden markers swap mtimes | 22 ops, 0 reads | holds | — |
| N4d | a hidden marker deleted | `+5 more` → `+4 more` within 15 s | holds | — |
| N4e | own tree's marker (oldest of 26) rewritten | first row `own · x · run OWN2`; 43 ops | holds | — |
| N4f | 25 markers, one of the top 20 unreadable | 19 rows + `+5 more not shown` (the dropped row neither replaced nor counted) | low, D5 b | own |
| N6 | `clean` of U+2028, U+2029, U+0085 → `a b`; band and pane with them in ticket, step, title, recap | `bandSep:false`, `paneSep:false`; U+200B, U+FEFF, U+00AD still pass (invisible, no reordering) | fixed | — |
| A5 | `enumerate:` 1000 sequences, 1200 points | 85 violations over 58 sequences, same as round 2: all F4 plus the lane's own oracle bug; 0 label/dim errors; 0 order errors | no regression | listed (F4) |

## Findings
- **R3-1** pane `no longer active` for a live marker in a tree past MAX_TREES (`lastPaths` holds only scanned trees' markers; git's order can push a drawn tree past 50). Needs > 50 worktrees: low. Repro `R3-N1c` → `{"xLive":true,"pane":"x: no longer active"}`. Fix: when `hidden.trees > 0`, say "not shown (worktree not scanned)".
- **R3-2** wrong reason when the chosen marker cannot be read: it is in `lastPaths` but not drawn, so the pane blames the 20-row limit with 2 markers. Low. Repro `R3-N1d`.
- **R3-3** "No shawarma plan or run is active." while runs are hidden (more-row alone) or a refresh failed (`rows.length === 0` checked first); also no check runs while only the more-row is drawn, so new markers wait for a tool call or turn end. D5 b direction, but the sentence is false. Low. Repro `R3-N3a`, `R3-N1e`.
- **R3-4** band and pane label a malformed stale row differently (band dimmed without `stale:`; pane `stale: shawarma: bad: …`). Cosmetic. Repro `R3-N2`.

Nothing committed or pushed.
