---
# skills-cm2l
title: 'shawarma-companion: one failed check empties the row until the next tool call'
status: in-progress
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-01T06:52:49Z
updated_at: 2026-11-20T17:10:09Z
---

In mods/shawarma-companion, a single fs error during the 15 s check (for example EACCES on decisions.md once) clears the row and stops the check. The row stays empty until the next tool call or turn end, even after the error goes away. Allowed by the skills-pi0y brief §6 (an empty row), but the check could keep running and redraw. Found by the skills-pi0y fix-review lane (F7).

## Design interview (2026-11-20)

Reproduced on `a70d50c` (spike probes P1, P2, `claude plugin test` on 2.1.329): one failed read of `decisions.md` during the 15 s check, or one rejected `fs.exists` there, empties the row; after the error clears, 0 fs calls in the next 60 s and the row stays empty. Research: `docs/plans/2026-11-20-skills-cm2l-check-survives-a-failed-pass/reports/research/report.md`.

Rulings (decisions.md):
- **Q1 = A.** A row whose files fail to read is drawn as `shawarma: <ticket>: could not be read`, redrawn in full once they read again.
- **Q2 = A.** No limit: the check re-reads a problem row every 15 s while the read fails.
- **Q3 = A.** skills-0wsk folded in: a check that fails as a whole clears the rows and the other-runs counts, marks the scan failed, and keeps checking.

Error directions: (1) a row shows `could not be read` or nothing while the run's files are readable — an inconvenience, gone within 15 s; (2) a row shows a step, title or count from before a failed read — wrong output. The frozen rule never errs the second way.

## Plan paused: 3 questions (2026-11-20)

Spike on `1eed2e3` (sketch `docs/plans/2026-11-20-skills-cm2l-check-survives-a-failed-pass/sketch/sketch.patch`, 5 files). `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion`: sketch `290 pass` / `0 fail`; base modules with the sketch's tests `274 pass` / `16 fail` (4 changed tests, 12 new red); nearest wrong fix (problem row never re-read) `281 pass` / `2 fail` (C1, C2, at 283 tests). `plugin validate`: `✔ Validation passed`. tsc 6.0.3 on the 2.1.325 types: exit 0. Attack lane: `reports/attack/report.md`.

- **Q4 (RULING)** fold lane finding A1+: one failed listing of the plan dir in a check leaves `… · 0 decisions · plan dir not readable: …` until the next tool call. Variant `sketch/q4-variant.md`: recovers in one pass; reverses test N11.
- **Q5 (RULING)** the `0 decisions` such a row shows while decisions.md holds rulings: fold or new ticket.
- **Q6 (RULING)** the four existing tests whose expectations Q1 flips, and the pane's `<n> markers could not be read.` line removed.
- Defaults: D1 version 0.3.1; D2 new ticket for a refused `clock.every` period (the check stops for good, the band keeps old content; lane A11a); D3 a note on skills-y1gt (a hanging read keeps the old count while pending; lane A8).

## Plan ending: brief (2026-11-20)

Q4–Q6 and D1–D3 ruled "go with reco" (decisions.md). Brief: `docs/plans/2026-11-20-skills-cm2l-check-survives-a-failed-pass/plan.md`. Re-spiked on the ruled design: sketch `291 pass` / `0 fail`; base modules with the final tests `273 pass` / `18 fail`. New beans skills-6loo (Q5) and skills-vtd4 (D2); note on skills-y1gt (D3).

`freeze_check.py docs/plans/2026-11-20-skills-cm2l-check-survives-a-failed-pass/plan.md --repo .worktrees/cm2l-spike --listing <grep -n '^- Lesson (' docs/plans/lessons.md, empty> --ticket <this bean>`: `PASS`.

unruled: none
