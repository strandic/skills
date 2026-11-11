---
# skills-kxko
title: 'shawarma trivial path: check_pr P1 expects a plan-note commit, and nothing on the trivial path says to make one'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-11T12:13:09Z
updated_at: 2026-11-11T12:13:09Z
---

Field report, 2026-11-11, from a trivial-path run in another repo (strandic 0.9.0). The gap is still in v0.10.1; line numbers below are for v0.10.1.

## What happened

A trivial-path run (plan judged trivial, then run) reached Wave 4. `check_pr.py <ticket> <body> --repo <worktree>` printed:

```
P6 not applicable (trivial)
P8 not applicable (trivial)
M1 not applicable (trivial)
FAIL P1 line 1: first line does not link the plan ending (brief/plan + commit)
FAIL (1)
```

The body's first line was `Plan ending: [trivial note on the ticket](<Linear issue URL>) · ticket <id> · no brief commit (trivial path; the plan note is a ticket comment)`. It contains "plan" but no SHA, so P1 fails. P1 needs `\b(brief|plan)\b` and `\b[0-9a-f]{7,40}\b` on the first line (`check_pr.py:580`).

The run judged the FAIL false, pasted it into the PR's Verification table, and left the records unchanged, as run.md step 6 says.

## Why there was no SHA

The skill's text and the checker's skeleton disagree:

- The `--skeleton` comment (`check_pr.py:165`) says that on the trivial path the first line links "the ticket's plan-note commit": `Plan ending: [trivial note <sha>](<link>) · ticket <id>`.
- SKILL.md's Triage › Trivial (`SKILL.md:23`) says to write the ticket note "per house rules" and then stop. It never says to commit the note. plan.md step 5 says "Note on the ticket and commit per house rules", but that step is the brief ending.
- In a repo whose tickets live in a tracker such as Linear, and whose house rules (`docs/plans/README.md`) don't cover trivial notes, the note is a tracker comment. Nothing is committed, so P1 can never pass on that path.

## Second gap: the ticket file

In trivial mode the checker reads the ticket as a file (`ticket_records`, `check_pr.py:432`), which needs a `## Plan` heading in the ticket text. With a tracker ticket, that file doesn't exist. The run had to build a local copy (the ticket text plus the plan note under `## Plan (<date>)`) only to feed the checker. Nothing in the skill describes that copy.

## Also seen

P1's SHA test accepts any run of 7 to 40 hex characters anywhere on the line. Any SHA passes, including the base commit's. It doesn't check that the commit holds the plan.

## Options, for the retro to weigh

- [ ] 1. Say where the note is committed. The trivial ending tells the run to commit the note, for example `docs/plans/<date>-<ticket>-<name>/note.md` with a `## Plan (<date>)` heading, either per house rules or by default. P1 then has a real commit, and that file is what the checker reads as the ticket.
- [ ] 2. Let P1 accept a tracker link. In trivial mode, allow a plan ending that is a tracker comment URL with no commit, and document it.
- [ ] 3. At least align the docs. Make SKILL.md's trivial line and the skeleton say the same thing, and say what file the checker's `<ticket>` argument is when tickets live in a tracker.

Reporter's preference: option 1. It gives the checker a real commit, gives the trivial path the same kind of record as a brief, and removes the local copy. Whichever option lands, consider tightening P1 so the SHA must be a commit that touches the plan or note file.

Evidence: biojoule/infrastructure PR 1776 (BIO-1463), whose Verification table quotes the FAIL.

**Filed 2026-11-11, for the next retro.** The skill changes only at a retro.
