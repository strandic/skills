---
# skills-p81u
title: 'shawarma-companion: a named marker that never stats blanks the row'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-01T07:20:41Z
updated_at: 2026-11-01T07:20:41Z
---

In mods/shawarma-companion, once a Write or Edit names a marker path, it becomes the first candidate. If its stat keeps failing (for example EACCES), every refresh throws and the row stays empty for the rest of the session, even when the cwd marker would draw. Allowed by the skills-pi0y brief §6 (an empty row). Could skip a candidate whose stat fails. Found by the skills-pi0y fix-review lane (N4).
