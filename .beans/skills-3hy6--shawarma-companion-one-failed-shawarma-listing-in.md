---
# skills-3hy6
title: 'shawarma-companion: one failed .shawarma listing in the 15 s check empties the band and stops the check'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-22T07:37:16Z
updated_at: 2026-11-22T07:37:16Z
---

Found by the skills-cm2l review (lane 3a F1, lane 3b F5); ruled a new ticket (W3-R1, 2026-11-22).

In mods/shawarma-companion, `markersOf` turns a failed listing of a tree's `.shawarma` folder into "no markers". During the 15 s check, one such failure hides that tree's rows; with no row or more-row left, `refresh` sees scan status ok, calls `watch($, false)` and the check stops. The pane says `No shawarma marker in the last scan.` while a marker exists (wrong output).

Reading (skills-cm2l head 40a85c6 and base 1eed2e3, same): band before `skills-x — the thing · run W1 · since 14:01 · 0 decisions`; one pass with `fail.add('list /repo/.shawarma')`, then cleared: band empty, pane `No shawarma marker in the last scan.`, 0 fs calls in the next 60 s. Reproduction: the cm2l lane 3a report, probe H1a.

Design open: a failed listing as a failed pass (clears every row, the skills-cm2l Q3 path), or only that tree's rows dropped while the check goes on. Either changes what the pane says.
