---
# skills-bnbu
title: 'shawarma-companion: store clean-up is bounded per call, not per pass, and can hold the first tool call for minutes'
status: in-progress
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-20T17:48:02Z
---

restore() prunes up to 100 other entries, racing each store.get and store.delete against 2 s separately. Reads answering in 1.9 s hold the first writing call (or session start) about 190 s (B5, F5); a hanging store.delete holds it 200 s (B7, F7, pre-existing). Give the whole pass one deadline, or run it off the tool call's path. Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.



## Design interview (2026-11-20)

- **Q1 RULING (owner: "Go with reco")**: A. One 2 s deadline for the whole clean-up pass (key listing, entry reads, deletes), still on the tool call's path. The read of the session's own entry keeps its own 2 s. Rejected: B (background pass from session start), C (background plus deadline). Research: docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/reports/research/report.md.

- **Q2 RULING (owner: "Go with reco")**: A. Fold skills-6y0d. A late or failed read skips that entry; the pass goes on until the deadline; each pass starts at an offset derived from the session id and wraps. Amends s6qg Q7 N3 for this mod.
- Error directions: deleting a live entry corrupts output (a resumed session loses its claims); deleting too little only grows the store. The frozen rule never errs the first way.
- Interview done; design settled. Gate: kit tests (no live dataset: the store cannot be slowed on the real engine).


## Plan paused: 1 question (2026-11-20)

Spike on base `2e63362` (mod files as `1eed2e3`), sketch `docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/sketch/sketch.patch` (6 files, 182 insertions, 19 deletions), in `.worktrees/bnbu-spike`:
- `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion`: sketch `285 pass` / `0 fail`; base modules with the new tests `277 pass` / `9 fail` (U1 ×2, U2, U3, U4, U5, U6, U7, "the file ran to its end"). Base alone `277 pass` / `0 fail`.
- U1 readings (engine ms held / reads asked): sketch 2500 / 5 at 0.5 s reads, 3900 / 3 at 1.9 s; base 10000 (cap) / 21 and 6. U2 base 200 s. U4 sketch [50, 16, 0] (Python FNV simulation agrees), base [150, 150, 150].
- Nearest wrong fixes: no skip → U3 red; start 0 → U4 red; late read skipped instead of ending → U1 ×2 red (101 reads asked).
- `claude-personal plugin validate`: `✔ Validation passed`. `tsc -p` against the 2.1.329 types: exit 0.
- Attack lane (`reports/attack/report.md`): A1, A2, A3, A6–A9, D1–D4, D6 hold. Fixed in the sketch: D5 (a listed entry reading as none was deleted: now skipped, test U6), docs overclaims (A5, A7), session-start hold untested (U7).

**Q3 (RULING, open)**: A4. A late or racing delete can remove an entry its owner rewrote between our read and our delete (base deletes 2 such entries in the probe, the sketch 1). Pre-existing, and the store has no compare-and-set. Options: A accept as a residual and file a new ticket (reco); B re-read just before each delete (narrows it, still racy, about double the reads); C stop deleting other sessions' entries.

unruled: D1 version — default 0.3.1 with a Fixed entry
unruled: D2 A5 (a refused clock timer leaves every 2 s bound open, pre-existing) — default a new ticket
unruled: D3 S30 fixture (future entry moved to index 50, assertions unchanged, passes on base and sketch) — default as sketched


**Q3, D1–D3 ruled (owner: "Go with reco")**: Q3 A, the delete race accepted as a residual, bean skills-hybo. D1 0.3.1. D2 the refused timer to bean skills-vmhr. D3 S30 fixture as sketched.


## Plan: brief frozen (2026-11-20)

Brief: docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/plan.md. `python3 …/shawarma/freeze_check.py docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/plan.md --repo . --listing <(grep -n '^- Lesson (' docs/plans/lessons.md)` → `PASS`.
Sketch suite `285 pass` / `0 fail`; predicted red set on the tests commit `277 pass` / `9 fail` / `Ran 286 tests across 1 file.`; R1 FAIL reading on mutant m3 `282 pass` / `3 fail`.

unruled: none
