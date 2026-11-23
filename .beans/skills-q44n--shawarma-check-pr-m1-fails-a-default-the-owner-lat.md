---
# skills-q44n
title: 'shawarma check_pr: M1 fails a default the owner later ruled, which the skill records as two lines'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-23T06:57:34Z
updated_at: 2026-11-23T06:57:34Z
---

The skill's State files rule says each RULING and DEFAULT appends a line `<date> | <id> RULING|DEFAULT | …` to decisions.md, and that an explicit answer to a DEFAULT makes it a RULING. So a plan-ending default that the owner then rules has a DEFAULT line and a later RULING line. `check_pr.py` M1 (strandic 0.11.0, `check_pr.py:1243-1245`) requires each id once and prints `FAIL M1 decisions.md:<n>: <id> has a second line`.

Seen on skills-cb5t: D1–D10 were listed as defaults at plan ending (DEFAULT lines), then ruled "go with reco on all defaults" (RULING lines appended). `check_pr.py <brief> <body> --repo <tree> --tests-commit f62c976 --base origin/main` → ten `FAIL M1 … D<n> has a second line`. freeze_check passed on the same file.

Either the checker should accept a DEFAULT line followed by a RULING line for the same id (the later one wins), or the skill text should say a ruled default replaces its line. A ruling for the owner.
