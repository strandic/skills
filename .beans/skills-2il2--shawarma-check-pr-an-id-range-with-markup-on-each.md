---
# skills-2il2
title: 'shawarma check_pr: an id range with markup on each end (**D1**–**D29**) reads as its two ends only'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-09T10:34:12Z
updated_at: 2026-11-09T10:34:12Z
---

Report from a project using strandic 0.9.0, received 2026-11-09. Reproduced on main, where `skills/shawarma/check_pr.py` matches the installed 0.9.0 copy (`diff -q` printed nothing).

## What happens

`ids_in` reads a range only when the separator sits directly between the two ids. With bold or code markup on each end, it reads the two ends alone. A brief whose authority clause says `**D1**–**D29**` is recorded as defining D1 and D29 only. M1 then fails once for each id between them that decisions.md records ("D2 is in no §9 row, `unruled:` line or authority clause"). A correct record cannot pass, and the rules forbid rewording a record to satisfy the checker.

Reading, `python3 -I` with `sys.path` at `skills/shawarma`, `len(check_pr.ids_in(s))`:

| s | ids |
|---|---|
| `**D1**–**D29**` | 2 (D1, D29) |
| `` `D1`–`D29` `` | 2 |
| `**D1**-**D3**` | 2 |
| `**D1–D29**` | 29 |
| `D1–D29` | 29 |

Cause: `RANGE_RE` (`check_pr.py:103`) allows only whitespace around the separator. Bolding each id on its own is the house style for single ids (`**Q1**`, `**D5**`), so this spelling comes up naturally.

## Error directions

- Today it errs by reading fewer ids: a false FAIL, disclosed in the PR body. Safe, but noisy.
- A fix that reads too much would err the corrupting way: P4 or M1 would pass an id the record never defined. So the fix allows only matching markup on both ends (`**`…`**` or a backtick pair), and keeps today's limits: same letters, at most 100 ids, the far end never read alone.

## Proposal, for the retro to weigh

- [ ] Expand `**<id>**<sep>**<end>**` and `` `<id>`<sep>`<end>` ``. Add each spelling above as a red test, plus near misses that must stay unexpanded: mismatched markup (`**D1**–D3`), different letters (`**D1**–**Q3**`).
- [ ] Say in the docstring's `ranges` line which spellings are read.
- [ ] Or, if the retro rejects the expansion, document that markup on each end is not a range, so brief authors write `**D1–D29**`.

Same family as skills-tx1x and skills-ain9 (id grammar), both closed by the round-9 retro.

**Filed 2026-11-09: for round 10.** The skill changes only at a retro.
