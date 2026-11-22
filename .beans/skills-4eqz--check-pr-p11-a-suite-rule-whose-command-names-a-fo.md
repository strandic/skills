---
# skills-4eqz
title: 'check_pr P11: a suite rule whose command names a folder flags the contract''s own files as changed gate tools'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-22T07:46:45Z
updated_at: 2026-11-22T07:46:45Z
---

Found by the skills-bnbu run, gate (2026-11-22). §5 R1's command is 'claude-personal plugin test mods/shawarma-companion': gate_files returns the folder, in_s3 does not match a folder against §3's file rows, and git diff --numstat over the folder lists every changed file. So P11 printed 'FAIL P11 mods/shawarma-companion/hooks/register.tsx: changed since the freeze 039320d2 and §5 R1 runs it; no §9 RULING row names R1' for all six files, though each is a §3 contract file (the contract's own change, which P11 means to exempt). Expected: a path under a gate folder that §3 names is exempt, as a file §3 names is.
