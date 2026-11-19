---
# skills-0vqz
title: 'shawarma check_pr trivial path: P9 reads a note.md ticket as ''note'', P4 wants rulings in bold — note form is never stated'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-17T20:00:29Z
updated_at: 2026-11-17T20:00:29Z
---

Handoff from a project using strandic 0.10.1, received 2026-11-17. On the trivial path, `check_pr.py` reports two failures that come from how the plan note is written, not from anything wrong with the PR. The skill never tells the author the form the checker expects. The project hit these false failures on three trivial PRs in a row, and each time disclosed them as false under Verification.

Line numbers are for `skills/shawarma/check_pr.py` on main (0.10.1); both readings below were checked against that code.

## 1. P9 reads the ticket id as `note`

- `ticket_id()` (`check_pr.py:800-803`) takes the id from a heading that holds only the id (`^#\s+(\S+)\s*$`). Without one, it takes the file name up to `--`.
- SKILL.md's triage says only "The ticket note, per house rules" (`SKILL.md:23`). So house rules may commit the note as `docs/plans/<date>-<ticket>-<name>/note.md`, headed `# ABC-123 — <ticket title>`.
- That heading does not match, because the title follows the id. The file name then gives `note`, and P9 fails: `<sha>: touches ['<file>'] with no `plan(note)` commit among its ancestors`.
- Repro: commit a note named `note.md` whose first line is `# ABC-123 — Some title`, add a code commit on top, run `check_pr.py note.md body.md --repo . --base <base>`. Result: FAIL P9. The same content saved as `ABC-123--note.md` passes.

Options, any one:
- [ ] (a) accept an id followed by a title in the heading, e.g. `^#\s+([A-Z][A-Z0-9]*-\d+)\b`;
- [ ] (b) fall back to the id in the plan dir's name, `<date>-<ticket>-<name>`;
- [ ] (c) state the required heading or file-name form in SKILL.md where it describes the trivial note.

Note: skills-kxko (the skill never says when to commit the plan note) proposes exactly `docs/plans/<date>-<ticket>-<name>/note.md` as the trivial checker argument. If that lands without (a) or (b), every trivial run hits this failure. Weigh the two together.

## 2. P4 wants ruling ids in bold in the trivial note

- In trivial mode, P4 requires each RULING row's id in the PR's Decisions table to be on an `unruled:` line or written in bold in the note (`check_pr.py:640-649`, `rec.known` at `:368`, bold ids collected at `:443-446`).
- A note that names its rulings in plain text ("after rulings Q1 and Q2") fails: `RULING row's ids ['Q1'] are in no `unruled:` line or bold id of the ticket`. This happens even though the plan dir's `decisions.md` records each ruling as `<date> | Q1 RULING | …`, the record SKILL.md's State files section requires (`SKILL.md:19`).
- Repro: a trivial note naming Q1 in plain text, a `decisions.md` with a `Q1 RULING` line, and a PR body whose Decisions table has a `Q1` RULING row. Result: FAIL P4. Writing `**Q1**` in the note makes it pass.

Options:
- [ ] (a) also accept an id that the plan dir's `decisions.md` records as RULING;
- [ ] (b) or say in SKILL.md that a trivial note names its rulings in bold.

## Impact

No wrong output reaches anyone. But each false failure makes the author disclose it and file a ticket against the checker. That is recurring overhead on the cheapest path the skill offers.

The handoff's repro for item 2 arrived partly garbled; it is restated above from the checker's code, not quoted.

**Filed 2026-11-17, for the next retro.** The skill changes only at a retro.
