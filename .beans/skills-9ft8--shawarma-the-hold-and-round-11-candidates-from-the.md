---
# skills-9ft8
title: 'shawarma: the hold, and round-11 candidates from the 2026-11-11 review'
status: todo
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-11-11T10:36:00Z
updated_at: 2026-11-11T11:36:35Z
---

Owner rulings of 2026-11-11, on a critical review of the skill at v0.10.1 (record private). They are listed here so the next retro finds them.

## Rulings

1. **Hold.** No change to the skill's text until about 15 briefed runs have used v0.10 (a guess, not a measured number). The next retro reads outcomes first and may end with no change.
2. **Scripts may be fixed between retros**: a failing test first, a patch version, a changelog line. Text still changes only at a retro. First use: 0.10.2.
3. **Lanes run on the orchestrator's model for now.** Session transcripts show no plan or run lane on a Sonnet- or Haiku-class model since 2026-10-07. Nothing in the skill sets a lane's model.
4. **Asks**: the even-handed half first, on the ticket about ruling more without stopping (skills-h8hp).
5. **One bounded check of the trap bank**, on the trap bank ticket (skills-x895).

## Candidates for round 11

Each needs the usual case and ruling. None is adopted.

- [ ] Two contradictions in the text. What `go` does to a DEFAULT: SKILL.md says it stays a DEFAULT, plan.md step 4 says an explicit answer is a ruling, and the checkers enforce the first. Dispatch says to paste a cell for four lane kinds; lanes.md has two.
- [ ] Three things the text does not say, each a question for the owner: what the run does when a gate rule reads FAIL at run step 6; the steps of a trivial go; what a "round" is (the ticket about review rounds that do not converge, skills-s2ae).
- [ ] Lanes: a return line in each cell (where the report goes, what to return for a line that cannot run, what to do with a suspicion that was not executed); a cell or a removal for the two lanes Dispatch names without one; one name per lane kind; a short failure paragraph. Before new lane text ships, give it several times to a model of the kind lanes run on, and check that it reads each rule correctly.
- [ ] A model and an effort setting for each kind of lane, set in plugin agent definitions: lanes that judge keep the orchestrator's model; lanes that fetch or run listed lines may go to a cheaper one. Moving a judging lane to a weaker model needs a replay of past review catches first.
- [ ] A DECLINE as `unreachable` or `false-positive` cites its reading (the ticket on what to take from EGM, skills-8yf4).
- [ ] Deletions first: the implementer-lane claim where the orchestrator commits the executed sketch, the retro's fixed research stage, the re-run of listed mutants at review, the attack lane's re-read of each source row, the advisory lines of the freeze checker.
- [ ] Text that trails the scripts and the practice: retro.md says an item is adopted or dropped, and rounds 9 and 10 carried items; retro.md says the skill changes only at a retro, and scripts now have a route between retros; plan.md step 5 names the freeze command without `--ticket` (0.10.2).
- [ ] The retro itself: a trigger on run volume, a slate of about five real decisions, research only for a named question.

## Not now

Rebuilding around a core with tiers; cutting checks by catch count; replacing trap-bank cases; lanes proposing the labels of their own findings; CI as a gate.


## Script follow-ups

These are script matters, so they can land between retros.

- [ ] `check_pr.py` at the pull request does not read `unruled:` ids that sit on the ticket: P4 and M1 can fail a briefed run whose plan ending is on the ticket. `freeze_check.py --ticket` reads them since 0.10.2; `check_pr.py` has no such flag.
- [ ] The retro's replay check still drops a result for reasons its prompt does not state: a ticket id that is not lower case, an extra repository whose folder name is a common word, a control character anywhere.
- [ ] `scripts/runmeter.mjs` prints sessions, not runs (skills-cb5t).
- [ ] `scripts/runmeter.mjs` guesses a lane's kind from its prompt. On the transcripts it was checked against, about one replay or retro lane in five was sorted wrong, mostly scorers, proxies and planners of a replay whose prompts lack the default marker words. Tune the default pattern with one invented fixture per role, or pass `--replay`.
