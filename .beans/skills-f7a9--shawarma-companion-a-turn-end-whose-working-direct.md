---
# skills-f7a9
title: 'shawarma-companion: a turn end whose working-directory read fails clears the turn''s folders, so a worktree written that turn shows as 1 run in another worktree'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-22T14:14:07Z
updated_at: 2026-11-22T14:14:07Z
---

Found by the skills-oz54 fix review (reports/fixreview/report.md, P3c). A turn with 70 writing calls, tree k listed before the turn end, and the turn end's session.cwd read rejecting: the band reads `[m, 1 run in another worktree]`; the all-instant run reads `[m, other tree: k]`. Pre-existing: the code before skills-oz54 reads the same. skills-oz54's first fix kept the claim by chance (it dropped the trees on a lost read); the shipped fix (W3-R3 C) keeps the trees, so the reading is back to the old one.
