---
# skills-rm6v
title: 'check_pr P11: a file renamed under a gate folder reads as changed even when §3 names it'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-22T12:44:13Z
updated_at: 2026-11-22T12:44:13Z
---

Found by the skills-4eqz plan (2026-11-22). gate_change_fails runs git diff --numstat with git's default rename detection, so a rename under a gate folder lists as 'tools/kitchen/{pot.py => lid.py}'. That path matches no §3 name, and P11 prints 'FAIL P11 tools/kitchen/{pot.py => lid.py}: changed since the freeze ...' even when §3 names both files. Executed in a scratch repo with git 2.48.1. Direction: false FAIL (inconvenience). Fix idea: pass --no-renames to the numstat call, so each side is listed and matched on its own.
