---
# skills-j1ck
title: 'shawarma retro: count escaped defects per shipped PR'
status: todo
type: task
priority: normal
created_at: 2026-09-24T15:53:50Z
updated_at: 2026-10-09T05:59:34Z
parent: skills-sp16
---

The outcome measure the retros lack: defects found after merge, traced to the PR that shipped them.

- the retro's evidence lanes list the bug tickets filed since the last retro and trace each to its introducing PR (`git log` / `git blame`), counting those shipped through the method
- reported beside the pre-registered measures; no threshold until two retros have read it

- [ ] evidence-lane prompt extended in `retro-workflow.js`
- [x] first count at the next retro

## Round 6 (2026-10-09, bigbrain docs/retros/2026-10-08-shawarma-round-6/, skill v0.6.0 0f5fa13)

First count taken (by hand, not yet in retro-workflow.js): measure M1 — bug tickets created ≤7 days after a run's merge whose cause is code that run merged, identical-on-base excluded. Reading on PRs #113–#120: 1 of 8 (n3kj ← jwhc's unreviewed review-round commit). Pre-registered with a consequence (≥1 escape from a commit that had a fix-review lane reopens R1). Remaining: extend the evidence-lane prompt.
