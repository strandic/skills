---
# skills-lm8d
title: 'shawarma-companion: a late refresh overwrites a newer one for one pass'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-22T07:37:16Z
updated_at: 2026-11-22T07:37:16Z
---

Found by the skills-cm2l review (lane 3a F3); ruled a new ticket covering the whole race (W3-R2, 2026-11-22).

In mods/shawarma-companion, refreshes are not ordered: whichever finishes last draws. A refresh whose read is slow can answer with what the file said when it started, after a tool call drew newer content; the band then shows the older step for one 15 s pass (wrong output), then the next pass corrects it.

Readings (lane 3a probes): H5d, pre-existing on base 1eed2e3 and head alike: a check refresh's delayed marker read answers `run W1b` after a tool call drew `run W2`; band shows W1b for one pass. H5b, a new way in added by skills-cm2l (the re-read of a `could not be read` row each pass): after the tool call `… run W3 …`, after the slow read `… run W2 · since 14:02 …`, next pass `… run W3 …` (re-run by the orchestrator on 40a85c6). H5a and H5c: an older failure overwrites a newer success for one pass.

Likely fix: number each refresh and drop a result older than the last one drawn; it touches every refresh path.
