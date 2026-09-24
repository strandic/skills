---
# skills-ymh2
title: Add the shawarma skill to strandic/skills
status: completed
type: task
priority: normal
created_at: 2026-09-24T15:53:10Z
updated_at: 2026-09-24T16:15:50Z
blocking:
    - skills-x895
    - skills-tkc0
    - skills-j1ck
---

Import the shawarma method skill (`/shawarma plan|run|retro`) from the local skill store into this repo as `skills/shawarma/`, so the repo becomes its canonical, versioned source and both install paths (npx, plugin marketplace) ship it.

Files, byte-identical to the installed copy (revision of 2026-09-23): `SKILL.md`, `spike.md`, `brief-template.md`, `retro-workflow.js`. Read in full for publication: generic wording, no host-project names, paths or private content.

- [x] skill files copied, byte-identical (`diff -r`)
- [x] `plugin.json` skills array; version 0.1.0 -> 0.2.0 in both manifests (plugin.json pins the version: marketplace users receive changes only on a bump)
- [x] README Skills table row
- [x] verified: `claude plugin validate --strict`, `claude plugin details` via `--plugin-dir`, native marketplace round-trip in a throwaway config dir, npx install into a temp project
- [x] published (push or PR: the maintainer's call; local main is ahead of origin)
- [x] after merge: the local skill store points at this repo's `skills/shawarma` (one copy), and retro installs commit here

## Progress 2026-09-24

Branch `feat/shawarma` (worktree `.worktrees/shawarma`), one commit on top of the beans commit. Readings: `claude plugin validate --strict` passed on both manifests; `claude plugin details --plugin-dir` lists seven-steps-primer and shawarma at 0.2.0; a marketplace add + install in a throwaway config dir cached all four files; `npx skills add <checkout> -l` listed both skills, and `--skill shawarma -a claude-code --copy` wrote all four files, byte-identical. The commit also applies cleanly onto origin/main.

Publishing waits on a decision: local main is 17 commits ahead of origin (unpushed primer-eval work), so either main is pushed with them, or this one commit goes up alone, rebased onto origin/main.

PR #2 open (2026-09-24): https://github.com/strandic/skills/pull/2 — the shawarma commit alone, rebased onto origin/main; local main's other commits stay unpushed. Merge is the maintainer's; after it, local main rebases onto origin/main and the skill store becomes a symlink to `skills/shawarma` (ruled: one copy).

## Summary of Changes

- PR #2 (rebase-merged 2026-09-24): `skills/shawarma/` (SKILL.md, spike.md, brief-template.md, retro-workflow.js, byte-identical to the installed copy), listed in `plugin.json`. Both manifests went from 0.1.0 to 0.2.0: the pinned version is what marketplace users receive, so the bump also ships the primer edits made since 0.1.0. README gained its Skills table row.
- Verified before merge: strict validation of both manifests; `plugin details` listed both skills at 0.2.0; a native marketplace round-trip in a throwaway config dir; `npx skills add` from the checkout copied all four files, byte-identical.
- After merge: local main was rebased onto origin/main (its unpushed commits replayed cleanly). The maintainer's skill store is now a symlink to this repo's `skills/shawarma`, so there is one copy and skill changes are commits here.
- Follow-up: epic skills-sp16 (repeatable evals and a smaller plan load).
