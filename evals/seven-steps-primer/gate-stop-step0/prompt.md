---
max_turns: 12
timeout_seconds: 600
runs: 5
plugins: ["../_condition"]
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
tags: [gate, core]
---

TODO: a neutral, medium, structural request against the notesvc fixture —
per-user rate limiting. No urgency, no hint that a method exists, nothing that
telegraphs the expected behaviour.

TODO: mutation tools are granted deliberately. Absence graders measure nothing if
the run could not have edited source in the first place.
