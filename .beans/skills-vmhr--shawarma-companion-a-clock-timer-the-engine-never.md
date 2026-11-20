---
# skills-vmhr
title: 'shawarma-companion: a clock timer the engine never fires leaves every 2 s bound open'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T17:19:15Z
updated_at: 2026-11-20T17:19:15Z
---

Every RUN_MS bound in the mod (within, bounded, the prune deadline) races the call against $.clock.after. The d.ts says the callback "never" runs when a hook refuses the dispatch, and the kit drops a held wait when its dispatch aborts. With the timer refused, a store read that never answers holds the call past 60 s (base and sketch alike). Pre-existing. Found by the skills-bnbu plan attack lane, line A5 (docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/reports/attack/report.md). Filed by skills-bnbu D2.
