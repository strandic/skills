---
# skills-5w5c
title: 'shawarma-companion: a long call''s span can be dropped before a check lists its marker, hiding the session''s own run'
status: in-progress
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-22T16:00:00Z
---

A background subagent's long call writes its marker partway through, while the main session ends a turn (clears turnWindows) and makes 64 writing calls (evicts the span from windows). If the 15 s check lists the marker in that time, it enters lastSeen unclaimed; re-remembering the span at the call's end (Q7 N1) is too late. The own run reads '1 run in another worktree' for the session. Same on d5ce6ef. Possible fix: keep open spans in a list nothing evicts until the call closes them. Test B1 (F1). Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.

## Plan paused: 1 question (2026-11-22)

Plan dir: docs/plans/2026-11-22-skills-5w5c-open-span-eviction/. Triage: not trivial, not settled (the ticket's fix is a possibility, unruled) → design interview. Research: reports/research/report.md (engine 2.1.330: interrupt, deny and tool error all settle `next(e)`; nothing documents a call left pending forever, nor rules it out; the mod's `.finally` awaits `$.clock.now()` before closing the span).

Readings, `claude plugin test` on a scratch copy of the mod at 00cb95a with the s6qg final lane's tests plus O1, O2:
- B1 (the bug): base fails, `during`/`after` = `["main-1 · trivial", "1 run in another worktree"]`; option A (open spans in a set nothing evicts, released first in the call's clean-up) passes.
- O1 (a call that never ends, then a turn end and 64 writes, then another session's marker): base `1 run in another worktree`; A `other tree: other-1 · trivial` (over-claim lasts the session).
- O2 (a call that rejects mid-way): passes on both.

Q1 RULING asked: A (reco) · B, A plus an age limit N · C, no change, a stated limit.

## Rulings

- Q1 (2026-11-22): "Go with reco" → A. Error directions: under-claim (own run read as "1 run in another worktree": wrong output, the bug) and over-claim (another session's run drawn as this one's: wrong output, ruled the safe direction in s6qg W3-D5). The frozen rule never under-claims a call still running.

## Plan (2026-11-22): brief frozen

Brief: docs/plans/2026-11-22-skills-5w5c-open-span-eviction/plan.md (sketch/sketch.patch beside it). Option A per Q1, plus a release on `next.signal` abort (D2). Readings (`claude plugin test` on `.worktrees/5w5c-spike`): sketch `308 pass` / `0 fail` ×4 (one earlier run `307 pass` / `1 fail`, Q6-4, unrelated flake); base modules with the final tests `305 pass` / `3 fail` (V1, V2, V5); mutants each caught (V4, V4, V1+V2+V5, V3). `claude plugin validate`: `✔ Validation passed`; tsc exit 0. Attack lanes: reports/attack/report.md, reports/attack2/report.md.

freeze_check.py plan.md --repo .worktrees/5w5c-spike --listing <`grep -n '^- Lesson (' docs/plans/lessons.md`, empty> → `PASS`.

unruled: D1 the README's two claim-rule sentences (2d) — default accept as written
unruled: D2 release the span when `next.signal` aborts (2b ii) — default apply
unruled: D3 an ended call's span kept open in `windows`/`turnWindows` (S1) — default a new ticket, not folded
