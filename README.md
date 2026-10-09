# strandic/skills

Skills from [Strandic](https://strandic.com) for building software with AI
agents, deliberately. Methods and tools we use, packaged so you can install them
into [Claude Code](https://claude.com/claude-code), Codex, Cursor, and other
agents.

Featured on [blog.strandic.com](https://blog.strandic.com).

## Install

**With the [`skills`](https://github.com/vercel-labs/skills) CLI (recommended) —
works across agents:**

```bash
npx skills@latest add strandic/skills
```

Pick the skills you want and the agents to install them on. They land as normal
skills, invoked by name (e.g. `/shawarma plan`).

**As a Claude Code plugin (native marketplace):**

```
/plugin marketplace add strandic/skills
/plugin install strandic@strandic
```

A plugin install copies the whole repository into the plugin cache, evals and docs
included; only `skills/` is loaded from it. Neither manifest has an exclude field, so this
is accepted rather than worked around with a restructure that could break the other
install path.

Installed this way, skills are namespaced under the plugin, e.g.
`/strandic:shawarma`.

## Skills

| Skill | What it does |
|---|---|
| [`shawarma`](skills/shawarma/SKILL.md) | Plan one settled ticket as a brief whose claims were executed before they were frozen, then run it — executed tests first, one implementer, a review wave — to a PR. The orchestrator owns git and every human gate; `retro` reviews the method itself. Invoked explicitly (`/shawarma plan\|run\|retro`); built for Claude Code — its lanes are subagents, and `retro` runs a Workflow script. |
| [`seven-steps-primer`](skills/seven-steps-primer/SKILL.md) | **Retired.** Replaced by `shawarma`, and to be removed from this repository soon. See [below](#retired-seven-steps-primer). |

## Shawarma

One ticket, one brief, one run, one PR. The skill has three commands, each invoked
explicitly:

- **`plan`** triages the change as trivial or briefed. A briefed change gets sourced
  research on everything outside the repo it touches, then a spike: every claim in the
  sketch is executed in a throwaway worktree before the brief is frozen. An attack lane
  tests the sketch. The plan ends with questions for you or with a frozen brief.
- **`run`** commits the tests first, then one implementer lane writes the code. The full
  suite runs against the base, a review wave follows, and the last gate runs on live data.
  The PR carries a Decisions table and a Findings table.
- **`retro`** replays past plans against a draft of the method and scores what changed.
  The skill changes only at a retro, and a retro must cut at least as many words as it
  adds.

Gates come by exception. Your checkpoints are the design interview, the rulings and the
`run` command, never the PR. Each open question is either a RULING, which waits for your
answer, or a DEFAULT, which stands unless you strike it.

### How the three commands work

The rules live in [`SKILL.md`](skills/shawarma/SKILL.md),
[`spike.md`](skills/shawarma/spike.md),
[`brief-template.md`](skills/shawarma/brief-template.md) and
[`retro-workflow.js`](skills/shawarma/retro-workflow.js). This is a guided tour, not a
substitute. The session you invoke the skill in is the **orchestrator**: it alone touches
git, the ticket, real data and the PR. The other work goes to **lanes**, which are
subagents with a narrow prompt and a fixed set of files.

Each repo can have **house rules** in `docs/plans/README.md`: where briefs and lessons
live, how to branch, which commands run the tests and file checks. The skill says *what*
to do; the house rules say *how*. Without that file, the skill uses its own defaults.

#### `/shawarma plan <ticket>`

1. **Triage.** The change is either trivial or briefed; there is no third path. A trivial
   change fits one small diff with one check that fails on the base, and its worst case is
   an inconvenience. It gets a short note on the ticket and is done on your go. A
   decision record is never trivial. If the design is not settled, meaning not decided by
   evidence, an ADR or your rulings, or its acceptance gate cannot be measured today, the
   plan starts with a design interview, one question at a time.
2. **Research.** The planner lists everything outside the repo the change calls, parses
   or emits: dependencies, formats, protocols, the platform. A read-only lane fetches the
   docs and installed source at the pinned version, the governing spec section, known
   hazards, alternatives from prior art, and the changes in default limits when a version
   moves. Each source is quoted verbatim. A source never counts as proof. It only tells
   the spike what to try.
3. **Spike.** Every code sketch runs in a throwaway worktree before it goes into the
   brief. [`spike.md`](skills/shawarma/spike.md) asks five questions of each claim. Did
   this exact thing run? Which kinds of input never met it? Is the check as strong as the
   sentence? Could this data show the failure at all? What happens on the next read,
   write or restart? The full suite also runs with the sketch in, to predict exactly which
   tests will fail and which existing tests must change.
4. **Attack lane.** The planner writes attack lines, each an input and the oracle that
   grades it. A separate lane executes every line and re-reads every source. The planner
   grades the readings. A reading that changes the sketch sends it back through the spike.
5. **Stop or freeze.** A finding stops the plan only if it contradicts a ruling, makes a
   gate ambiguous, shows wrong output or a forbidden state, or shows an impact the ticket
   did not weigh (data loss, a leak, silently wrong results). Then the plan ends with
   questions for you, at most three per round. Otherwise it ends with a frozen **brief**
   from [`brief-template.md`](skills/shawarma/brief-template.md). The brief holds the
   evidence, the executed design with its sources and input table, a frozen contract, the
   tests (each marked red or guard), the acceptance rules with their PASS and FAIL
   readings, the worst impact, the review lanes, and what is out of scope. Every plan
   ending names the one open default, or says there is none.

#### `/shawarma run <ticket>`

Invoking `run` is your go. The run never edits the brief above its amendments table.

1. **Wave 0.** Branch and worktree. If the base moved and touches a file the brief names,
   the sketch's failing tests are re-run on the new base.
2. **Tests first.** The orchestrator commits the brief's executed tests before any code,
   and checks that the tests that fail are exactly the ones the plan predicted, each for
   the stated reason.
3. **Wave 1, implement.** One implementer lane writes the code. It stays inside its files,
   reads the base only through `git show`, and stops on any blocker outside them.
4. **Wave 2, integrate.** Full suite and lint against the base, passed and skipped
   counts both. A new skip or failure is a finding.
5. **Wave 3, review.** Reviewers never edit the repo; every finding comes with a runnable
   reproduction. The review is adversarial, with executed attacks, when the brief's worst
   impact calls for it, and a code review otherwise. Each finding is labelled APPLY,
   DECLINE (with one reason from a fixed list), TICKET or RULING. An applied fix ships a
   regression test shown failing on the pre-fix code, and a behaviour-changing fix gets a
   fresh review lane of its own. A third review round needs your ruling.
6. **Stops.** The run stops for your ruling when a change would touch a ruling, the
   contract, the out-of-scope list or a gate rule, or when a finding shows wrong output or
   an unweighed impact. Smaller amendments are DEFAULTs: a test first, a row in the
   amendments table, and a line in the next stop message.
7. **Wave 4, gate and PR.** Each acceptance rule runs on live data, on the final commit,
   by its own command. A second reading after a failure, or an altered flag, needs your
   ruling. The PR body links the plan, lists the verification, and carries two tables: a
   **Decisions** table (RULING or DEFAULT) and a **Findings** table (APPLY, DECLINE or
   TICKET). You merge. Cleanup appends any lessons for the next retro.

#### `/shawarma retro`

The skill changes only here. `retro` runs
[`retro-workflow.js`](skills/shawarma/retro-workflow.js) with the Workflow tool. The
workflow is read-only and ends in propositions, not edits:

1. **Evidence and research.** Two auditors check the run record (lessons and stats lines)
   against the real briefs, PRs, tickets and git history, and read any pre-registered
   measure. Researchers fetch sources on orchestration, test-first practice, and review,
   each finding with a verbatim quote.
2. **Propose.** Two proposers with opposite lenses. *Lean* prefers deleting text and
   replacing prose with mechanical checks. *Rigor* closes every hole the runs exposed.
3. **Consolidate** into one numbered list with exact proposed wording.
4. **Test, argue, verify.** One agent replays each proposition against the recorded runs
   and says which incident it would have prevented, and where it would have hurt. A lean
   critic argues against each one. A rigor critic asks whether the wording really closes
   the hole. A cold reader flags anything a stranger's repo could not use. A verifier
   re-fetches every cited quote.

You then rule on each proposition, one question at a time. The orchestrator drafts the
new wording and, before you see it, replays `plan` with the draft on past tickets: a
throwaway worktree at each ticket's base commit, a rubric committed first, a proxy that
answers only from the rulings on record. Every lesson since the last retro is adopted or
dropped. A new rule names the class of failure it prevents, never the case that prompted
it. The retro reports word counts per file and must cut at least as many words as it
adds, unless you rule otherwise.

### What has been measured

Nothing yet. Shawarma has no eval suite. The retros are the
current instrument, and they cannot yet compare one version of the method with another:
each retro replays the tickets that motivated its own draft, each cell runs once, and the
rubrics mix trap items with compliance items graded in the method's own words. Two
measures are planned. A fixed trap bank: past tickets whose defects a real run missed,
re-run on every draft, so a draft must catch at least what the old text caught. And a
count of defects found after merge, traced to the PR that shipped them. The open question,
"does the method beat the bare model?", is deliberately not the target: it has no stopping
rule.

## Retired: seven-steps-primer

`seven-steps-primer` was a step-gated method: eight steps, each producing one small
artifact, each ending at a gate the human cleared. It still installs from this
repository, but it is no longer maintained and will be removed soon. Use `shawarma`.

It was retired for three reasons. A gate at every step was friction. The early gates made
little sense without a plan: you reviewed a data model before knowing where the work was
going. And its own evals showed that the document's shape, not its content, did the work.

**What the evals found.** A pre-registered suite ran 150 agent runs per sweep (Sonnet
subject, Opus judge) against three controls: no skill, a one-sentence instruction to plan
and wait, and a placebo with the same eight gates and arbitrary content. Against no
instruction, the primer clearly changed behaviour. Against the placebo, it tied on every
case but one, and lost that one. The one behaviour no control produced was placing to-do
markers in the source. Five of twelve registered predictions missed, and the misses are
written up. A second suite planted defects in a small service. On that fixture, the only
instruction that made the agent name them was the one that said to read the code. Nothing
was measured about whether the software came out better.

The full record: the suites in [`evals/seven-steps-primer/`](evals/seven-steps-primer/) and
[`evals/seven-steps-primer-defects/`](evals/seven-steps-primer-defects/), the
pre-registration in
[`evals/seven-steps-primer/PRE-REGISTRATION.md`](evals/seven-steps-primer/PRE-REGISTRATION.md),
and the plans and results in [`docs/plans/primer-evals/`](docs/plans/primer-evals/).
When the primer is removed, these links will point at the last commit that carries them.

## Adding a skill

Drop it at `skills/<name>/SKILL.md` (frontmatter needs `name` + `description`),
then add its path to the `skills` array in
[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json). Both install paths
pick it up.

MIT-licensed — copy it, adapt it, make it yours.
