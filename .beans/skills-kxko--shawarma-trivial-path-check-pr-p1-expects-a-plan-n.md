---
# skills-kxko
title: 'shawarma: the skill never says when to commit the plan note, which check_pr P1 and P9 both need (trivial path, tracker tickets)'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-11T12:13:09Z
updated_at: 2026-11-11T12:17:19Z
---

Field report, 2026-11-11, from a trivial-path run in another repo. First seen on strandic 0.9.0; re-checked against shawarma 0.10.1. Line numbers below are for 0.10.1, and each claim below was checked against that code.

## What happened (0.9.0)

A trivial-path run reached Wave 4 in a repo whose tickets live in Linear. `check_pr.py <ticket> <body> --repo <worktree>` printed `FAIL P1 line 1: first line does not link the plan ending (brief/plan + commit)`. The plan note was a Linear comment, so the first line of the PR body had no SHA to give. The run disclosed the FAIL in the PR's Verification table and left the records unchanged, as run.md step 6 says.

Evidence: biojoule/infrastructure PR 1776 (BIO-1463).

## What 0.10.1 changes, and what it leaves open

1. **P9 requires the plan commit, but the prose never asks for it.** `check_pr.py:51-53`: every commit that touches a path outside `docs/`, `.beans/` and `*.md` needs a `plan(<ticket>)` commit among its ancestors. `grep -n 'plan(' skills/shawarma/*.md` finds nothing. SKILL.md (Triage › Trivial), plan.md step 5 and run.md never say to make this commit, what it holds, or what its subject is. A run that follows the prose fails P9 on its first code commit.
2. **The trivial path no longer says how to run the checker.** 0.10.1 removed `with check_pr.py <ticket> <body>` from SKILL.md's trivial line. The line still says "as in run step 6", but run.md step 6 gives only the brief form (`<brief> <body> --repo … --tests-commit …`). The checker's trivial mode still expects a ticket file with a `## Plan (<date>)` heading (`check_pr.py:58-62`, `:433`).
3. **The skeleton still asks for a plan-note commit.** `check_pr.py:164-165` says that on the trivial path the first line links "the ticket's plan-note commit" (`Plan ending: [trivial note <sha>](<link>) · ticket <id>`). This matches P9, but nothing in the prose makes that commit.
4. **Tickets kept in a tracker have no ticket file.** When tickets live in Linear rather than in the repo (as `.beans/` files), trivial mode has no file to read, and the `## Plan` note has no obvious place. The run built a local copy (the ticket text plus the note under `## Plan (<date>)`) only to feed the checker.
5. **P1's SHA test is loose.** `check_pr.py:580` accepts any run of 7 to 40 hex characters anywhere on the first line. Unlike the SHA test at `:725`, it does not require a digit, and it does not check that the commit holds the plan. A base-commit SHA passes, and so does a word like `defaced`.

## Suggested fix, for the retro to weigh

- [ ] Name the plan commit in the prose for both the brief ending and the trivial ending. Commit the plan note as `plan(<ticket>): …` before any code, under `docs/plans/<date>-<ticket>-<name>/`. On the brief path that file is the brief. On the trivial path it is `note.md` with a `## Plan (<date>)` heading. House rules can override the location.
- [ ] In trivial mode, make that committed file the checker's `<ticket>` argument, and put the trivial form of the checker call back into run step 6.
- [ ] Tighten P1. The SHA must hold a digit. With `--repo`, it must be the `plan(<ticket>)` commit that P9 found.

Fallback options from the first report, if the retro rejects a committed note: let P1 accept a tracker comment URL in trivial mode, or at least make SKILL.md's trivial line and the skeleton say the same thing.

**Filed 2026-11-11, updated the same day after 0.10.1, for the next retro.** The skill changes only at a retro.
