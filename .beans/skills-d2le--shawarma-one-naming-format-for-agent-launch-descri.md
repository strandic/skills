---
# skills-d2le
title: 'shawarma: one naming format for agent-launch descriptions'
status: draft
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-11-19T19:57:35Z
updated_at: 2026-11-19T19:59:45Z
blocked_by:
    - skills-9ft8
---

Round-11 candidate (not adopted: the hold in skills-9ft8 ruling 1 applies). Refines that ticket's "one name per lane kind" item.

Agent launches in a shawarma plan or run have free-form descriptions, so a dashboard (Claude Flightdeck's architect panel, `architectPattern` + `matchDescriptions`) cannot tell consult lanes from implementer lanes: every lane is a general-purpose subagent, distinguished only by prompt.

## Proposal

One line in SKILL.md Dispatch, after the lane-launch line:

> - Every agent launch's description is `<lane> <role> <ticket-short-id>`, role from: research · spike · probe (0a) · implement · adversarial (3a) · review (3b) · fix-review · retro. Never another role word, never a role word elsewhere in it.

A role word may appear nowhere else in the description, so an implementer can't match a consult pattern by accident. Matching Flightdeck pattern, already in the owner's user settings (2026-11-19): `\b(advisor|architect|research|spike|probe|adversarial|review|retro)\b`. `implement` is deliberately the only role left out.

## Open

- [ ] `probe` for lane 0a: lanes.md has no 0a row; freeze_check.py treats `0a` as a plan-time attack-round prefix. Settle together with skills-9ft8's "a cell or a removal for the two lanes Dispatch names without one".
- [ ] Case and ruling at the next retro, like every round-11 candidate.
