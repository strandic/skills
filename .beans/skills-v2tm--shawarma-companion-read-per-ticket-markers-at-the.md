---
# skills-v2tm
title: 'shawarma-companion: read per-ticket markers at the root and in worktrees'
status: todo
type: feature
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-02T16:58:22Z
---

Filed by the round-9 retro (D6), 2026-11-02. Evidence: the round-9 record (private). (R8.)

The skill now writes `.shawarma/active-<ticket>` (also on a trivial go, line 1 the ticket, line 2 `trivial`) with any tool. The mod scans `.shawarma/active-*` at the git root and in `.worktrees/*/` instead of learning paths from Write/Edit calls, and shows one row per live marker. Supersedes skills-nucr and skills-ox8b's mod side.



## Design interview (2026-11-02) — outcome

Research: `docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/reports/research.md`. Rulings, owner's words, in that folder's `decisions.md`:
- **Q1** "Drop 'unconfirmed'": no `unconfirmed:` label; `earlier session:` stays; each row names its ticket. Session id in the marker → skills-mvfd (next retro).
- **Q2** "git worktree list": worktrees from `git worktree list --porcelain` (cached per turn; main checkout first); fallback: git root + `<main>/.worktrees/*` via the file API.
- **Q3** "Scale with W and M" (RULING, replaces pi0y 3e): per tool call ≤ W + 3M file operations plus 1 cached worktree list per turn; per 15 s check ≤ W + 2M, no reads unless changed.
- **Q4** "Own tree first, pane per row": own tree's marker first, then newest first; a row press opens the pane on that ticket; the pane header lists the others.
- **D1–D6** ("Go"): trivial rows; leftover markers dimmed, no cutoff; prunable skipped, locked read; old `.shawarma/active` dropped; error directions (a row never reads current unless newer than the session start); `fs.list` on a missing folder settled by a probe.
