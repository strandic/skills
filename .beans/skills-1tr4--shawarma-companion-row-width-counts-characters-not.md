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

## Also (skills-pi0y fix review, F8)

`clean` lets some invisible or direction-changing characters through, and they are drawn as they are: U+202E (right-to-left override), U+200B (zero-width space), U+FEFF (byte-order mark), U+FFF9. Cutting the title can also split an emoji in two, which draws U+FFFD (at 41 columns: `"😀�… · run W1 …"`). Both concern how the row is cut and drawn, so fix them with the width change.
