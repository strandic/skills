---
# skills-tlmu
title: 'shawarma: the ''What this is about:'' blockquote belongs in the ask format'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-10-21T13:17:21Z
updated_at: 2026-10-21T13:17:21Z
parent: skills-sp16
---

Owner request, 2026-10-21 (from bigbrain session end0): put the "What this is about:" blockquote into the shawarma skill's ask format.

This reverses round-6 D-plain-English (bigbrain `docs/retros/2026-10-08-shawarma-round-6/rulings.md:60`), which kept the blockquote as an owner preference in personal memory. Why reverse it: a memory reaches only the one project that holds it. Sessions in other repos, and fresh installs of the skill, ask without it. Round-8 replays already show the blockquote in their outputs (bigbrain `docs/retros/2026-10-18-shawarma-round-8/replays/run4-63at-rest-b/out/plan-paused-note.md:44`), which means the behaviour came from memory and not from the method.

The skill changes only at a retro (retro.md:3), so this is a round-9 item. Until then, sessions get the rule from the stopgap text below, pasted by the owner.

Sketch (to rule at the retro):
- [ ] SKILL.md "Asking the human": each RULING and DEFAULT opens with a blockquote `> **What this is about:** …`, placed under the ask's heading and before its technical text. It explains the issue and each option in plain words, with no ids, refs, file:line or SHAs, so a reader can rule without looking anything up. The technical text below it stays unchanged.
- [ ] It applies everywhere an ask appears: the stop message, the ticket's "Plan paused" or ask note, and the DEFAULT list at a plan's ending.
- [ ] Do not label anything "in plain English"; the heading is the label.
- [ ] Trap bank: a case where an ask without the blockquote fails the check (a freeze_check-style grep, or the replay's judge).
- [ ] Size meter reading before and after, in the retro record (p4oc's target: the line costs tokens on every plan load).
- [ ] Once adopted: delete the stopgap from owner memories (bigbrain `plain-english-rulings`) and from any repo that got the pasted text.

## Stopgap text (paste into a session; that session saves it as a memory)

```
Shawarma stopgap until the next retro adopts it (strandic-skills bean skills-tlmu):
every RULING or DEFAULT you ask me, in the stop message and in the ticket note,
opens with a blockquote, placed under the ask's heading and before its technical text:

> **What this is about:** <the issue and each option in plain words: no bean/ticket
> ids, PR/commit refs, file:line or SHAs; enough that I can rule without looking
> anything up>

Keep the technical text below it unchanged (readings, options, ids, refs).
Don't label anything "in plain English". Save this as a feedback memory in this
project so it survives compaction and new sessions; delete that memory once the
shawarma skill's "Asking the human" section carries the rule.
```
