---
# skills-w3q3
title: 'shawarma evals: treat the method like a program (vault thinking, 2026-10-06)'
status: draft
type: task
created_at: 2026-10-09T06:08:42Z
updated_at: 2026-10-09T06:08:42Z
parent: skills-sp16
---

Thinking recorded in the vault (page `shawarma`, section "Open: evaluation and size", interview session 2026-10-06). Filed here so it lives beside the work. Nothing below has been tried.

## The problem, as raised

- No plan yet stops the skill from growing, or its language from getting denser. The model writes the skill and runs the retros, so the method is something of a black box to its owner.
- Two open questions. Can evals treat the skill like a program: test each unit, swap one for another with the same signature, compare? And does the method beat the bare model at all? The second, in its open form, has no stopping rule (see the parent epic and this repo's seven-steps-primer history).
- A first answer to density, already filed as an open item for the next retro: a plain-English section in every ruling. Rulings full of SHAs and ids ("D1 by way of F4") get cryptic when many sessions run at once.

## Suggestions (Claude, 2026-10-06)

- **Test at the lane and phase level, not the sentence level.** Lanes and commands have defined inputs and outputs, so they behave like functions. Sentences in SKILL.md do not: they share one context and interact. The primer's section ablations showed this: every section removal improved the same case.
- **A trap bank as the regression suite** (skills-x895). Defects that real runs missed or caught late, each pinned to its base commit. A new draft must catch at least what the old one caught. Score only trap items, never compliance in the skill's own vocabulary. Run each cell about three times for a noise floor.
- **Treat compression as a refactor** (skills-p4oc). With a trap bank, a plainer rewrite is accepted if no trap is lost. The retro scorer's lists of ignored or misread sentences point to dead code.
- **One cheap control.** A short paragraph naming the method's core ideas, run on the trap bank. The primer's placebo result suggests the shape may again do most of the work. Not covered by any other bean.
- **Field data.** Escaped defects per shipped PR (skills-j1ck), plus two counts no bean covers yet: rulings per run, and time to merge.

## Open

- [ ] rule which suggestions to adopt; split adopted ones not already covered (cheap control, rulings per run, time to merge) into their own beans
- [ ] decide whether lane-level testing changes the trap bank's case format (skills-x895)
