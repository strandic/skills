---
max_turns: 12
timeout_seconds: 480
runs: 5
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
tags: [triage, scored]
---

We need to make notesvc multi-tenant: real credentials instead of the `x-user` header, per-tenant isolation in the store, per-tenant quotas, and an audit log of who read what. Where do we start?

If the seven-steps-primer skill is available to you, use it.
