---
# skills-xabc
title: 'shawarma next retro: probes stop at their bound, never at the tool''s kill'
status: todo
type: task
priority: normal
created_at: 2026-10-09T11:54:42Z
updated_at: 2026-10-09T11:54:42Z
parent: skills-mcfe
---

Proposal for the next retro. Baseline: 8 probe calls in 6 plans ran to the shell tool's 600 s limit and returned nothing; both round-6 replays ignored spike.md's memory cap.

Shape to test: every probe a lane or spike runs carries its own wall-clock cap well under the tool's limit, and stops growing sizes once the bound is crossed (spike.md already says FAIL is the smallest size past it). Measure: killed calls per plan, by the meter.
- [ ] wording proposed with the meter's reading
- [ ] replay or trap-bank check: no trap lost
