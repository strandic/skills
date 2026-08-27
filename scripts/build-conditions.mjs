#!/usr/bin/env node
/**
 * Regenerates the treatment condition from the shipped SKILL.md and fails on drift.
 * Signatures: ../scripts/interfaces.mjs § build-conditions
 *
 * Marker convention is documented in docs/plans/primer-evals/3-todos.md, so that
 * describing it here does not match the grep that enforces it.
 */

// TODO: wire handles at this entry point only — ReadTextFile, WriteTextFile from
// node:fs/promises. Nothing below this line may import fs directly.

// TODO: implement StripModelInvocation — drop the `disable-model-invocation` line
// from frontmatter, leave every other byte untouched.

// TODO: implement DetectDrift — first divergence as `reason`, or '' when equal.

// TODO: implement the `generate` mode — read skills/seven-steps-primer/SKILL.md,
// strip, write evals/seven-steps-primer/conditions/treatment/SKILL.md.

// TODO: implement the `check` mode (drift-check) — regenerate in memory, compare
// against the committed file, exit 1 with the reason when they differ.

// TODO: argv handling — `generate` | `check`, default `check` so CI is the safe path.
