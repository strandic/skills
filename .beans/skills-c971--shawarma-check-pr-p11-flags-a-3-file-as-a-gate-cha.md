---
# skills-c971
title: 'shawarma check_pr: P11 flags a §3 file as a gate change when the gate command names its folder'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-22T07:51:13Z
updated_at: 2026-11-22T07:51:13Z
---

Found in the skills-cm2l run (2026-11-22). `check_pr.py` P11 (`gate_change_fails`): `gate_files` takes the folder a §5 command names (`mods/shawarma-companion` from `claude-personal plugin test mods/shawarma-companion`), checks `in_s3` on that folder only, then fails every changed file under it, including the files §3's table names (`hooks/register.tsx`, `tests/band.test.tsx`, `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`). Reading: `check_pr.py <cm2l plan.md> <body> --repo .worktrees/cm2l --tests-commit ddfc39d` printed `FAIL P11 mods/shawarma-companion/hooks/register.tsx: changed since the freeze cc230ee1 and §5 G1 runs it; no §9 RULING row names G1` and the same for the other files, for G1 and G2. Likely fix: apply `in_s3` to each path the numstat lists. A skill-file change: fix between retros (script) per skills-9ft8.
