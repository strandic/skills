# Changelog

All notable changes to the `strandic` plugin. The version is the one in
`.claude-plugin/plugin.json`. Marketplace users only get changes when it goes up.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each
shawarma minor version is one retro round. The full rulings for each round are in the
bigbrain vault under `docs/retros/`.

## [Unreleased]

## [0.8.0] - 2026-10-19

shawarma round 8.

### Added
- `freeze_check.py` runs plan step 5's mechanical freeze conditions on a brief, checks F1–F9:
  - the nine sections exist, in order;
  - each attack line has a reading or reads `NOT RUN`, and each `NOT RUN` is in the review
    lane's cell;
  - Sources and Partition rows have readings;
  - the lane cells match lanes.md;
  - every class word has a line id (FAIL in §3 and the lane cells, WARN in code comments);
  - every §5 rule has its fields (`--fields` prints them);
  - the header names every lesson in the listing (`--listing`).

  Plan step 5's freeze list is now one sentence plus this script.
- `check_pr.py` checks a PR body, checks P1–P6:
  - its sections;
  - the Decisions and Findings tables and their labels;
  - every RULING/DEFAULT id is one the brief records;
  - the pasted `git log` is re-run;
  - every test the tests commit added but HEAD lacks is named in §9.

  run.md's PR-key sentences moved into its `--skeleton`. `test_checks.py` holds 36 tests
  for both scripts.
- Asks go on the ticket under `## Ask <date> · <kind>` and are counted by
  `check_pr.py --asks`. The hand-kept stats lines are gone.

### Changed
- Spike and plan:
  - an outside writer is one of the unit kinds;
  - enumerations come from the consumer's spec;
  - framed text is parsed by the consumer's grammar;
  - older releases still running count as writers;
  - a red needs a reason the unfixed code cannot also produce;
  - options are executed at the values offered.
- §2 planner-saw items and attack lines carry ids. §9 is the record of decisions.
- An unsettled re-read is a RULING stop. The triggers for a fresh review lane are named.
- Retro: escapes are attributed at any age, and a PR's own known residues are counted.
- Load paths (tokens):

  | path | before | after |
  |---|---|---|
  | plan | ~7.1k | ~7.1k |
  | interview | ~7.3k | ~7.4k |
  | run | ~7.1k | ~6.9k |
  | retro | ~1.8k | ~1.9k |

## [0.7.0] - 2026-10-15

shawarma round 7.

### Changed
- shawarma is split by load path. SKILL.md keeps the core (house rules, asking, triage) and a
  Dispatch section; plan, run, retro, the design interview, the lane cells and cost probes
  each have their own file, read when the command reaches them. Text moved verbatim. Plan
  load ~9.4k → ~7.1k tokens; retro ~5.1k → ~1.8k; run ~6.9k → ~7.1k.
- Retro: tokens per load path (`scripts/size_paths.py`) replace the word-count rule; the
  trap-bank replay decides each cut. The evidence lanes also count escapes (bugs traced
  to a merged PR).
- Review: before committing a review round, one RULING stop carries every hunk that
  touches frozen text, read from a pasted `git diff`.
- Design interview: a ruled question whose options later research widens is re-asked.
- Lanes check each named oracle: one sharing a parser, a ref or an environment with what
  it grades is a finding, not run. A §5 rule reads a trace that its guarded step ran.
- The plan-time lane flags ticket checklist items with no owner in the brief.
- PR body: an "Unreviewed since the last lane" field with pasted `git log`; run step 1's
  base-moved row built from pasted `git diff --name-only`. Brief header pastes the lessons
  listing with a verdict per lesson.

Also in this release:

### Changed
- README: seven-steps-primer is marked retired, with its reasons and a summary of its
  eval findings. shawarma now leads the Skills table and has its own section. The
  primer's files are still in the repo. (daffef1)

### Fixed
- `.claude-plugin/marketplace.json` now lists version 0.6.1. It had stayed at 0.2.0
  while `plugin.json` moved from 0.3.0 to 0.6.1.

## [0.6.1] - 2026-10-09

