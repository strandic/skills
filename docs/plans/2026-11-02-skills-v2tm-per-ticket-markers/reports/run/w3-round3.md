# Wave 3, review round 3 (at 3ca75c7) — labels

| finding | label | note |
|---|---|---|
| N1 pane reads and check lists a missing folder that became a link out, until the next refresh | RULING | (c)/(d) leak window; a fourth round is a ruling |
| N2 a hanging stat re-asked each refresh, 2 s each in series | RULING (with N1) | changes R3's "not cached" |
| N3 an in-tree link makes the stat follow it outside | APPLY (docs) | inherent to following links; README states it |
| N4 mutants M3a, M3b, M31, M16 survive | APPLY | tests pin the re-ask, the root race, scanned roots only |
| N5 docs | APPLY | prose |
| duplicate roots in the fallback (`/tmp` spelling) | TICKET | pre-existing |
