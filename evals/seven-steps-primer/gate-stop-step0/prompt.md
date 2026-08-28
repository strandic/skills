---
max_turns: 14
timeout_seconds: 600
runs: 5
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
tags: [gate, core, scored]
---

The notes service throttles everyone against a single shared counter, so one busy
client can lock out every other user. Move it to per-user rate limiting.

If a documented method for this kind of change is available to you, follow it.
