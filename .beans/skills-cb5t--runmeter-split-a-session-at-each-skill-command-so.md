---
# skills-cb5t
title: 'runmeter: split a session at each skill command, so its figures are per run'
status: todo
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
