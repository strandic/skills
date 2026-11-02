---
# skills-nucr
title: Trivial go writes no shawarma marker
status: completed
type: bug
priority: normal
created_at: 2026-11-01T16:02:37Z
updated_at: 2026-11-02T14:17:33Z
---

> **What this is about:** a trivial ticket's run never writes `.shawarma/active`, so the companion mod (skills-pi0y) shows nothing for it.

**Seen:** bigbrain session `bigbrain-02`, `/shawarma run 1692` (trivial, 2026-11-01 15:13–15:21 UTC). The only marker touch was `ls .worktrees/1692-post-verify-host/.shawarma/active` → `No such file or directory` (transcript `~/.claude-personal/projects/-Users-jonathan-Documents-bigbrain/6ec49d8a-1e66-4722-b01d-9930fa08c26e.jsonl`).

**Mechanism:** SKILL.md "State files" writes the marker only at plan step 1 and run Wave 0. The trivial path (Triage → "On the go, do it per house rules") reaches neither.

**Which is wrong:** the rule — it predates the mod and never named the trivial path.

**Fix:** a trivial go writes the marker at the root of its tree (line 2 e.g. `run trivial`) and deletes it at its stop, like any run.

**Done when:** SKILL.md names the trivial go in "State files"; a trivial run shows the band row with the mod loaded.



**Queued for the round-9 retro (2026-11-01).** Skill-text changes land through retro rounds (every SKILL.md/run.md change since v0.3.0: `git log -- skills/shawarma/SKILL.md skills/shawarma/run.md`). Fold with its sibling (skills-nucr = trivial go writes no marker; skills-ox8b = Bash-written marker invisible to the mod): both touch the SKILL.md "State files" line. Until then, a session started inside the worktree makes the mod read that worktree's marker.



**Closed by the round-9 retro (v0.9.0, 2026-11-02).** See the round-9 rulings (R4, R8, R15).
