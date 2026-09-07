# Step 5 — invariants

**Rules authored by the repo owner** at gate 5 (2026-09-07), from proposals the plan
carried. This step wired and adversarially tested them; it did not write them. The word
list in I10 is the owner's.

Artifacts: `scripts/invariants.mjs` (five new checks and one constant) and
`scripts/test/invariants.test.mjs` (26 new tests, 99 in the file).

## The rulings

| # | Invariant | Enforcement |
|---|---|---|
| I9 | An instrument's authors **stayed inside the fence**, and a sweep run that reaches outside it is **counted, not dropped**. | Authoring transcripts: a path under any forbidden root, or a git command, voids the instrument; digests returned for the ledger. Sweep traces: a named fragment (`/defects/`, the shipped skill, the clean fixture) flags the run and adds to a per-cell `refusedCounts`; the run's score stands. |
| I10 | **No method vocabulary** in an instrument or a brief. | Whole-word, case-insensitive match of the owner's thirteen terms over every grader body, detect script, ledger entry, probe reply and the two authoring briefs. A hit voids the file. |
| I11 | Every group contrast is judged against **its own floor**, and a floor that is not a measurement leaves the group **unmeasurable**. | `belowNoiseFloor` required where `|value| <= floor + NOISE_EPSILON`; a floor at or below `NOISE_EPSILON` must have no contrasts and the group in `unmeasurableGroups`; the (case, group) count must equal the registration's. |
| I12 | **The four counts are on the page**: runs present, errored, excluded, refused, per scored case, condition and arm. | Each a number, for every registered condition and arm; runs present at least `runsPerCase`. |
| I13 | A case registered `contrasts: 'groups'` **carries its contrasts in its groups** and nowhere else. | At least one group; a direction for every group against every control; no case-level direction key; no case-level contrasts in its report row. |

The existing eight (I1, I1b, I1c, I2, I2b, I4, I4b, I7, I8) wire to the second suite
unchanged. I3's tripwire takes a per-suite anchor and plan path, since the new ceiling
opens on different words. I5 covers the new patterned graders. I6 is not run for this
suite: it registers no absence case, and running I6 on an empty list is a refusal by
design, so the test says why it is skipped rather than passing an empty list through.

`FLOOR_ERROR_MULTIPLIER = 2` sits beside `NOISE_EPSILON`, so the merger's floor and I11
read one number, and the registration's `floorErrorMultiplier` is checked against it at
merge time (step 6).

## The adversarial pass

Every check was attacked on the two axes the first feature's step 5 named.

### They are all true of nothing

Each check refuses the input that would let it pass without looking:

- I9 refuses an empty transcript list ("an isolation nobody was subject to is not
  isolation"), an empty fence, and a transcript with no text. The trace half refuses an
  empty trace list and an empty fragment list.
- I10 refuses an empty file list and an empty word list ("the owner has not authored
  one").
- I11 refuses a report with no group contrasts, a count that disagrees with the
  registration, and a missing expected count.
- I12 refuses an empty report, a missing run count, and a missing condition list.
- I13 refuses a registration with no cases, and one in which no case is a groups case
  at all: a check with nothing to hold is not a pass.

### Absence read as agreement

- A missing trace text is flagged, not read as clean (I9).
- A file with no text is a violation, not a clean file (I10).
- A contrast with no floor is a violation, not an above-floor contrast (I11).
- A missing count kind, or a missing arm inside a count, is a violation (I12).

### Two things a naive version got wrong, caught by the fixtures

- **`git` as a substring.** The designer's transcript contains
  `find … -not -path '*/.git/*'`, which is a `find` exclusion and not a git run. I9
  matches `git` only as a command word, and the test pins that exact string as clean.
- **Words as substrings.** "gateway" is not "gate", and "true   input" with extra
  spaces is "true input". I10 matches whole words with flexible internal whitespace, and
  the test pins both.

### What I9's second half is, and is not

It is a count, ruled at gate 4: a run whose trace names the ledger or the shipped skill
keeps its score and is published as flagged, because dropping it would bias the sample
toward incurious agents. It is not a proof of contamination: recon saw one such run list
the paths and read none of them. The count says how often the fence was approached; the
kept trace says what happened.

## Still to wire

The checks are pure predicates over data. Connecting them to real reports, real ledgers
and real traces is step 6: the merger fills `groupContrasts`, `unmeasurableGroups` and
the four counts; the ledger reader hands I9 the transcripts and I10 the files; the
grader self-test runs I10 over the second suite. The sites are marked.
