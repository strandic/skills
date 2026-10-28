---
# skills-9064
title: 'shawarma retro: an init command for house rules and CODING_STANDARDS.md'
status: todo
type: feature
priority: normal
tags:
    - shawarma
created_at: 2026-10-13T12:56:49Z
updated_at: 2026-10-28T10:26:07Z
blocked_by:
    - skills-iim2
---

Add an `init` command to shawarma. It writes a repo's house rules (`docs/plans/README.md`) and its CODING_STANDARDS.md from an inventory of the existing code. Today the skill falls back to defaults when there are no house rules, and nothing creates them. Depends on skills-iim2 for the standards rule format.

Proposed (input to the next retro; the skill text changes only there):
- [ ] **A script, not more SKILL.md text.** `init-workflow.js` beside retro-workflow.js. SKILL.md gains one or two lines pointing to it. Setup steps never load during `plan` or `run`.
- [ ] **Inventory.** (1) What is already enforced: linters, formatters, compiler or type-checker strictness, CI. The file points to these and does not restate them. (2) Conventions in the code: error handling, module boundaries, naming, test style (mocks, fixtures, testing through public interfaces). Each count is shown beside the command that produced it. (3) Problems in the history: PR review comments, fix and revert commits, lessons.md, earlier retros.
- [ ] **Evidence or nothing.** Every candidate rule cites `path:line` and a count, or a past fix. Rules imported from outside the repo, such as Matt Pocock's test rules, go in only by ruling.
- [ ] **Asking the human, using the RULING/DEFAULT split.** Already enforced: a pointer, no ask. Consistent in the code, or backed by a past fix: a DEFAULT, listed with its evidence; `go` or silence accepts it, and striking it makes it a RULING. Inconsistent in the code, or contradicting another rule: a RULING, asked in rounds of three or fewer. The human sees every candidate; the blocking questions are only the ones the code cannot answer.
- [ ] **Never overwrites.** If either file exists, `init` proposes differences only. After the first run, only the retro changes the standards.
- [ ] **Read-only on the code.** It follows the repo's data rules and starts no servers. It commits only the two files, per house rules.
- [ ] Try it on one host repo before adopting it. Record how many candidates it found, how many were DEFAULTs or RULINGs, and how many the human struck.

## Round 7

Dropped this round (R7): adds lane text with no case in this window. Stays open for a round that has one.
