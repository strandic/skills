---
# skills-p03h
title: 'shawarma: batch triage — run the Trivial test over a ticket list, clear the trivial ones'
status: todo
type: feature
tags:
    - shawarma
created_at: 2026-10-28T09:16:26Z
updated_at: 2026-10-28T09:16:26Z
---

Owner request, 2026-10-28: run shawarma's **Trivial** test (SKILL.md, Triage) on a batch of tickets and clear the trivial ones fast. The method finds issues faster than they get closed. Open backlog today, by `beans list --json` counted by status: bigbrain 87 todo + 16 draft, incurio-frontend 149 todo + 32 draft. BioJoule tickets live outside beans (BIO-nnnn).

## What exists

- The test is one bullet in SKILL.md. It is applied by reading, to one ticket, inside `plan <ticket>`. Nothing runs it on a list.
- A precedent for fan-out: `retro-workflow.js` runs read-only agents through the Workflow tool and ends with propositions for the human.
- A trivial ticket still needs a ticket note (sites · red check · worst case · sources) and a go. The go then follows run step 6 (one PR, the readings in place of a review wave).

## Sketch (to rule)

- [ ] **Entry point.** A `triage <query>` dispatch line in SKILL.md, backed by a `triage-workflow.js` beside `retro-workflow.js`. The query is whatever the house rules say lists tickets (`beans list --json --status todo`, a Linear filter, …). The house rules name the command; the skill does not.
- [ ] **Stage 1, screen (read-only, one agent per ticket).** Output one row per ticket: id · verdict (`trivial` / `briefed` / `question`) · the failing clause when not trivial · sites · the proposed red check (described, not run) · worst case. A ticket the screen cannot decide is `question`, never `trivial`.
- [ ] **Stage 2, the owner rules the table in one ask.** Recommended: each `trivial` row is a DEFAULT; striking one sends it to `plan`. One ask for the whole batch, not one per ticket.
- [ ] **Stage 3, per accepted row.** The ticket note gets written, with the red check executed on the base. If the check is not red, or the diff grows past the test, the row drops back to `plan`. Decide: does one go cover the whole accepted batch, or one go per ticket? (u376 is related: who may give the go.)
- [ ] **Concurrency.** N trivial fixes means N branches or worktrees and N PRs ("Two paths only"; siblings fold only under the Siblings rule). Depends on skills-lhdg (one marker per session).
- [ ] **Not-trivial output is still useful.** `briefed` rows carry the failing clause. Decide whether the screen also writes it on the ticket, so `plan` starts warmer.

## How we know it works (pre-register before building)

The costly error is a false `trivial`: a structural change that skips the brief. Precision matters more than recall.

- [ ] Labelled set: past tickets whose plan ending is on record (trivial note vs brief) in bigbrain, BioJoule and incurio. Add the looks-trivial-is-structural trap from the primer evals (skills-2q2k).
- [ ] Measures: false-trivial count (target 0 on the trap set), recall on known trivials, tokens and minutes per ticket screened.
- [ ] Replay the screen against tickets at the commit before their real plan, as `retro-workflow.js` replays plans.

The skill changes only at a retro (retro.md). This lands as a round-9 proposition with the size meter reading for the new load path.
