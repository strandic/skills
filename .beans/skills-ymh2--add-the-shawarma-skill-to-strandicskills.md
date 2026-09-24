---
# skills-ymh2
title: Add the shawarma skill to strandic/skills
status: in-progress
type: task
priority: normal
created_at: 2026-09-24T15:53:10Z
updated_at: 2026-09-24T15:54:00Z
blocking:
    - skills-x895
    - skills-tkc0
    - skills-j1ck
---

Import the shawarma method skill (`/shawarma plan|run|retro`) from the local skill store into this repo as `skills/shawarma/`, so the repo becomes its canonical, versioned source and both install paths (npx, plugin marketplace) ship it.

Files, byte-identical to the installed copy (revision of 2026-09-23): `SKILL.md`, `spike.md`, `brief-template.md`, `retro-workflow.js`. Read in full for publication: generic wording, no host-project names, paths or private content.

- [ ] skill files copied, byte-identical (`diff -r`)
- [ ] `plugin.json` skills array; version 0.1.0 -> 0.2.0 in both manifests (plugin.json pins the version: marketplace users receive changes only on a bump)
- [ ] README Skills table row
- [ ] verified: `claude plugin validate --strict`, `claude plugin details` via `--plugin-dir`, native marketplace round-trip in a throwaway config dir, npx install into a temp project
- [ ] published (push or PR: the maintainer's call; local main is ahead of origin)
- [ ] after merge: the local skill store points at this repo's `skills/shawarma` (one copy), and retro installs commit here
