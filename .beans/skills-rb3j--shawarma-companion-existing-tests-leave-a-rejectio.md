---
# skills-rb3j
title: 'shawarma-companion: existing tests leave a rejection nothing handles (''the file ran to its end'', $.state.get refused)'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-22T08:57:41Z
updated_at: 2026-11-22T08:57:41Z
---

Found by the skills-oz54 plan, attack lane round 1 (docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/attack/report.md, 'About the file ran to its end line'): when the suite runs on after the existing tests, the kit prints '(fail) the file ran to its end' with 'a rejection nothing handled: environment …: $.state.get refused: no hooks module of that name is loaded'. Same text on base and sketch. Likely source (not verified): watch()'s 'void stale($).catch(() => update(...))', whose update can reject with nothing handling it. Ruled D4.
