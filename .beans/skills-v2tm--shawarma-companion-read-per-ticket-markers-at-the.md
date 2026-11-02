---
# skills-v2tm
title: 'shawarma-companion: read per-ticket markers at the root and in worktrees'
status: todo
type: feature
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-02T08:38:09Z
---

Filed by the round-9 retro (D6), 2026-11-02. Evidence: the round-9 record (private). (R8.)

The skill now writes `.shawarma/active-<ticket>` (also on a trivial go, line 1 the ticket, line 2 `trivial`) with any tool. The mod scans `.shawarma/active-*` at the git root and in `.worktrees/*/` instead of learning paths from Write/Edit calls, and shows one row per live marker. Supersedes skills-nucr and skills-ox8b's mod side.
