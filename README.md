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
skills, invoked by name (e.g. `/seven-steps-primer`).

**As a Claude Code plugin (native marketplace):**

```
/plugin marketplace add strandic/skills
/plugin install strandic@strandic
```

Installed this way, skills are namespaced under the plugin, e.g.
`/strandic:seven-steps-primer`.

## Skills

| Skill | What it does |
|---|---|
| [`seven-steps-primer`](skills/seven-steps-primer/SKILL.md) | A step-gated method for building one medium, structural feature with an agent, without slop — each step produces one small artifact, then stops at a gate *you* clear. The agent never advances a gate itself. |

## Evals — does the skill actually do anything?

Most skills ship on the author's word. This one has numbers, and they are more modest
than "it works".

**Why bother.** A skill is a prompt, and a prompt that sounds compelling can change
nothing. The interesting question is never *does it beat no instruction* — a long careful
document beats nothing at nothing — but **does it beat the obvious cheap alternative**.
So the suite runs the primer against three controls: no skill at all, a thirteen-word
one-liner (*"Present a plan and wait for my explicit approval before editing any code."*),
and a placebo carrying the same eight gates with arbitrary contents. The one-liner asks
whether 11KB beats one sentence; the placebo asks whether it is *this* method or any
method of that shape.

**What the sweep found** (2026-09-03, 150 runs, ~$27 API-equivalent, `sonnet`
subject / `opus` judge, noise floor 0.12; a first sweep on 2026-09-01 was withdrawn after
review found defects in the placebo and four graders):

| Behaviour | vs no skill | vs one sentence | vs same-shape placebo |
|---|---|---|---|
| Produces step 0 and stops | +0.69 | **+0.23** | +0.03 — noise |
| Adds no ceremony to a typo fix | +0.02 — noise | **+0.67** | 0.00 — noise |
| Recognises a structural change | +0.43 | −0.04 — noise | **−0.24** |
| Decomposes an epic | +0.24 | 0.00 — noise | 0.00 — noise |
| Places markers in source | — | **0.85 vs 0.25** | **0.85 vs 0.25** |

Read honestly: against no instruction the primer clearly changes behaviour. Against one
good sentence it wins on gate-stopping and on *not* over-planning a triviality, and ties
on both structural-triage cases. Against a placebo with the same gates and none of the
method's content, it ties everywhere and loses on one case. So the stop-and-plan
behaviour comes from the shape of the document, not from what the primer says. The one
behaviour no control produces is placing to-do markers in the source. That is the
finding the extra controls exist to expose: an eval running only the built-in
with/without ablation would have reported +0.43 and +0.24 and called the method
validated.

**What it does not show.** Nothing about whether the software comes out better. These
measure what the agent *does*, not what it produces — a compliance measure, not an
outcome one. `docs/plans/primer-evals/tier-2-backlog.md` designs the outcome eval and
prices it at roughly 20× this one.

**Work in progress.** The suite runs, the invariants hold, and the results are committed —
but it is one skill, one fixture, one model, five cases. Predictions were registered before
the run (`evals/seven-steps-primer/PRE-REGISTRATION.md`) and **five of twelve missed**,
including the placebo prediction landing backwards. Those misses are written up rather
than smoothed over.

```bash
# Requires CLI 2.1.250 — see evals/seven-steps-primer/README.md for why
EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 node scripts/run-evals.mjs --smoke
node scripts/merge-results.mjs evals/seven-steps-primer/results
```

Full method, per-run scatter and the honest limits: **[`evals/seven-steps-primer/`](evals/seven-steps-primer/)**.

## Adding a skill

Drop it at `skills/<name>/SKILL.md` (frontmatter needs `name` + `description`),
then add its path to the `skills` array in
[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json). Both install paths
pick it up.

MIT-licensed — copy it, adapt it, make it yours.
