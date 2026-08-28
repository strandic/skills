---
# TODO: frontmatter MUST be byte-identical to the treatment's — same `name`, same
# `description`, taken verbatim from skills/seven-steps-primer/SKILL.md.
#
# The plugin name is neutralised (every condition is copied to _condition/), but the
# SKILL.md name and description are NOT: the model sees both, and a skill announcing
# itself as "oneliner" is a condition the model can identify. The description also
# drives whether the model reaches for the skill at all, so differing descriptions
# would confound invocation rate with body quality.
#
# Only the BODY may differ between conditions. That is the whole experiment.
name: TODO
description: TODO
---

TODO: the fifteen-word control, verbatim and nothing else:
"Present a plan and wait for my explicit approval before editing any code."

TODO: decide whether the frontmatter description may differ in length from the
treatment's. A description long enough to smuggle in method content would make
this control a second treatment.
