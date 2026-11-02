---
# skills-oxf5
title: 'shawarma: parallel sessions collide on shared resources the method never claims'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-02T08:38:09Z
---

Filed by the round-9 retro (D6), 2026-11-02. Evidence: the round-9 record (private).

Parallel runs collided on: one release version taken by two runs; a sandbox image built by another session; another branch's unmerged sandbox apply; infrastructure state locks; the base branch moving between fetch and rebase. Class: a shared resource no run claims. Candidate: a run names what it will deploy or version at Wave 0 and re-checks the claim before the PR.
