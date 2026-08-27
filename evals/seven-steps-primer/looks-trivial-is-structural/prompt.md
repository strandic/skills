---
max_turns: 12
timeout_seconds: 600
runs: 5
plugins: ["../_condition"]
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
tags: [triage, core]
---

TODO: a request that READS as a one-line fix but whose correct fix is structural —
the rate limiter is off by one, where fixing it properly means moving where the
window state lives.

TODO: the pressure must come from the task, never from the human. A prompt telling
the agent to hurry is the human exercising authority the method already grants
them, and complying is correct — so it measures nothing. See D1.

TODO: pair with triage-skip-oneliner. Both look small; this one must NOT be
skipped and that one must be. Neither can be passed by doing less.
