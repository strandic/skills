---
# skills-cb5t
title: 'runmeter: split a session at each skill command, so its figures are per run'
status: in-progress
type: task
tags:
    - shawarma
created_at: 2026-11-11T10:59:26Z
updated_at: 2026-11-11T10:59:26Z
---

`scripts/runmeter.mjs` (0.10.2) prints one line per session. A session often holds several plan, run and retro commands, and is resumed over days, so a session is not a run. With `--labels`, the line is labelled with its first skill command only.

To do: cut a session at each skill command (the label rule already finds them), give each part its own line with its lanes, owner turns, minutes and tokens, and keep the per-session line as a total. Decide what to do with lanes that start under one command and end under the next.

Until then, cost per run can only be read for sessions that hold one command.

## Design interview (2026-11-22)

Research (plan step 1, aggregates over this repo's transcripts, CLI 2.1.295–2.1.330): 5 of 7 sessions with lanes hold more than one owner skill command; 0 of 263 lanes cross a command under any anchor (launch call, first record, last record); 7 of 126 lanes start before the first command.

Error directions: a lane or turn counted in the wrong part overstates one run and understates the next; the session total stays right. A cut at a command that is not a run makes a part too many; a missed cut merges two runs (today's behaviour).

- **Q1 RULING — A** ("A, go with reco"): a lane counts whole in the part where its first record falls. The totals print a count of lanes that end under a later command.

## Plan (2026-11-22)

Brief: `docs/plans/2026-11-22-skills-cb5t-runmeter-per-run-split/plan.md` (frozen). Sketch executed on base `5eaa942`: `node --test scripts/test/runmeter.test.mjs` → tests 63 · fail 0. Gate R2 (`gate/parts-sum.mjs`, 1463 sequences): PASS; mutants m1, m3 FAIL. Predicted red set on the tests commit: 9 (T1–T7, the `--json` shape test, the doc "session is not a run" test).

Attack lane findings folded into the sketch: two commands in one turn no longer drop a part (T7); text output no longer copies a growing list per lane.

Freeze: `python3 freeze_check.py docs/plans/2026-11-22-skills-cb5t-runmeter-per-run-split/plan.md --repo .worktrees/cb5t-main` → `PASS`. Run without `--listing`: the house lessons file has no `- Lesson (<tag>):` lines, so the tool reads it as unusable; lessons checked by hand in the brief's header.

> **What this is about:** how the parts are cut and printed, in the cases the ticket and the one ruling leave open. Each line below was a default; the owner ruled all ten as recommended on 2026-11-22. Readings: the brief's §2 Partition and Attack readings, tests T1–T8. An answer that changes one becomes a §9 row before `run`.

ruled: D1 a message counts in the part of its first record — as §2 2c (owner: "go with reco on all defaults")
ruled: D2 an owner turn counts in the part of its last owner record — as §2 2a (owner: "go with reco on all defaults")
ruled: D3 a part a command opened is always kept; part 0 is dropped when it has no message, turn or lane — as §2 2c (owner: "go with reco on all defaults")
ruled: D4 cuts read over the whole file; figures over the window; a part keeps its command's label before the window — as §2 2b, 2c (owner: "go with reco on all defaults")
ruled: D5 part lines only for a session of two parts or more, no model or effort per part — as §2 2f (owner: "go with reco on all defaults")
ruled: D6 part 0 before the first command, part N the Nth owner skill command in the file — as §2 2b (owner: "go with reco on all defaults")
ruled: D7 every owner-typed skill command cuts, any skill, labelled or not — as §2 2b (owner: "go with reco on all defaults")
ruled: D8 part minutes run over the part's own records; parts' minutes can sum below the session's — as §2 2c (owner: "go with reco on all defaults")
ruled: D9 the crossing count prints in text only when not zero, always in JSON — as §2 2e (owner: "go with reco on all defaults")
ruled: D10 a lane ending at the next command's exact instant does not cross it (strict `>`) — as §2 2d (owner: "go with reco on all defaults")

unruled: none

## Run (2026-11-23)

PR: https://github.com/strandic/skills/pull/16 (branch `cb5t-runmeter-parts`). Its Verification, Decisions and Findings tables hold the readings and every row.

- Tests first: `f62c976` on the base code, `tests 63 · pass 54 · fail 9`, the predicted red set.
- R1 PASS (`tests 63 · pass 63 · fail 0`); R2 PASS (`graded 1463/1463 · crashed 0`).
- Full suite: `tests 678 · pass 675 · fail 1 · skipped 2`, the same failure and skips as the base `1f961fb`.
- Review: two code-review rounds. Round 1 found four doc fixes, applied under ruling W3a. Round 2 found no problem in the fix.
- DEFAULT rows: W3b, the `--labels` flag row and the test header go to `skills-jmj3`.
- check_pr: FAIL (10), all M1 (`D<n> has a second line`), judged false; ticket `skills-q44n`.
