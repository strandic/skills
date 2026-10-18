---
# skills-s262
title: 'shawarma retro: a plan wall-clock meter'
status: in-progress
type: task
priority: normal
created_at: 2026-10-09T11:54:42Z
updated_at: 2026-10-18T13:58:41Z
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

## Rulings (2026-10-18)

The owner, verbatim: "Go with reco".
- R4 (Q1): option 1. `"cleanupPeriodDays": 365` was set in ~/.claude-personal/settings.json on the owner's word (`grep -n cleanupPeriodDays ~/.claude-personal/settings.json` → `55:  "cleanupPeriodDays": 365,`; the file parses as JSON). Source: the installed CLI 2.1.302's settings schema reads `cleanupPeriodDays: int().positive().optional()`, "Number of days to retain chat transcripts before automatic cleanup (default: 30)". Whether it actually keeps files past 30 days stays `unexecuted` until Nov 4 2026, when the oldest round-6 transcript turns 48 days old.
- D1–D7 accepted.

## Brief (2026-10-18)

Brief: `docs/plans/2026-10-18-skills-s262-plan-wall-clock-meter/plan.md`, with the whole-file sketches in `sketch/` and the gate tools in `gates/`. Re-spiked on R4. Attack lanes 3–8 ran after R4, finding 30 problems; all were fixed or recorded. Readings, each beside its command, are in the brief. In brief:
- `node --test scripts/test/plantime.test.mjs` → 32/32. Against the stub → 30 red, all AssertionError; tests 27 and 29 are guards.
- Suite → 545 tests, 543 pass, 0 fail, 2 skipped.
- G1–G3 PASS on rounds 6 and 7. G4: meter 150 = reader 150. Mutants: 83 of 83 red.
- New since the questions ending: the meter counts background commands stopped at their background limit (the 2.1.285 changelog), once per call.
- New DEFAULT D8: two records in one millisecond keep their file order. Reading: 7 of 7 real stop notices come after their call.

unruled: D8 — default accept (two records in one millisecond keep file order)

## Run stopped: 1 RULING (2026-10-18)

Branch feat/s262-plantime in `.worktrees/s262-plantime`: d7e02d0 tests + stub (red set 1–26, 28, 30–32, 30 × ERR_ASSERTION; guards 27, 29 green, `node --test scripts/test/plantime.test.mjs`), 85ae60e meter (byte-identical to the sketch, `cmp`). Suite `node --test scripts/test/*.test.mjs`: head 545/543/0/2, base 513/511/0/2, same 2 skips. No lint configured; `node --check` on every scripts/*.mjs clean.
Review wave 1: 3b mutants 83/83 red, red sets equal §7; §3 error surface holds; sentinel grep 0. Findings (reproduced by the orchestrator, `python3 -I cases.py`, `crash.sh`, `f_turn_min.sh` in the lane-3a scratch dir): a non-string Bash command crashes the whole run (exit 1, all plans lost); text nested ≥5000 deep crashes; a plans-file FIFO hangs; wrong output — a start-time turn whose wait crosses the start through a meta/compaction record is counted (346 of 7770 sequences); an orphan lane notification whose `<result>` quotes the harness words reads exec-wait (and a quoted stop notice counts a hit); a peer/coordinator record quoting a notification without a relay tag counts a hit; a quoted `<command-args>plan T` opens the window early; directory links under subagents/ and the session dir are followed or vanish uncounted; a lane with one stray out-of-window first record vanishes; time-limit keys miscount in 5 shapes (overlapping quotes, two notices in one record, no tool_use_id, moved-then-stopped by task id only, call/task id collision). 3b: 9 header rules have no binding test (own breaks survive). Prose: "links … counted", "still reads" past 2 GiB, 16 MB isProbe memory 600 MB not 335 MB.

unruled: the review-round-1 scope — default none (a RULING)
