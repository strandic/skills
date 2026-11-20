---
# skills-yxw1
title: 'shawarma-companion: a working-directory call that never answers holds the tool call'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T13:15:53Z
updated_at: 2026-11-20T13:15:53Z
---

Found by the skills-s6qg run's review lane (X6, pre-existing on the base). `$.session.cwd()` is awaited without the 2 s race the mod uses for git, file and (since s6qg Q6) session and store calls; a cwd call that never answers leaves the writing tool call unanswered. Fix: race it with `within()` like the others.
