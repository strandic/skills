---
# skills-sp16
title: 'shawarma: repeatable evals and a smaller plan load'
status: todo
type: epic
created_at: 2026-09-24T15:53:31Z
updated_at: 2026-09-24T15:53:31Z
---

Two linked goals from a 2026-09-24 review of how the shawarma method is evaluated and why it keeps growing. Every child answers a closed question — "did this change lose anything the old text caught?" — never the open one, "does the method work?", which has no stopping rule (this repo's seven-steps-primer eval history is the cautionary case).

**Evals.** The retros are the right instrument: replays of past tickets at their base commit, a proxy answering from the recorded rulings, a fresh planner resuming, a scorer listing which sentences of the method were used, ignored or misread. They cannot yet compare versions:
- each retro replays the tickets that motivated its draft (6, then 4, then 3), so a draft is scored on the cases it was fitted to and older traps are never re-checked;
- each cell runs once, so there is no noise floor;
- rubrics mix compliance items, graded in the draft's own vocabulary, with trap items (did the plan catch the defect the real run missed?) — only the latter measure anything;
- defects that escape after merge are traceable but never counted.

`claude plugin eval` does not fit. Its unit is one `claude -p` session (at most 200 turns and 1 h; one scripted next turn after a replayed history), graded by regex, tool or file checks or a judge, compared only with vs without the plugin. The method's claims play out across sessions, human gates and lanes. Its one real gain, a top-level session that can launch subagents, comes from `claude -p` itself.

**Size.** SKILL.md is inside the official limits (55 lines of the 500-line guidance; ~4.3k tokens on invoke of the Level-2 "under 5k tokens"), but `plan` as loaded (SKILL.md + spike.md + brief-template.md) is ~8k tokens before the host's house rules and lessons. The three files grew 1,614 -> 4,119 words across three retros; the words-in = words-out rule now holds them flat. The measured costs are misapplied rules (last retro: five sentences ignored, three misread, one pair contradicting each other) and briefs that every lane reads (replay briefs ~3x the real ones). A suite split saves ~16% on `plan`, which needs ~84% of the text, so it is not the lever.

**Timing.** The skill changes only at a retro, and the host project's pre-registered window (three briefed runs) is open. Children that change skill files land at the next retro; the trap bank's data can be assembled before it.
