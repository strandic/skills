---
# skills-wimc
title: 'shawarma-companion: a worktree spelled through /tmp is scanned twice in the file-API fallback'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-02T21:29:31Z
updated_at: 2026-11-02T21:29:31Z
---

Found by the round-3 review lane of the skills-v2tm run (pre-existing). When git cannot run, the fallback walk can list the same worktree as /tmp/…/w and /private/tmp/…/w (a .git file spelling /tmp); both are scanned and its rows are drawn twice. The roots' real paths are now resolved once per turn, so they could be deduplicated by real path.
