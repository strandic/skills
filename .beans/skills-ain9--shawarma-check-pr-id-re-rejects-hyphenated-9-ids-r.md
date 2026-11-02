---
# skills-ain9
title: 'shawarma: check_pr ID_RE rejects hyphenated §9 ids (RR1-a), next retro'
status: completed
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-10-30T14:51:03Z
updated_at: 2026-11-02T14:17:33Z
---

Finding, 2026-10-30: `check_pr.py`'s `ID_RE` (line 57) does not accept the hyphenated §9 ids that runs write. A Decisions row naming `RR1-a`, `W1-b` or `RR3-d` fails `P4 … RULING row names no id`, even beside a link to its record.

The case: a run's brief named its review-round amendments `RR1-a`…`RR3-d` and `W1-b` (§9 rows and `decisions.md`). At PR time, 8 of 16 Decisions rows failed P4. Ids without a hyphen in the same table (`Q1`, `D5`, `RB1`) passed.

**Patch applied in the working tree, uncommitted** (owner's ruling: keep it, don't commit; this bean takes it to the retro):

```diff
-ID_RE = re.compile(r"(?<![\w-])([A-Z]{1,2}\d+[a-z]?|[A-Z]-[A-Z]+\d+[a-z]?)(?![\w-])")
+ID_RE = re.compile(r"(?<![\w-])([A-Z]{1,2}\d+(?:-?[a-z])?|[A-Z]-[A-Z]+\d+[a-z]?)(?![\w-])")
```

Readings with the patch, through `ids_in`:
- unchanged matches: `Q1`, `D5`, `RB1`, `RV1a`;
- now matching: `RR1-a`, `W1-b`, `RR3-d`;
- still not matching: `run A (another repo)`, `R-A`, `A-1`, `RR1-ab`;
- ranges unchanged: `Q1-Q4` → Q1–Q4, `D1–D7` → D1–D7.

With the patch, the PR body printed `PASS`. No test file covers `ID_RE`; these readings come from a one-off `python3 -I -c` loop.

**How it was made, which is itself a finding:** the agent edited the skill file in place during a run on another repo. The other account's installed skill is a symlink chain into this repo, and the agent did not check where it resolved. The intended route is a bean like this one, not an edit.

- [ ] Rule: keep the widened `ID_RE`, or name §9 ids without a hyphen (then say so where §9 ids are minted).
- [ ] If kept: add cases to the checker's tests (or evals) for the four groups above, and commit the patch.
- [ ] Decide whether `R-A`-style ids (letter, hyphen, capital) should match the first alternative; today only `Q-R1`-style (with digits) does.
- [ ] A rule for agents: a change to the skill found during a run becomes a bean, never an in-place edit. Note where the symlink resolves.



**Closed by the round-9 retro (v0.9.0, 2026-11-02).** See the round-9 rulings (R4, R8, R15).
