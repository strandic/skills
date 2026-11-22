---
# skills-laqh
title: 'shawarma-companion: a subagent call whose project-root read fails counts the session''s own run as in another worktree'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-22T08:57:41Z
updated_at: 2026-11-22T08:57:41Z
---

Found by the skills-oz54 plan, attack lane round 1 (docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/attack/report.md, 'Other wrong output, pre-existing'): a subagent call with no claims, where claim's session.root read (register.tsx:220 at f1ed7f4) fails or gives up, shows '1 run in another worktree' for a marker in the session's own tree. Same reading on base and sketch. Reproduction: the lane's probe.tsx, test 'A1 tool.sub.nostart root#2:never' (or ':reject'). Ruled D4.
