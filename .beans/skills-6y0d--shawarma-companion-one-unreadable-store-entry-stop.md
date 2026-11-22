---
# skills-6y0d
title: 'shawarma-companion: one unreadable store entry stops every session''s clean-up, so the store grows without bound'
status: completed
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-22T07:53:21Z
---

Q7 N3 ends a prune pass at the first read that fails or runs late. If that key sorts first, no session ever deletes expired entries (B6: 0 of 4999 deleted over three ids). Skip the key instead of stopping, within a per-pass deadline. Test B6 (F6). Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.



Folded into skills-bnbu by its Q2 ruling (2026-11-20): one brief and one PR, docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/.


Fixed by skills-bnbu (folded, ruling Q2), PR 12, merged 2026-11-22 as 3f97f44.
