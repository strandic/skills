---
# skills-ox8b
title: Shawarma marker written by Bash is invisible to the companion mod
status: completed
type: bug
priority: normal
created_at: 2026-11-01T16:02:37Z
updated_at: 2026-11-02T14:17:33Z
---

> **What this is about:** agents write `.shawarma/active` with Bash `printf` instead of the Write tool, so the companion mod (skills-pi0y) can't find a marker in a worktree.

**Seen:** bigbrain session `bigbrain-02` wrote every marker of the 6nqy and 1692 plans and runs with Bash (`printf '%s\nrun W1\n' $P > .shawarma/active`, 2026-10-22 15:14; W3 15:47; W4 2026-11-01 12:25). Zero Write calls on a `.shawarma` path in the whole transcript (`~/.claude-personal/projects/-Users-jonathan-Documents-bigbrain/6ec49d8a-1e66-4722-b01d-9930fa08c26e.jsonl`).

**Mechanism:** the mod learns a marker path only from a Write/Edit `file_path` (`mods/shawarma-companion/hooks/register.tsx:180`); otherwise it reads the marker at the session cwd's git root. The session ran from the main checkout, the run markers sat in `.worktrees/<ticket>/`, so none was seen.

**Which is wrong:** compliance — SKILL.md already says "(Write tool)", but only as a parenthesis; this session ignored it every time.

**Fix:** make the rule hard to skip: state it where the marker is rewritten (run.md Wave 0 and each wave, plan.md step 1) with the reason ("the companion mod reads only Write/Edit paths"), and say never Bash.

**Done when:** the skill text carries the rule and its reason at each write site; a run from the main checkout into a worktree shows the band row with the mod loaded.

Alternative, not chosen: the mod scans `.worktrees/*/.shawarma/active` or parses Bash commands.



**Queued for the round-9 retro (2026-11-01).** Skill-text changes land through retro rounds (every SKILL.md/run.md change since v0.3.0: `git log -- skills/shawarma/SKILL.md skills/shawarma/run.md`). Fold with its sibling (skills-nucr = trivial go writes no marker; skills-ox8b = Bash-written marker invisible to the mod): both touch the SKILL.md "State files" line. Until then, a session started inside the worktree makes the mod read that worktree's marker.



**Closed by the round-9 retro (v0.9.0, 2026-11-02).** See the round-9 rulings (R4, R8, R15).
