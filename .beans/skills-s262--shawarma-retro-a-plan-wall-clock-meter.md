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


## Plan paused: 1 question (2026-10-17)

Spike: sketch `scripts/plantime.mjs` + `scripts/test/plantime.test.mjs` in `.worktrees/s262-spike` (branch spike/s262, uncommitted; gate tools in its `spike/`). Readings, each beside its command:
- `node --test scripts/test/plantime.test.mjs` → 27 pass, 0 fail; with the signature stub → 25 red (all AssertionError), 2 guards green (privacy, writes nothing).
- `node --test scripts/test/*.test.mjs` → 540 tests, 538 pass, 0 fail, 2 skipped (base e93e92e: 513 / 511 / 0 / 2).
- G1 `spike/oracle.py` (old Python meters, an independent implementation; non-wait buckets equal to the ms) → PASS 6/6 (round 6), 7/7 (round 7). G2 `spike/crosstab.py` (every class change is a named reclassification) → PASS both. G3 `spike/g3.py` (wait buckets incl. lanes, second implementation, own window) → PASS 6/6, 7/7; its wrong fixes W1–W4 read FAIL 1/7 or 1/6; W5 (owner text quoting tags) has no case in these windows, bound by a unit test.
- `spike/mutants.py` → 53/53 red (M38 by hang). Time-limit hits over all local transcripts: meter 143, independent reader `spike/l3pop2.py` 143. Cost: 145 MB transcript → 0.95 s user, 491 MB RSS; 11× bytes → 5.9× CPU.
- What the new meter changes in published figures: round 7's 1735 min `other` (063y) is other-session-wait; 164 min of `human` was compaction while idle, now owner wait only when the owner woke the session; the old meters' killed-call rules missed every call moved to the background (2.1.250+) and counted command output.
- Attack lane: 2 passes, 19 findings, all fixed in the sketch; pass 3 runs on the changed lines at the re-spike.

Q1 (plan step 3(d), an impact the ticket did not weigh: data loss). Reading: `grep cleanupPeriodDays ~/.claude-personal/settings.json` → not set; the docs (code.claude.com/docs/en/sessions): default 30 days. Oldest bigbrain transcript: Sep 17 2026 (`ls -lT`). Mechanism: Claude Code deletes transcripts after 30 days, so the meter reads NOT RUN for any plan older than that, and G1–G3's round-6 slice disappears around Nov 4. Wrong: the ticket (it assumes the transcripts are there at the retro). Options: (1, reco) the owner sets `"cleanupPeriodDays": 365` in ~/.claude-personal/settings.json — readings for a year of plans; the header names the limit; unexecuted. (2) keep 30 days; the retro reads only plans under 30 days old; the gate's round-6 slice reads "cannot run" after Nov 4. (3) a new round-8 ticket: each plan ending writes its own aggregates-only reading into its plan folder — durable, grows the skill. Residue: none in this repo for (1); a ticket for (3).

DEFAULTs (go or silence accepts):
- D1 "tool calls killed at the tool limit" → `timeLimitHits`: calls the harness stopped or moved to the background at their limit (moved, not killed, in 116 of 143 locally).
- D2 "ask rounds per plan" → `ownerTurns` and `ownerWaitsMs` (AskUserQuestion answers count, interrupts do not). A true ask-round count needs a marker the skill writes (skills-hekn's decisions.md); noted for skills-lxpq.
- D3 `promptSource: sdk` records count as owner (442 locally; possibly desktop typing).
- D4 The first reading restates rounds 6 and 7 with the new meter beside their published figures.
- D5 Naming the command in retro-workflow.js / retro.md is skill text: it lands at the round-8 retro. R3 closes this ticket when the script lands.
- D6 The plans file takes the brief commit's time (`git log -1 --format=%cI`), not its SHA, so the script never runs git.
- D7 Unsourced, 0 local records: teammate-message → other-session-wait; auto-continuation → external; `<tick>` → scheduled; `<remote-review>` → lane-wait.

unruled: Q1 — default none (a RULING)
