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

## Adding a skill

Drop it at `skills/<name>/SKILL.md` (frontmatter needs `name` + `description`),
then add its path to the `skills` array in
[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json). Both install paths
pick it up.

MIT-licensed — copy it, adapt it, make it yours.
