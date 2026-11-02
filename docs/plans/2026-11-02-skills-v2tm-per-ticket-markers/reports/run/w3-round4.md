# Wave 3, review round 4 (at 7851e73) — labels

| finding | label | note |
|---|---|---|
| A deleted inside folder replaced by a link out, read through the cached real path | RULING | (c)/(d) leak; a fifth round is a ruling; one-line fix proposed |
| B 13 surviving mutants, 5 reading outside on the real engine | APPLY (with the ruling) | tests only |
| C pane ignores the per-turn late answer (2 s per draw) | APPLY (with the ruling) | pane uses `lateDirs` |
| D–G comments and README | APPLY | prose |
