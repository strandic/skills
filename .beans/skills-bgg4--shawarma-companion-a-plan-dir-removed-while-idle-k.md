---
# skills-bgg4
title: 'shawarma-companion: a plan dir removed while idle keeps its old row'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-01T07:20:41Z
updated_at: 2026-11-01T07:20:41Z
---

In mods/shawarma-companion, the 15 s check tests the plan dir only while the row already says it is missing. If the dir is removed while idle and it held neither plan.md nor decisions.md, the row keeps the dir name and 0 decisions and does not show 'plan dir not found' until the next tool call. Pre-existing. Found by the skills-pi0y fix-review lane (N5).
