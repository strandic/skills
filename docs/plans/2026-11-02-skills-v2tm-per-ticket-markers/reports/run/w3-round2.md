# Wave 3, review round 2 (at 062cffd) — labels

| finding | label | note |
|---|---|---|
| security review (automated, on commit): the real-path stat reaches a marker-spelled path before any containment check | RULING | an absolute line 1 makes the mod stat any path (a slow mount holds the refresh; an automount reaches the network). Text check first: `reports/run/lexfirst/` reads 174 pass / 1 fail, the `/tmp` spelling test the one red |
| lane r2 A: a missing folder's null real path is cached; a link made later leads outside | RULING | (c)/(d): a leak; the fix changes R1's "cached per marker path and marker time" |
| lane r2 B: the real path is compared with an unresolved tree root; inside folders refused (case, `/tmp` roots) | RULING | wrong output, regression against 8bb457d |
| lane r2 C: mutants m2, m10 survive | APPLY | guards from L2, L3 |
| lane r2 D1–D4: README and doc claims | APPLY | prose |
| m8 (no prune) survives | DECLINE false-positive | memory bound only; the real engine shows the prune bounds it |

Round-2 hunks touching §3 lines (`git diff 8bb457d 062cffd -- mods/shawarma-companion`, 6 files, +222 −39), was → now:
- behaviour: 2a/D11 `isInside(root, planDir)` on the text → `isPlanInside`: one `stat(dir, {resolve})` per marker path and time, `isInside(root, real ?? dir)` (R1); 2i no-row pane: `<n> marker(s) could not be read.` before `No row drawn` (R2); 2h: a new or rewritten marker ≤ W + 5M (R1, tests).
- prose only: README (row template, more-row, `plan dir not readable`, bare records, 15 s claim, link paragraph, pane list, settings), types comments, doc comments moved, manifest description.
