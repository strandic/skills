---
# skills-mizx
title: 'shawarma-companion: the 15 s check reads the new working directory but not which tree is current, so a /cd with no tool call keeps the old tree''s labels'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-22T08:57:41Z
updated_at: 2026-11-22T08:57:41Z
---

Found by the skills-oz54 plan, attack lane round 1 (A4, docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/attack/report.md): after a move to another worktree, a 15 s check that gets the new working directory still draws the old tree as current and the session's own tree with 'other tree:'. stale() updates mainCwd but refreshes with lastTrees, whose own tree was found for the old directory. Pre-existing: the same on the base when the check is the first to see the move. Ruled D4 (skills-oz54 decisions.md).
