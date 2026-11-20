---
# skills-gqci
title: 'shawarma check_pr: an id range written with ''to'' (DF1 to DF6) reads as its two ends only'
status: completed
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-11T21:05:05Z
updated_at: 2026-11-20T15:38:59Z
---

Report from a project using strandic 0.10.1, received 2026-11-11. The installed `check_pr.py` is identical to `skills/shawarma/check_pr.py` on main (`diff -q` printed nothing).

## What happens

`ids_in` expands a range only when an en dash or hyphen separates its ends. A brief whose authority clause says `rulings Q1 and DF1 to DF6` is recorded as defining Q1, DF1 and DF6 only. P4 then fails each PR Decisions row for DF2 to DF5, and M1 fails each decisions.md line for them ("DF2 is in no §9 row, `unruled:` line or authority clause"). The record is correct and the brief is frozen above §9, so the run cannot pass without rewording a record to fit the checker, which the rules forbid.

Reading, `python3 -I` with `sys.path` at `skills/shawarma`, `sorted(check_pr.ids_in(s))`:

| s | ids |
|---|---|
| `DF1 to DF6` | DF1, DF6 |
| `DF1–DF6` | DF1 … DF6 |
| `DF1-DF6` | DF1 … DF6 |

## Options

Either read `<id> to <id>` (same prefix) as a range, or have the brief template and plan.md say that ranges in the authority clause use an en dash, with freeze_check flagging `<id> to <id>`. Sibling of skills-2il2 (markup on each end).


## Fixed in 0.11.0 (2026-11-20)

Round 11 (pull request 9): check_pr reads `X1 to Xn` in the authority clause as a range, takes a trivial note's ticket id from its `# <id> <title>` first line, knows an id that starts a line of the note, and parses `## Plan (<date>, trivial)` headings. Red tests in test_checks.py.
