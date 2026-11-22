---
# skills-4eqz
title: 'check_pr P11: a suite rule whose command names a folder flags the contract''s own files as changed gate tools'
status: completed
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-22T07:46:45Z
updated_at: 2026-11-22T07:46:45Z
---

Found by the skills-bnbu run, gate (2026-11-22). §5 R1's command is 'claude-personal plugin test mods/shawarma-companion': gate_files returns the folder, in_s3 does not match a folder against §3's file rows, and git diff --numstat over the folder lists every changed file. So P11 printed 'FAIL P11 mods/shawarma-companion/hooks/register.tsx: changed since the freeze 039320d2 and §5 R1 runs it; no §9 RULING row names R1' for all six files, though each is a §3 contract file (the contract's own change, which P11 means to exempt). Expected: a path under a gate folder that §3 names is exempt, as a file §3 names is.

## Plan (2026-11-22): trivial

Planned on base `bb89183 plan(skills-oz54): spike, research and attack lanes, sketch — paused on Q1`, skill strandic 0.11.0. Sketch: `docs/plans/2026-11-22-skills-4eqz-p11-gate-folder-exempt/sketch.patch` (executed in `.worktrees/4eqz-spike`). Lessons since the last retro marker: skills-v2tm ×3, skills-bnbu ×2 — none matches (no links, waits or docs-word bounds in this change).

- **Sites.** `skills/shawarma/check_pr.py`: `Records.__init__` (new `s3_paths`), `brief_records` (§3 parse fills `s3_paths`), `gate_change_fails` (skip a numstat path in `s3_paths`), the P11 header paragraph (one added sentence). `skills/shawarma/test_checks.py`: one new test, `ReviewRound11.test_p11_a_file_section_3_names_under_a_gate_folder_is_no_gate_change`. No skill text (SKILL.md, plan.md, run.md…) changes.
- **Design (D1, DEFAULT).** A path that `git diff --numstat` lists under a gate folder is exempt only when §3 names that exact path. A later name in a §3 cell is also read under the first name's folder, so `mods/x/README.md`, `CHANGELOG.md` covers `mods/x/CHANGELOG.md`. The existing loose suffix match (`in_s3`) still filters the rule's directly named files, unchanged.
- **Red check.** `cd skills/shawarma && python3 -m unittest test_checks -k gate_folder` on base: `AssertionError: Lists differ: ['FAIL P11 tools/kitchen/pot.py: changed s[66 chars] R1'] != []`, `FAILED (failures=1)`; with the sketch: `OK`. Full suite with the sketch: `python3 -m unittest test_checks` → `Ran 151 tests … OK`.
- **The ticket's case.** `python3 check_pr.py docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/plan.md <PR 12 body> --repo . --head fe24196d` (body from `gh pr view 12 --json body`): base → six `FAIL P11 mods/shawarma-companion/…` lines, `FAIL (6)`; sketch → `PASS`.
- **Why not the one-line fix.** Skipping any numstat path that `in_s3` matches also passes the ticket, but `in_s3` matches by suffix: a §3 row naming a bare `pot.py` (the root file) then exempts the gate folder's own `tools/kitchen/pot.py`. Probe (scratch, executed): one-line fix → `P11 lines: []` (P11 silent on a changed gate file: wrong output); base and D1 sketch → one `FAIL P11 tools/kitchen/pot.py` line. The new test pins this case.
- **Worst case.** D1 errs only toward a false FAIL: a §3 file under the gate folder written in a form D1 does not resolve (e.g. a path relative to some other folder) still prints a P11 FAIL, as today. The author answers it with a full path in §3 or a §9 RULING. It never silences a file §3 does not name.
- **Outside behaviour.** `git diff --numstat` path output. Source: `git help diff` @ git 2.48.1, "--numstat … shows number of added and deleted lines in decimal notation and pathname without abbreviation"; executed: a rename prints `tools/kitchen/{pot.py => lid.py}` (see S2). `posixpath.normpath`/`join` @ Python 3.10.4 stdlib.

What the planner saw (not folded in; each a proposed ticket):

- **S1 (pre-existing, false PASS).** `gate_files` keeps a token only if it holds `/` or ends in an extension, so a one-segment folder (`python3 -m pytest kitchen`) is never checked by P11. Executed: the first draft of the new test, with `kitchen`, read no P11 line on base for a changed gate file. Proposed ticket.
- **S2 (pre-existing, false FAIL).** With git's default rename detection, a renamed file under a gate folder lists as `tools/kitchen/{pot.py => lid.py}`. That matches no §3 path, so P11 fails even when §3 names both names. Probe output: `FAIL P11 tools/kitchen/{pot.py => lid.py}: …`. Inconvenience only. Proposed ticket (or `--no-renames` on the numstat call).

unruled: D1 exact §3 path (with cell shorthand) for files found under a gate folder — default A (as sketched)

## Run (2026-11-22): PR 15

Trivial go; D1 stood as a DEFAULT. Branch `fix/4eqz-p11-gate-folder`, tests commit `f0a68ee`, fix `d96d4ab`, base `a4a6af1`. PR: https://github.com/strandic/skills/pull/15 — Verification and Decisions tables there.

- Suite: base `Ran 150 tests` / `OK`; head `Ran 151 tests` / `OK` (`cd skills/shawarma && python3 -m unittest test_checks`). Lint NOT RUN (no Python linter installed, fetching one refused); `py_compile` exit 0.
- PR 12's case: base `FAIL (6)` (six P11 lines), head `PASS`.
- `check_pr.py <this ticket> <body> --repo .worktrees/4eqz --tests-commit f0a68ee` (strandic 0.11.0): `PASS`.
- DEFAULT rows: D1. Findings filed: `skills-ehhw` (P11 misses a one-segment gate folder), `skills-rm6v` (a rename under a gate folder reads as an unnamed changed file).
- Rebased 2026-11-22 onto `origin/main` `c3c525d` (the first head was cut from a local main holding other sessions' unpushed commits; GitHub showed a conflict in another stream's bean). PR 15 now carries plan note `88c55bb`, tests `3a27431`, fix `6973c97`; `git range-diff` shows both code commits `=`. Re-read at `6973c97`: base `Ran 150 tests` / `OK`, head `Ran 151 tests` / `OK`, red on the tests commit as predicted, PR 12 case `FAIL (6)` → `PASS`, check_pr `PASS`. GitHub: `MERGEABLE CLEAN`.

## Merged (2026-11-22)

PR 15 merged as `445b10e`. Follow-ups: `skills-ehhw`, `skills-rm6v`.
