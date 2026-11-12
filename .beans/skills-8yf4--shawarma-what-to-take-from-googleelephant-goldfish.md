---
# skills-8yf4
title: 'shawarma: what to take from google/elephant-goldfish-model (EGM)'
status: todo
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-10-28T09:19:22Z
updated_at: 2026-11-11T11:36:35Z
---

Owner request, 2026-10-28: what can shawarma learn from https://github.com/google/elephant-goldfish-model (EGM), and does EGM come with evals? Research done 2026-10-28 on the repo at its public history (107 commits, ~1 week public). Clone, not run: scratchpad only.

## Verdict on evidence

- No quality eval. No benchmark, no ablation, no numbers. A quality benchmark is open issue #61, not started.
- An LLM-judged eval runner existed (PR #71, one scenario, "1/1 passed") and was deleted as unused (PR #88, 2026-10-15).
- What is tested: plumbing (frontmatter, links, a 24,000-byte skill size cap) and reviewer isolation (opt-in live probes that read transcripts).
- Its own FAQ: "Completing the EGM workflow alone does not demonstrate a productivity improvement."
- The one outside measurement (github.com/sateesh2020/egm-goldfish-experiment, n=1, toy doc, 7 planted flaws): EGM, a plain fresh review and a same-session self-review all found 7/7. EGM cost ~4–12× more and took ~7–9× longer.
- Reception: one week old, thin. Most coverage repeats the press release. The one substantive critique: zero-context reviewers catch vague wording, not a spec that is clear and wrong.

Not a toy: careful engineering, honest disclaimers. But no evidence it works. Shawarma is ahead on evals (primer-evals, trap bank, replay).

## Candidates to weigh at a retro (each needs a trap or replay before adoption)

- [ ] **Review-loop stopping rules** (`skills/egm-review-loop/SKILL.md` §2.4). A settled finding is not reopened; an applied fix does not settle it. A round is clean when no new Blocker/Major appears, judged before applying that round's fixes. Stop after 2 clean rounds, cap at 5. "Churn" (a new finding exactly where a fix landed, resolved by reverting it) goes to the human. Compare with run.md's fix-review rounds.
- [ ] **A failed reviewer is "not run", never "clean"** (§2.2). Retry once; a not-run lane makes the round not clean. Check lanes.md covers this.
- [ ] **Four answers to a finding** (`skills/egm-resolve/SKILL.md` Step 2): CONTEST with evidence the reviewer could read, ESCALATE facts only the human knows, PROPOSE FIX, DECLINE nits. "You wrote the document under review. A wish to contest is not evidence."
- [ ] **Paraphrase first** (`agents/comprehension.md`). The reviewer restates what the brief proposes before any finding; a section it cannot restate is a Blocker. Cheap check that a brief reads alone ("an agent reading only it can do its part").
- [ ] **Check the draft against the source, not a rubric** (`skills/egm-draft/SKILL.md` Step 6). At the brief ending, list every contradiction with the ticket and rulings, and every addition that changes an interface. No fresh reviewer can do this, because none reads the ticket history.
- [ ] **Unranked options for architecture choices** (egm-draft constraint 13): up to 3 options, no ranking, no default; "just pick" re-presents the choice. Feeds the framing question in the rulings bean (link below). Unmeasured in EGM.
- [ ] **A test-enforced skill size cap.** Shawarma already meters tokens per load path (`scripts/size_paths.py`); decide whether a hard cap in CI adds anything.

## Not worth borrowing without evidence

The 9-reviewer, 5-stage review with a synthesizer; running each reviewer twice; the 6-reviewer brainstorm swarm; bottom-up README generation. The only data point says they cost more for the same catches. If shawarma ever adds a fresh-context reviewer lane, test it against one plain fresh review on its own tickets, as the outside experiment did.



**Round 9 (2026-11-02): carried to round 10** (disposition D4).


## Review of 2026-11-11

A critical review of the skill re-read EGM at 187 commits (record private). Nothing here is adopted: the owner ruled a hold on the skill's text for about 15 briefed runs. For round 11, with the cases this ticket lacked:

- **Four answers to a finding**, narrowed: a DECLINE as `unreachable` or `false-positive` cites its reading. Case: since the pull-request checker shipped, 24 of 27 DECLINE rows carry only the reason word, 3 of them with these two reasons. Round 6 proposed a form of this and did not adopt it.
- **Review-loop stopping rules**: the review recommends keeping them, on the ticket about review rounds that do not converge (skills-s2ae). Case: one run went five review rounds, and rounds 2 to 4 each found a defect in the previous fix.
- **Paraphrase first** and **unranked options**: the review recommends a small test each, not a drop. The second belongs on the ticket about ruling more without stopping (skills-h8hp).
- **A failed reviewer is "not run"**, **draft against source**, **a size cap in CI**: the review recommends dropping them. lanes.md says a lane with no report is NOT RUN and run.md says an all-clear with no observed run does not count; SKILL.md asks for a reading beside every claim; retro.md rules growth per load path.
- Three ideas this list missed: one fixed, plainly written text per lane kind; reading back what a lane was told (`scripts/runmeter.mjs --prompts`); checking a brief's statements about today's system against the code.
- EGM itself still has no quality evaluation: none of its commits since 2026-10-28 adds one.
