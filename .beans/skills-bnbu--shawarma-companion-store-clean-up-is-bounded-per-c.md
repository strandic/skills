---
# skills-bnbu
title: 'shawarma-companion: store clean-up is bounded per call, not per pass, and can hold the first tool call for minutes'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-20T15:08:57Z
---

restore() prunes up to 100 other entries, racing each store.get and store.delete against 2 s separately. Reads answering in 1.9 s hold the first writing call (or session start) about 190 s (B5, F5); a hanging store.delete holds it 200 s (B7, F7, pre-existing). Give the whole pass one deadline, or run it off the tool call's path. Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.
