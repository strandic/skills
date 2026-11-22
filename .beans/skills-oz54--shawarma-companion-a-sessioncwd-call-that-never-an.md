---
# skills-oz54
title: 'shawarma-companion: a session.cwd call that never answers holds the tool call forever; the README says session calls give up after 2 s'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-22T07:44:49Z
updated_at: 2026-11-22T07:44:49Z
---

Found by the skills-bnbu run, fix-review lane (docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/reports/run/lane-3b-fix/report.md, Note 2). Pre-existing. $.session.cwd() has no time limit (register.tsx lines 222, 649, 705, 719, 737 use only .catch; $.session.usage() at 584 too). With session.cwd never answering, the first Bash call was still pending after 10 s of engine clock (PROBE-F sessionCwdHang done=false); the hang at line 705 comes before next(e), so the tool call never runs. README: 'Each call to the session or the store gives up after 2 seconds' is false for the session half.
