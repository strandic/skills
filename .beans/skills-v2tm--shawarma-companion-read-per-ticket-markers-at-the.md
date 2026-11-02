---
# skills-v2tm
title: 'shawarma-companion: read per-ticket markers at the root and in worktrees'
status: todo
type: feature
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-02T21:29:31Z
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



## Plan (2026-11-02) — brief, awaiting go

Brief: `docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/plan.md` (sketch `docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/sketch.patch`, research and lane 3a reports in `docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/reports/`, rulings in `docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/decisions.md`).

```
$ python3 -I <skill>/freeze_check.py docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/plan.md --repo .
PASS
```

Executed at plan time: sketch on base f1fc87e → `claude plugin test` 151 pass / 0 fail; `claude plugin validate` passes; tsc exit 0; predicted red set on the base modules 26 pass / 125 fail; six mutants killed; lane 3a three rounds (1000-sequence oracle: 0 label or order errors; F4 left). Rulings this plan added: Q5 (stale after 12 h), Q6 (bounds W+4M / W+2M / W+M, caps 50 worktrees and 20 markers).

> **What this is about:** a sibling session's marker rewritten with the same time stamp is caught at the next tool call or turn end, not by the 15 s check.

unruled: D7 same-mtime rewrite missed by the 15 s check — default accept: the check stays listing-only; sub-millisecond file times here, reached only by a forced `touch -m`

> **What this is about:** at a width below the label plus the ticket, the ticket is cut before the label.

unruled: D8 very narrow rows cut the ticket before `stale:` — default accept

> **What this is about:** a drawn marker whose plan files cannot be read is dropped from the band, not replaced or counted; the pane says it could not be read.

unruled: D9 an unreadable drawn row is dropped, not counted — default accept

> **What this is about:** eight carried-over tests still say "W + 3M" in their names while asserting a stricter count.

unruled: D10 test names that say W + 3M — default rename them to the Q6 bounds in the tests commit



**Added 2026-11-02 after a security review of the sketch:**

> **What this is about:** a marker can name a plan folder anywhere on disk, and the mod then reads its plan.md and decisions.md; a cloned repo could ship such a marker.

unruled: D11 plan folders outside the marker's own tree — default refuse them: a problem row that reads no file (replaces pi0y L6)

> **What this is about:** the pane follows a symlinked plan.md that the band skips.

unruled: D12 pane and band read the same files — default the pane reads only regular, non-link files from its listing



## Run paused (2026-11-02): 2 rulings, Wave 3 round 1

Branch feat/v2tm-per-ticket-markers at 3ce8d6b. Suite 162 pass / 0 fail. Rulings asked: (1) the symlinked plan dir that gets around D11 — the real-path check costs W + 5M on a cold call (Q6 says W + 4M); (2) the pane sentence when a listed marker could not be read (§3 2i). Labels: docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/reports/run/w3-round1.md.



## Run paused again (2026-11-02): third review round is a ruling

At f87cb20, 175 pass. Round 2 fixed the symlink, /tmp and pane findings, but its real-path check stats marker-spelled paths before containment (automated security review), caches a missing folder forever (a link made later leads outside), and compares with unresolved tree roots (inside folders refused). Labels: reports/run/w3-round2.md.



## Run paused (2026-11-02): fourth-round ruling

At 03e0607, 184 pass. Round 3 fixed its targets; new: the pane and the 15 s check can still read or list a missing plan folder that became a link out, until the next refresh (medium); a hanging stat costs 2 s on every refresh (low). Labels: reports/run/w3-round3.md.
