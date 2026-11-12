---
# skills-s2ae
title: 'shawarma: review rounds that do not converge'
status: todo
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-11T11:36:35Z
---

Filed by the round-9 retro (D6), 2026-11-02. Evidence: the round-9 record (private).

run.md rules on a third review round (a RULING) and on nothing after it. Ten runs had 3+ rounds; one had 5 and was stopped by a ruling; in another, round 2 introduced a regression that round 3 caught. Decide what a fourth round needs and when a round's fix gets its own fresh lane.


## Review of 2026-11-11

Case: the per-ticket-markers run in this repository (pull request 5) went five review rounds, and rounds 2 to 4 each found a defect in the previous round's fix. Each round past the second was put to the owner as a yes-or-no ruling and answered as recommended.

For round 11:

- Ask the owner whether "round" means a review pass (the review's recommendation). Readers of run.md split on whether it means a review pass or a fix commit.
- Round 8 drafted a rule for this (at the third-round ruling, show how much each round changed and offer to redo the design) and did not adopt it. Replay it on paper over the recorded runs before wording it again: as a blanket rule, "a finding caused by a fix made in this run" would fire in most runs that reach a fix review.
- EGM's wording for the same event is on the EGM ticket (skills-8yf4).
