---
# skills-1tr4
title: 'shawarma-companion: row width counts characters, not screen cells'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-10-29T16:45:44Z
updated_at: 2026-10-29T16:45:44Z
---

The row in mods/shawarma-companion is cut to bodyColumns by string length (rowText in hooks/model.ts). A CJK or emoji title takes two cells per character, so the row wraps past the window. Found by the adversarial lane in skills-pi0y review round 1 (F5). Worst case: a wrapped row; no false text.
