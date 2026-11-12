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
