---
# skills-cm2l
title: 'shawarma-companion: one failed check empties the row until the next tool call'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-01T06:52:49Z
updated_at: 2026-11-01T06:52:49Z
---

In mods/shawarma-companion, a single fs error during the 15 s check (for example EACCES on decisions.md once) clears the row and stops the check. The row stays empty until the next tool call or turn end, even after the error goes away. Allowed by the skills-pi0y brief §6 (an empty row), but the check could keep running and redraw. Found by the skills-pi0y fix-review lane (F7).

## Design interview (2026-11-20)

Reproduced on `a70d50c` (spike probes P1, P2, `claude plugin test` on 2.1.329): one failed read of `decisions.md` during the 15 s check, or one rejected `fs.exists` there, empties the row; after the error clears, 0 fs calls in the next 60 s and the row stays empty. Research: `docs/plans/2026-11-20-skills-cm2l-check-survives-a-failed-pass/reports/research/report.md`.

Rulings (decisions.md):
- **Q1 = A.** A row whose files fail to read is drawn as `shawarma: <ticket>: could not be read`, redrawn in full once they read again.
- **Q2 = A.** No limit: the check re-reads a problem row every 15 s while the read fails.
- **Q3 = A.** skills-0wsk folded in: a check that fails as a whole clears the rows and the other-runs counts, marks the scan failed, and keeps checking.

Error directions: (1) a row shows `could not be read` or nothing while the run's files are readable — an inconvenience, gone within 15 s; (2) a row shows a step, title or count from before a failed read — wrong output. The frozen rule never errs the second way.
