---
# skills-7y7p
title: 'shawarma-companion: a /clear during a paused claim can leave the new session id''s stored claims short'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T14:58:56Z
updated_at: 2026-11-20T14:58:56Z
---

Found by the skills-s6qg run review, round 3 (lane-3a-fix A8). Timing-dependent: when the session id changes (`/clear`) while a claim is paused inside `claim()`, the new id's store entry sometimes ends without every claim. Kit reading: 1 fail in 3 runs on d5ce6ef. A `--resume` of the new id after that would fold a run. Reproduction: docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-fix/fix.test.tsx, test A8.
