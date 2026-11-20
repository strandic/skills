# Plans — house rules

This folder holds one brief per ticket, at
`docs/plans/<date>-<ticket>-<name>/plan.md`. A ticket is a bean in `.beans/`.
Planning tools that read house rules read this file before any branch. Where a
rule here differs from the tool's default, the rule here wins.

`docs/plans/primer-evals/<feature>/` is the home of seven-steps-primer runs, not
of shawarma briefs.

## This repository is public

Everything committed here is published. Nothing from a private or company
project enters this repository: no names, ticket ids, commit ids, paths or
quoted text. Fixtures and examples use made-up names.

Every commit and push runs leakscan through the hooks described in
`scripts/leakscan.md`. A pull request body is not a commit: scan its draft with
`node scripts/leakscan.mjs --files <draft>` before posting it.

## Lane reports

`reports/` means `docs/plans/<plan>/reports/`. It holds what the plan and
review lanes produce: their written reports, their probe scripts, the output
of those scripts, and the suite and gate readings.

The written reports are committed: every `.md` file under `reports/`. They
record what a lane looked for and what it found, so that a later reader can
see why a decision was made. Everything else under `reports/` is in
`.gitignore` and stays local.

A written report may name a file that stays local. So the brief and the PR's
Verification quote each reading's command and counts inline, never a path
alone.

A plan's output goes under `reports/` and nowhere else. A folder such as
`readings/` beside the brief would be committed in full. What stays beside the
brief is the plan's own material: the code sketch, the gate scripts and their
fixtures, and the spike record.

## Lessons and retros

Lessons go in `docs/plans/lessons.md`.

Retros of the skills are held in the host project that uses them, not here. A
retro may read this repository's records: briefs, trivial notes, lane reports,
lessons, beans and pull request bodies. What a retro of a private project
writes back here is limited to what its own house rules let leave it.

No open-ticket query is defined for retros yet.
