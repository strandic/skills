---
# skills-f7a9
title: 'shawarma-companion: a turn end whose working-directory read fails clears the turn''s folders, so a worktree written that turn shows as 1 run in another worktree'
status: completed
type: bug
tags:
    - shawarma
created_at: 2026-11-22T14:14:07Z
updated_at: 2026-11-22T17:30:00Z
---

Found by the skills-oz54 fix review (reports/fixreview/report.md, P3c). A turn with 70 writing calls, tree k listed before the turn end, and the turn end's session.cwd read rejecting: the band reads `[m, 1 run in another worktree]`; the all-instant run reads `[m, other tree: k]`. Pre-existing: the code before skills-oz54 reads the same. skills-oz54's first fix kept the claim by chance (it dropped the trees on a lost read); the shipped fix (W3-R3 C) keeps the trees, so the reading is back to the old one.

**Correction and close (skills-oz54 W3-R4, 2026-11-22):** the "pre-existing" reading above is wrong. Test V18 (this sequence, the cwd read rejecting) passes on the base c3c525d (`(pass) … V18`; the run reads `306 pass` / `13 fail`, the 13 being the oz54 tests the base cannot pass) and fails on 29f8f15. So the loss came in with skills-oz54's W3-R3 C. Fixed in the same branch by `3132753`: a main turn end whose cwd read is lost no longer clears the turn's folders and spans.
