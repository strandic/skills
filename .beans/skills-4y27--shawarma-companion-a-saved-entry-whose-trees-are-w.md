---
# skills-4y27
title: 'shawarma-companion: a saved entry whose trees are Windows paths is read as malformed and deleted'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T18:08:25Z
updated_at: 2026-11-20T18:08:25Z
---

Found by the skills-bnbu run, adversarial lane (docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/reports/run/lane-3a/report.md, F3). Pre-existing: parseClaimed accepts only trees that start with '/'. A fresh entry whose trees are 'C:/repo' or 'C:\repo' reads as malformed, so every other session's clean-up deletes it and its own --resume reads none (H1: windows-path-fresh and backslash-path-fresh deleted on base 039320d and head 3f5c376). Reaches only Windows.
