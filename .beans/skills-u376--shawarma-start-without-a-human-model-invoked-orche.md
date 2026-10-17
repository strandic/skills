---
# skills-u376
title: 'shawarma: start without a human (model-invoked, orchestrator-dispatched) and rulings relayed by message'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-10-17T12:46:23Z
updated_at: 2026-10-17T12:46:23Z
parent: skills-sp16
blocked_by:
    - skills-hekn
    - skills-lhdg
---

Owner request, 2026-10-17: let the shawarma skill start without the human typing the command. Two uses: (a) the model starts it from context or a prompt; (b) an orchestrator session dispatches tickets to idle sessions on this machine and becomes a hub where asks wait for the owner's answer, sent back by message.

Why it needs rules: the skill's human checkpoints are the design interview, rulings and `run` ("Invoking `run` is the go"). Today they assume the human types into the session doing the work. A trigger or a relay that does not keep those checkpoints with the human removes them.

Depends on skills-hekn (the marker is the state a hub reads) and skills-lhdg (the lock that stops two dispatched sessions sharing a checkout). Round-8 retro item, since the skill changes only at a retro (retro.md:3).

Sketch (to rule at the retro):
- [ ] `plan` may start without a human: model-invoked, or dispatched by another session. It writes only a brief, a ticket note and a commit, then stops at questions or a brief. Check the skill's frontmatter allows model invocation.
- [ ] `run` starts only on the owner's own "run <ticket>": typed in the session, or relayed verbatim by a hub. A dispatching session never supplies the go itself.
- [ ] A relayed answer is a ruling only when it is the owner's words, quoted verbatim, with its source (which session relayed it, when). The hub never answers an ask, not even with "go with reco".
- [ ] Silence: in a session the owner is typing in, silence on a DEFAULT accepts it. Over messages, silence means "no answer yet" and the asking session waits. Decide whether a DEFAULT may still stand after a stated time.
- [ ] Concurrency: plans commit on the main checkout, so two dispatched plans collide there. Decide between plans in their own worktree and one plan at a time per checkout (skills-lhdg's lock).
- [ ] The ask format ("Asking the human") is the message a hub shows; check it reads alone, outside the session that wrote it.
- [ ] Trap bank: a dispatched `run` with no relayed go stops; a hub-written "go" is not counted as a ruling; silence over a relay does not accept a DEFAULT.
- [ ] Size meter reading before/after in the retro record.
