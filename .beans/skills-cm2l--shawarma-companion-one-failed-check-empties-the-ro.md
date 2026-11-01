---
# skills-cm2l
title: 'shawarma-companion: one failed check empties the row until the next tool call'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-01T06:52:49Z
updated_at: 2026-11-01T06:52:49Z
---

In mods/shawarma-companion, a single fs error during the 15 s check (for example EACCES on decisions.md once) clears the row and stops the check. The row stays empty until the next tool call or turn end, even after the error goes away. Allowed by the skills-pi0y brief §6 (an empty row), but the check could keep running and redraw. Found by the skills-pi0y fix-review lane (F7).
