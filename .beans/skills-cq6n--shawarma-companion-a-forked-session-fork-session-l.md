---
# skills-cq6n
title: 'shawarma-companion: a forked session (--fork-session) loses its parent''s claims'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T13:15:53Z
updated_at: 2026-11-20T13:15:53Z
---

Found by the skills-s6qg run's review lane (F5, real engine). `claude --resume <id> --fork-session` starts a new session id in a new process, so neither the stored claims (`claims:<id>` in the mod's store) nor the process list carry over: the fork's own worktree run is folded into 'runs in other worktrees' until it moves there again. Needs a way to link the fork to its parent (the classic SessionStart source is 'fork'; whether it names the parent is unchecked).
