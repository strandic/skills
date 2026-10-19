---
# skills-hekn
title: 'shawarma round 8: state files (active marker, decisions.md)'
status: completed
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-10-16T19:48:28Z
updated_at: 2026-10-19T16:19:51Z
parent: skills-sp16
blocking:
    - skills-pi0y
---

Round-8 retro item, ruled in skills-pi0y's design interview (R1–R4, 2026-10-16). The skill changes only at a retro (retro.md), so this text lands there, checked by the trap bank with the size work.

Add to SKILL.md (~70 words; plan-brief and run ~7.1k → ~7.2k, measured on a scratch sketch with `scripts/size_paths.py` + `plugin details szp`; R1 ruled the growth):
- [x] At plan step 1 and run Wave 0 write `.shawarma/active` at the root of the tree the step runs in (main checkout while planning, the run's worktree in a run), with `.shawarma/.gitignore` holding `*` (R2): the plan dir, then `plan <step>` or `run W<n>`; rewrite it at each step or wave; delete it at every stop. Write the marker with the Write tool, not Bash (skills-pi0y R6: the mod counts only a Write/Edit of the marker's path as this session's).
- [x] Every RULING and DEFAULT, when made, appends `<date> | <label> | <decision> | <why>` to the plan dir's `decisions.md`.
- [x] (superseded by round-8 D13: §9 is the record, decisions.md mirrors it) run.md Wave 4: the Decisions table is built from `decisions.md`.
- [x] Trap bank: no trap lost; size meter reading before/after in the retro record.

The marker format is the contract skills-pi0y's mod reads; change it only together with that mod.

## Summary of Changes

Shipped in v0.8.0 (a352910): SKILL.md:19 writes .shawarma/active (Write tool) and appends each RULING/DEFAULT to decisions.md, mirroring §9 (D13). Sizes before/after are in bigbrain docs/retros/2026-10-18-shawarma-round-8/ record.md.
