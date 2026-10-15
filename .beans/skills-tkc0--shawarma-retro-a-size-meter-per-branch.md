---
# skills-tkc0
title: 'shawarma retro: a size meter per branch'
status: completed
type: task
priority: normal
created_at: 2026-09-24T15:53:50Z
updated_at: 2026-10-15T17:52:47Z
parent: skills-sp16
blocking:
    - skills-p4oc
---

Report what each branch loads, measured the same way at every retro, in the word-count table the retro already writes. It is the number the size objective is judged by.

- per branch (`plan`, `run`, `retro`): the skill files it reads and their total; SKILL.md's on-invoke tokens from `claude plugin details --plugin-dir <skill>`, the other files in bytes and words
- the host's house rules and lessons-since-marker reported beside, not counted
- baseline (2026-09-24): SKILL.md ~4.3k tokens on invoke; `plan` as loaded ~8k tokens

- [x] measuring command written into the retro section or the workflow
- [x] first reading recorded at the next retro

Estimator note (2026-09-24): `claude plugin details` gives shawarma ~4.2k on-invoke tokens through `--plugin-dir` but ~3.1k for the marketplace-installed copy. The meter pins one path and never compares readings across them.

## Round 6 (2026-10-09, bigbrain docs/retros/2026-10-08-shawarma-round-6/, skill v0.6.0 0f5fa13)

Not done: words only were reported (SKILL 2582, spike 1214, template 887, workflow 2414); no per-branch token reading.

## Summary of Changes

`scripts/size_paths.py` (v0.7.0) writes one throwaway skill per load path; `plugin details` reads each one's tokens. retro.md names it and the word rule is retired (round-7 R3). First readings in the round-7 record.
