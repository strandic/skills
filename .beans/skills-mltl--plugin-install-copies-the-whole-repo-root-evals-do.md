---
# skills-mltl
title: Plugin install copies the whole repo root (evals, docs, scripts, beans)
status: todo
type: task
priority: normal
created_at: 2026-09-03T09:12:45Z
updated_at: 2026-09-03T09:12:45Z
---

`.claude-plugin/marketplace.json` sets the plugin `source` to `./`, so a plugin install copies the whole repo root into `~/.claude/plugins/cache/`: `evals/` (fixture, graders, the placebo SKILL.md), `docs/`, `scripts/`, `.beans/`. The step-0 decision put the evals at the repo root to keep them out of installs; it reasoned about `npx skills add`, which copies the skill directory, and missed the plugin path.

Checked 2026-09-03 against the plugin docs and `claude plugin validate --strict`: neither `plugin.json` nor `marketplace.json` has a files, exclude or ignore field; `.gitignore` is not honoured; validate passes and says nothing. The only lever is `source` pointing at a subdirectory, and a plugin's `skills` paths cannot escape that directory with `../`.

What it costs today: cache size and a copy of the placebo on every installer's disk. Nothing loads from it: `plugin.json` declares `./skills/seven-steps-primer` only, and the placebo is not under `skills/`. So this is hygiene, not a defect in what installs.

Options:

1. Accept it and say so in the README.
2. Restructure: move `skills/` under a `plugin/` directory with its own `.claude-plugin/plugin.json`, point `source` at `./plugin`. Check first whether `npx skills add strandic/skills` still finds the skill at the new path; if it scans the whole repo it does, if it reads root `skills/` only it does not.
3. Ask upstream for an exclude field in `plugin.json`.

- [ ] decide between 1 and 2 (3 can run alongside either)
- [ ] if 2: test `npx skills add` against the new layout before moving
