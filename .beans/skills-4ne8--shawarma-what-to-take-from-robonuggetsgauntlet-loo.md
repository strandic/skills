---
# skills-4ne8
title: 'shawarma: what to take from robonuggets/gauntlet-loop'
status: todo
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T23:06:31Z
updated_at: 2026-11-02T23:06:31Z
---

Owner request, 2026-11-03: look into https://github.com/robonuggets/gauntlet-loop for aspects that would improve the shawarma method, as skills-8yf4 did for EGM. Research done 2026-11-03 on the repo at its public history (2 commits, 2026-08-05 and 2026-08-06). Clone, not run: scratchpad only.

## What it is

One Claude Code skill (133 lines), a README, a licence and a banner. The skill writes a ~150-word prompt to paste into a fresh session. The prompt says: name a reference to beat (the "bar"); split the work into the smallest pieces that can be judged on their own; give each piece a builder and a separate fresh-context "harsh" critic, who compares our output with the bar blind and picks one; `/loop` until the critic picks ours. The technique is Matt Shumer's (mshumer/Claude-of-Duty, a 3-sentence prompt); this repo packages it.

## Verdict on evidence

- None. No evals, tests, benchmarks, ablations or quality numbers; no test files in the repo. The "what breaks it" lists are claims with no runs behind them.
- Popularity only: 1182 stars and 100 forks (`gh repo view`); the upstream has 3504 stars. No issue or PR reports whether it works, and none has a comment.
- Outside coverage is about Shumer's technique and anecdotal. One unverified blog claims a replication cost ~$1,200, 19 hours and 137 agents. A LinkedIn snippet warns the loop can run forever and that subagents can inherit the builder's context, so the "blind" critic is not blind.

## Candidates to weigh at a retro (each needs a trap or replay before adoption)

- [ ] **Blind pick against a named exemplar, not a score** (`.claude/skills/gauntlet-loop/SKILL.md:55`, `:131`: "Scores out of 10 drift upward every round"). Shawarma gates are counted thresholds or invariants (plan.md step 5) tested against the nearest wrong fix (spike.md). For tickets with no executable check (prose, docs, UX), spike.md q3 could allow a blind pick against a named good example as the check. Not in shawarma; low priority for code.
- [ ] **The critic names the single biggest gap first** (SKILL.md:55). Shawarma lanes report every finding, each labelled (run.md step 4, lanes.md). Lane cells could ask for findings ranked by impact. Weak.
- [ ] **One critic per independently judgeable piece** (SKILL.md:55, :96). Shawarma runs one review wave over the whole diff (run.md Wave 3). A large brief could launch one review lane per area §3 names. One ticket per run already keeps diffs small, so the gain is likely small.
- [ ] **A progress page for the human** (SKILL.md:61). `.shawarma/active-<ticket>` is a machine marker; the companion mod draws it. Minor; matters for long runs.
- [ ] **Sources with a verification date, rejected ones kept marked dead** (open PR #5, `references/assets.md`). Shawarma's §2 Sources rows are version-pinned, not dated, with no list of rejected sources. Minor.

Already in shawarma, so not candidates: the critic never sees the builder's reasoning (run.md: "never the fix's rationale"); the reference must be fetchable and comparable (stricter in shawarma: Settled? (ii), oracle independence in lanes.md); pick the hardest bar (spike.md q4); options with a recommendation (SKILL.md's asking format).

## Not worth borrowing without evidence

- Exit only when the critic picks ours, never after a round count (SKILL.md:132). Shawarma makes a third review round a RULING; gauntlet shows no evidence its loop ends, and the outside commentary points to unbounded cost. A dev.to post argues critique loops stop helping by the third round.
- "Minimal wins": no architecture or decomposition in the prompt (SKILL.md:71, :133). The opposite of the frozen brief, with no runs behind it.
- Magic wording ("harsh critic. Praise is not useful.", SKILL.md:57). Unmeasured.
- A taste pick as the check for code: executed tests with a FAIL reading are stronger.

Not read: PR #5's diff, PR #2's diff, the forks, the Cursor port, and the primary sources behind the blog claims (search snippets only).
