---
# skills-lhdg
title: 'shawarma: refuse to start plan or run on a checkout another session is working'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-10-17T07:55:59Z
updated_at: 2026-10-17T07:55:59Z
parent: skills-sp16
blocked_by:
    - skills-hekn
---

Owner request, 2026-10-17 (skills-pi0y Q2 ruling): guard the shawarma skill against starting on a checkout that another session is already working with the skill.

Why: skills-pi0y Q2 found that two sessions in one tree overwrite each other's `.shawarma/active` marker. The companion mod can only label such a row `unconfirmed:`; it cannot tell sessions apart. The skill can prevent the overlap at the source.

Depends on skills-hekn's marker (`.shawarma/active` at the tree root; line 1 the plan dir, line 2 `plan <step>` or `run W<n>`; deleted at every stop). Round-8 retro item, since the skill changes only at a retro (retro.md:3).

Sketch (to rule at the retro):
- [ ] At plan step 1 and run Wave 0, before writing the marker: if `.shawarma/active` already exists in that tree, stop and ask the human. The ask quotes the marker's two lines and its modified time.
- [ ] Options in the ask: (1) the other session is gone (the marker is left over from a stop that did not delete it): take over and rewrite the marker; (2) work in a new worktree instead; (3) stop.
- [ ] Open question: a marker left by a crash looks the same as a live one. Decide whether its age alone may suggest option 1 (no automatic takeover either way).
- [ ] Trap bank: a case where the marker exists and the skill must ask, not overwrite.
- [ ] Size meter reading before/after in the retro record.
