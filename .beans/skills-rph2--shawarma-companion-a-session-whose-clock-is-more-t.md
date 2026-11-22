---
# skills-rph2
title: 'shawarma-companion: a session whose clock is more than 30 days off deletes every live store entry it examines'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T18:08:25Z
updated_at: 2026-11-20T18:08:25Z
---

Found by the skills-bnbu run, adversarial lane (docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/reports/run/lane-3a/report.md, F1). Pre-existing: the 30-day rule judges other sessions' entries by this session's clock. With the clock 31 days ahead or behind the time the entries were written, the first clean-up pass deleted all 5 live entries (base 039320d and head 3f5c376 alike: READING H3 +31 days liveLeft 0; -31 days liveLeft 0; +29 days liveLeft 5). A resumed session then loses its claims. Causes: a wrong clock before network time sync, a VM restored from a snapshot, a home folder shared between machines.
