---
# skills-jk6n
title: 'shawarma: a freeze-check script for the brief''s mechanical rules'
status: completed
type: task
priority: normal
created_at: 2026-09-24T15:53:50Z
updated_at: 2026-10-19T16:19:51Z
parent: skills-sp16
---

Move the checkable freeze conditions out of prose into a script the planner runs before freezing a brief: the plan-validate-execute pattern from Anthropic's skill guidance, where only a script's output enters context.

Candidates: the `unruled:` line on every plan ending; `-> oracle <name>` on every section 7 attack line; a command, a settle clause and a FAIL reading on every section 5 rule; lane cells kept as template text (no class word); a DECLINE carrying one class word from the fixed list.

It earns its place only by deleting the prose it replaces (an earlier vocabulary-check proposal was declined once the drift it targeted disappeared). Its pass/fail per run becomes a free conformance reading, so compliance items can leave the replay rubrics.

Lands at a retro, validated on the trap bank.

- [x] script and the prose it deletes, drafted together
- [x] word delta reported
- [x] trap bank: no trap lost

## Round 7

R1/R8: this ticket carries the plan path's gap to 6.5k (~7.1k measured, interview + brief ~7.3k) into round 8, judged on the round-7 trap bank. Cold-reader items not reworded in round 7 are listed in the round-7 record.

## Summary of Changes

Shipped in v0.8.0 (a352910): skills/shawarma/freeze_check.py (F1–F9, --fields, --listing, --repo) with 36 tests; plan step 5's freeze list is one sentence plus the script (plan.md 3 409 words, ~7.1k). Trap bank: 63at T2 lost in early runs; six runs (R8–R10) put the before text at 0.5 in 3 of 6, so the gap reads as noise (pooled 5/8 vs 5/15, Fisher one-sided p ≈ 0.18) and the cut ships. 63at T2 is watched in round 9 (x895). Residue: freeze_check accepts a class-word claim whose §7 line never reads the base. Record: bigbrain docs/retros/2026-10-18-shawarma-round-8/ replays/summary.md.
