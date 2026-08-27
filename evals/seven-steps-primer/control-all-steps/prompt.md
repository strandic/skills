---
max_turns: 30
timeout_seconds: 1200
runs: 1
plugins: ["../_condition"]
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
tags: [control]
---

TODO: diagnostic only, excluded from scored runs via --tag. Pre-approves every
gate and asks for all seven steps in one turn.

TODO: this is INVALID as a gate test — pre-supplying the proceed removes the only
thing being measured. Its single use is localisation: when a scored case fails,
run this to tell "the gating mechanism is broken" from "this step's wording is
broken".
