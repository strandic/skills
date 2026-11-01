---
# skills-nucr
title: Trivial go writes no shawarma marker
status: todo
type: bug
created_at: 2026-11-01T16:02:37Z
updated_at: 2026-11-01T16:02:37Z
---

> **What this is about:** a trivial ticket's run never writes `.shawarma/active`, so the companion mod (skills-pi0y) shows nothing for it.

**Seen:** bigbrain session `bigbrain-02`, `/shawarma run 1692` (trivial, 2026-11-01 15:13–15:21 UTC). The only marker touch was `ls .worktrees/1692-post-verify-host/.shawarma/active` → `No such file or directory` (transcript `~/.claude-personal/projects/-Users-jonathan-Documents-bigbrain/6ec49d8a-1e66-4722-b01d-9930fa08c26e.jsonl`).

**Mechanism:** SKILL.md "State files" writes the marker only at plan step 1 and run Wave 0. The trivial path (Triage → "On the go, do it per house rules") reaches neither.

**Which is wrong:** the rule — it predates the mod and never named the trivial path.

**Fix:** a trivial go writes the marker at the root of its tree (line 2 e.g. `run trivial`) and deletes it at its stop, like any run.

**Done when:** SKILL.md names the trivial go in "State files"; a trivial run shows the band row with the mod loaded.