### Fixed
- shawarma: the `description:` in `SKILL.md` is now quoted. In 0.6.0 it held an
  unquoted `: `, so the frontmatter did not parse as YAML. The skills CLI then skipped
  the skill, and `npx skills update` printed "Failed to update shawarma" with no
  reason. (4e0b49a)

### Added
- `scripts/test/frontmatter.test.mjs`: fails when any skill's frontmatter has an
  unquoted value that contains `: `, ends in `:`, or starts with a YAML indicator.

## [0.6.0] - 2026-10-09

Round-6 retro. (0f5fa13)

### Changed
- shawarma:
  - Fixes made during a review round get a fresh review lane, so no commit ships
    unreviewed.
  - Factor pairs now include settings that contradict each other and settings carried
    over from before.
  - Each bound is stated beside the range actually observed.
  - Findings that predate the ticket go into new tickets. They are not folded into the
    current one.
  - Drift in the base branch is checked at wave 0.
  - Research covers design alternatives, current versions, and differences in default
    limits.
  - Lessons from one ticket are no longer carried into the next.
  - The retro script is checked to parse.

## [0.5.0] - 2026-10-05

Round-5 retro. (62ec88a)

### Changed
- shawarma:
  - Research is a required plan step. It must be sourced and quoted verbatim, and the
    attack lane re-reads it. A spike's input is never counted as a reading.
  - A DEFAULT that touches a ruling, residue, cited lesson or 3(c) shape is a RULING.
  - Cost probes say which clock they measure, head or base.
  - Enumerations are sourced, and each member is shown to be hit.
  - An oracle built on a shared component cannot grade.
  - Gate data must be reachable from a fresh worktree.
  - Every ending, including stop and scrap, prints a stats line.

### Removed
- shawarma: the unused test and implementer lanes, and model labels.

## [0.4.0] - 2026-10-03

Round-4 retro. (54cf11f)

### Changed
- shawarma:
  - The trivial path allows a read-only check, and rejects its own readings that show
    wrong output.
  - There are now exactly two paths.
  - Variants are checked to be live.
  - In-band markers must use characters from the alphabet.
  - Cost tests assert counts or ratios.
  - Figures appear beside the commands that produced them.
  - Measurements name their sources.
  - A check confirms that dropped coverage was really covered elsewhere.
  - Wrong output that cannot be reached is a DEFAULT.

## [0.3.0] - 2026-10-01

Round-3 retro. (11647bf)

### Changed
- shawarma:
  - Executed text is committed as it runs.
  - Cost probes account for memory.
  - Sequences are enumerated.
  - Error rows cover each path.
  - A grep at freeze catches class words.
  - The review lane starts with its own attacks.
  - Leak checks were added.
  - Decisions and Findings tables were added.

## [0.2.0] - 2026-09-24

### Added
- shawarma, a method skill with three commands: plan, run and retro. Its files are
  `SKILL.md`, `spike.md`, `brief-template.md` and `retro-workflow.js`. (1546f9e,
  PR #2)

### Changed
- seven-steps-primer (these changes were committed after 0.1.0, but marketplace users
  first got them in 0.2.0):
  - Step 3: TODO markers go in the source at every site. A list in a planning doc
    does not count. A Deliverables section was added. (8111417)
  - Step 4: recon must build and run the code, and a defect it finds is fixed in the
    earlier step that owns it. Worktree isolation and per-gate checkpoints became
    one optional setup choice. (0d61bc7)
  - The default artifact home is `docs/plans/<feature>/`. Saved setup preferences are
    used as the defaults and confirmed instead of asked again. Step 4 was split into
    seven named rules. (64e4b9f)
  - The setup choices are asked at gate 0, not before step 0. Before this change,
    agents stopped to ask and produced nothing. (80f4938)
  - The gate rule is repeated at step 0 and at the end. (ce5814d)

## [0.1.0] - 2026-07-08

### Added
- seven-steps-primer, published as a Claude Code plugin. (cb311a2)
- The repo layout for more than one skill, `strandic/skills`. (eb64e0b)

[Unreleased]: https://github.com/strandic/skills/compare/4e0b49a...HEAD
