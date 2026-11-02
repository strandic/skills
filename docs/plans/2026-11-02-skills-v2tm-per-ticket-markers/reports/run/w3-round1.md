# Wave 3, review round 1 (at 8bb457d) — labels

Lanes: 3a `reports/lane-3a-run/report.md`, 3b `reports/lane-3b/report.md`.

| finding | label | note |
|---|---|---|
| 3a F1 = 3b F1: a linked folder inside the tree leads the plan dir outside; band and pane read the outside `plan.md`/`decisions.md` | RULING | plan-step-3 (c)/(d) class (a leak; wrong README claim). Every fix adds a file call on the cold path and breaks Q6's W + 4M (readings below). |
| 3a F2: an absolute line 1 spelled `/tmp/…` (git gives `/private/tmp/…`) reads `plan dir outside its tree` | RULING (with F1) | wrong output (the folder is inside); the real-path check of F1 fixes it. |
| 3b F2: no row drawn while a listed marker could not be read → pane `No shawarma marker in the last scan.` | RULING | wrong output; the fix edits frozen §3 2i. |
| 3b F3: mutants d6–d10 survive (ownTree boundary, planFiles' two list-failure branches, timeIn `kind === 'file'`, isInside root `/`) | APPLY | guards that kill each, from the lane's probes P2–P6; no behaviour change. |
| 3b F4: claims check (README rows template, `1 worktree`, `plan dir not readable`, bare records, "within 15 seconds", types and doc comments, manifest description) | APPLY | prose only. |
| 3b not reproduced: a throwing check does not reset the hidden counts | TICKET | by reading only; the kit cannot make the check throw. |
| 3b d3 (timeIn without `isLink`) survives | DECLINE false-positive | equivalent: a link lists as kind `other` (claude-code.d.ts:5119-5121). |

## Fix-shape readings for F1 (executed, scratch `fix-probe/`, W=3 M=2 and W=6 M=4 cost test with counts printed; `fix-probe/*-counts.txt`)

| shape | cold (session start) | plan files changed | steady | check | suite |
|---|---|---|---|---|---|
| 8bb457d (no fix) | 11 / 22 (bound 11 / 22) | 11 / 22 | 7 / 14 | 5 / 10 | 162 pass |
| `stat {resolve}` of the plan dir every pass | 13 / 26 | 13 / 26 | 9 / 18 | 5 / 10 | 156 pass / 6 fail (Q6 ×2, the W + 3M names ×4) |
| the same, cached per marker path and marker time | 13 / 26 | 11 / 22 | 7 / 14 | 5 / 10 | 156 pass / 6 fail (the cold path only) |
