---
# skills-lhwh
title: 'shawarma-companion pane: decisions.md heading and blank lines drawn as bullets'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-01T11:51:34Z
updated_at: 2026-11-22T12:00:00Z
---

The pane in mods/shawarma-companion lists every line of decisions.md as a bullet, so the '# <ticket> decisions' heading and blank lines show as '- <heading>' and an empty '-'. Seen in the skills-pi0y stand-in dry run on CLI 2.1.316. Cosmetic: could list only the dated rows that the row counts.

## Plan (2026-11-22): trivial — shawarma 0.11.0, base `bb89183`

Awaiting go. The change is the ticket's own words: the pane lists only the dated rows the band already counts.

- **Sites.** `mods/shawarma-companion/hooks/model.ts:225` `parseDecisions`: the row test moves into a new exported `decisionRows(text): string[]` (the lines it counts, as written, in file order); `parseDecisions` returns `{ decisions: decisionRows(text).length }`. `hooks/register.tsx:853`, the pane's `### Decisions` section: bullets from `decisionRows(decisions)`, `_None recorded._` when there are none (missing file or no dated row); the import line swaps `lines` (no longer used there) for `decisionRows`. Tests: one new `describe` block appended at the end of `tests/band.test.tsx`. No other function changes; no README text names the pane's bullets (`grep -n "bullet\|Decisions" mods/shawarma-companion/README.md` to re-check at go).
- **Red check.** New tests L1 (decisions.md with a heading, a blank, the template line, a table header and separator, a wrapped line and three dated rows, one pipe-led: the section reads exactly the three dated rows as bullets) and L2 (heading only: `_None recorded._`). `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion` on the base modules: `286 pass` / `2 fail` / `Ran 288 tests`; L1 received `"- # skills-x decisions\n- \n- \`<date> | …\` …"`, L2 received `"- # skills-x decisions"`. With the fix: `288 pass` / `0 fail` / `Ran 288 tests across 1 file.`; `claude-personal plugin validate mods/shawarma-companion`: `✔ Validation passed`. `~/.npm-global/bin/tsc -p <copy of the mod's tsconfig outside the repo, files naming plugin-authoring/types/claude-code.d.ts@2.1.329>` (tsc 6.0.3) with the fix: exit 0, no output.
- **Worst case.** A decisions.md line not in the dated format (a mistyped date, a wrapped continuation) no longer shows in the pane. The band's count already skips it, so pane and count now agree. An inconvenience; no file write, no read path changes.
- **Outside behaviour.** One format read: decisions.md, defined by `skills/shawarma/SKILL.md:19@0.11.0`: "Each RULING and DEFAULT appends `<date> | <id> RULING|DEFAULT | <decision> | <why>` to the plan dir's `decisions.md`, one id per line". No new API call: `git diff -U0 | grep -E '^[+-][^+-]' | grep -E '\$\.|import|from |<[A-Z]'` lists only the two `$.ui` calls in the new tests.
- **Coordination.** Shares `hooks/model.ts`, `hooks/register.tsx`, `tests/band.test.tsx` with skills-oz54 and skills-1tr4; touches only `parseDecisions`, new `decisionRows`, the pane's Decisions line and the import line. Mod version and CHANGELOG entry chosen at go, after rebasing on whatever merged first.

unruled: none

