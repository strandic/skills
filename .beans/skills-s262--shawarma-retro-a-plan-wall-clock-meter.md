---
# skills-s262
title: 'shawarma retro: a plan wall-clock meter'
status: todo
type: task
priority: normal
created_at: 2026-10-09T11:54:42Z
updated_at: 2026-10-15T17:52:47Z
parent: skills-mcfe
---

Move the round-6 transcript meter (bigbrain docs/retros/2026-10-08-shawarma-round-6/tools/plantime.py) into scripts/ as a generic meter run at every retro, like the size meter (skills-tkc0).

- input: the project's Claude Code transcripts plus a list of (ticket, session, plan start, brief commit); output: durations and categories ONLY, never message content (this repo is public, transcripts may hold private data)
- buckets: owner wait, other-session wait, lane wait, model, exec (suite / probe / other shell), lane internals; tool calls killed at the tool limit; ask rounds per plan
- [ ] script in scripts/, project-agnostic (no hardcoded paths or tickets)
- [ ] retro-workflow.js or the retro section names the command
- [ ] first reading at the next retro, beside the size meter

## Round 7

R3: the meter moves to `scripts/`; this ticket closes when its project-agnostic script lands there. Not done this round (the round-7 reading used bigbrain's `plantime_r7.py`). Record: bigbrain docs/retros/2026-10-14-shawarma-round-7/ (record.md, rulings.md).
