---
# skills-qvnv
title: 'shawarma-companion tests: the fake fs keys files by raw path'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-10-29T16:45:44Z
updated_at: 2026-10-29T16:45:44Z
---

The world() fake in mods/shawarma-companion/tests/band.test.tsx keys files by the path as written, so './.shawarma/active' and '/repo/.shawarma/active' are different files. A bug that depends on path spelling cannot show in the suite. Found by the code-review lane in skills-pi0y review round 1 (F7). Fix: normalise paths in the fake as the real fs does.
