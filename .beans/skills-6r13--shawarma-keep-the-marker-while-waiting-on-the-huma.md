---
# skills-6r13
title: 'shawarma: keep the marker while waiting on the human'
status: todo
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-11-03T13:09:21Z
updated_at: 2026-11-03T13:09:21Z
---

Owner report, 2026-11-03, from planning BIO-1113 in `customer-app`: the companion pane filled during research, then cleared when the session stopped for the design interview. The work was still in progress.

## What happened

The mod behaved as built. The session followed `SKILL.md:19` of skill 0.9.0, "delete it at every stop".

- 12:28 CET: the session wrote `.shawarma/active-BIO-1113` with `plan 1`.
- 12:36 CET: it committed the research report (`0dd2d7e`) and ran `rm -f .shawarma/active-BIO-1113`, then opened the interview. Source: the session's transcript.
- With no marker left, the mod had nothing to show. `ls -la .shawarma` in the worktree listed only `.gitignore`.

## The gap in the method

"Every stop" treats "waiting for the human" and "finished" the same way, so the pane goes blank while the work is live. By the rule's wording, the same applies to plan questions and to rulings during a run (not checked in a transcript). The interview also has no step name, because the rule names only plan steps and run waves.

The mod cannot fix this alone: a deleted marker does not say whether the work paused or finished.

## Proposal, for the retro to weigh

- [ ] Keep the marker through a pause and rewrite its step to say what the work waits on, for example `plan interview` or `run W3 ruling`.
- [ ] Delete it only when the work ends: PR opened, plan handed over, or ticket dropped. The retro lists these endings exactly.
- [ ] Name the interview's step in the state-files rule.
- [ ] Check the mod's README wording against the new meaning. Its `stale:` text says a stale marker was most likely left behind by a run that stopped.

Why the row stays truthful (skills-pi0y R3 forbids false state): it says what the work waits on. A marker left behind by a crash reads `stale:` after 12 hours, or `earlier session:` in a new session.

No mod code should need to change: `parseMarker` accepts any `plan <word>` or `run <word>` (`mods/shawarma-companion/hooks/model.ts:66`, read). `unexecuted`: `plan interview` through the real mod.

Trade-off to weigh: a long pause, such as an interview left overnight, reads `stale:` after 12 hours while still waiting on the human.

Related: skills-mvfd (session id in the marker), also a marker change for a retro.

**Filed 2026-11-03, after round 9: for round 10** (owner request). The skill changes only at a retro.

Workaround until then: in the paused session, write the marker by hand with step `plan interview`, and tell the session to keep it until the interview ends.
