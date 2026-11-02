---
# skills-0wsk
title: 'shawarma-companion: a throwing 15 s check keeps the hidden-marker counts'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-02T20:52:38Z
updated_at: 2026-11-02T20:52:38Z
---

Found by lane 3b in the skills-v2tm run (review round 1), by reading only. In mods/shawarma-companion/hooks/register.tsx the check's catch clears the rows and marks the last scan failed, but leaves the hidden counts (hiddenAtom) as they were; a failed refresh resets them to zero. The brief's error surface says a throwing check acts as a failed refresh, so the more-row can stay drawn after a failed check. The test kit could not make the check throw (a throwing state.get hook falls through to core), so there is no executed reproduction yet: the first step is a way to make it throw.
