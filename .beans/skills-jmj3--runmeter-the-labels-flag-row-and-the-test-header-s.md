---
# skills-jmj3
title: 'runmeter: the --labels flag row and the test header still name session labels only'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-11-23T06:55:47Z
updated_at: 2026-11-23T06:55:47Z
---

Since skills-cb5t, `--labels` also prints the label of each part of a session (scripts/runmeter.md Parts, Privacy rule 3). Two older sentences still speak of session labels only:

- `scripts/runmeter.md:66`, the `--labels` row of the flags table: "Also print each session's label: the first two words of the command that opened it."
- `scripts/test/runmeter.test.mjs:5-6`, the test file's header comment.

Found by the second code-review round of skills-cb5t (reading at head 252c433). Neither contradicts the code; both are incomplete. Prose only.
