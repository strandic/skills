---
# skills-evwf
title: 'shawarma retro: build the bean input list from a tag query, one disposition per bean'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-10-28T10:26:07Z
updated_at: 2026-10-28T10:26:07Z
parent: skills-sp16
---

Finding, 2026-10-28: the retro decides every bean it reads, but the list of beans it reads is typed by hand. Round 8's "Skill-repo beans read (house rule)" (bigbrain docs/retros/2026-10-18-shawarma-round-8/inputs.md:29) lists s262 · lxpq · p4oc · x895 · hekn · jk6n · iim2 · 9064 · mcfe. It misses skills-u376 and skills-lhdg, both created 2026-10-17, the day before the round. Neither appears anywhere in that retro, so neither got a disposition.

retro-workflow.js only says "List every lesson and open item since the last marker as adopted, dropped or carried" (line 95). It does not say how the open items are found.

Prep done 2026-10-28: every open shawarma bean now carries the `shawarma` tag (mcfe, sp16, iim2, 9064, lxpq and x895 were added).

- [ ] The retro builds its bean input list from a query, not by hand. Recommended: `beans list --json --tag shawarma` filtered to todo, draft and in-progress, plus beans completed or scrapped since the last retro's date. The query and its output go into `inputs.md`.
- [ ] Each listed bean gets a row in the dispositions table: adopted, dropped (with the ruling's words) or carried. A bean in the list with no row fails the check.
- [ ] Decide where the rule lives: the skill repo's house rules (it names a beans command, which the skill must not restate) or `retro-workflow.js` as an arg (`openItems`), with retro.md naming the arg.
- [ ] A bean the retro dropped but kept open (iim2, 9064: "Stays open for a round that has one") is listed as such, so it does not read as forgotten.
- [ ] Round 9 uses the query. Check that u376 and lhdg get dispositions.

## Correction (2026-10-28)

A query already exists as a house rule: bigbrain `docs/plans/README.md:139-141` ("read the skill repo's open tickets (`beans list --json`, those naming shawarma or 'next retro'): each one addressed to the retro is ruled, done or noted on that ticket within the retro"). u376 and lhdg both name shawarma, so the rule matched them. The miss happened in applying it: round 8's inputs.md lists beans by hand, with no command output. The first item narrows to: paste the command and its output into `inputs.md`, and check the dispositions table against that output. The tag filter is optional on top.
