# seven-steps-primer

A [Claude Code](https://claude.com/claude-code) skill: a **step-gated method for
building one medium, structural feature with an agent, without slop**. Each step
produces one small artifact, then stops at a gate that *you* — the human — clear
before the next step starts. The agent never advances a gate itself.

It's the method walked through end-to-end on
[blog.strandic.com](https://blog.strandic.com).

## Install

**As a plugin (recommended):**

```
/plugin marketplace add strandic/seven-steps-primer
/plugin install seven-steps-primer@strandic
```

**Manually (drop the skill into your personal skills dir):**

```sh
mkdir -p ~/.claude/skills/seven-steps-primer
curl -o ~/.claude/skills/seven-steps-primer/SKILL.md \
  https://raw.githubusercontent.com/strandic/seven-steps-primer/main/skills/seven-steps-primer/SKILL.md
```

## Use it

The skill has `disable-model-invocation: true` — it never auto-triggers; you run
it deliberately when you're about to build a medium, structural feature. Invoke
it by name (e.g. `/seven-steps-primer`) and it will run one step per turn,
stopping at each gate for you to clear.

Triage first — the method earns its gates only for **medium, structural** change:
skip it for a one-line fix, decompose a milestone or epic into a single medium
change first, then run it on that.

## What's inside

- `skills/seven-steps-primer/SKILL.md` — the method (the whole skill).
- `.claude-plugin/marketplace.json` + `plugin.json` — package it as an
  installable Claude Code plugin.

MIT-licensed — copy it, adapt it, make it yours.
