# Step 3 — to-dos

Artifact: 25 files under `scripts/`, `evals/seven-steps-primer-defects/` and the two
READMEs, carrying about 75 markers. Every file that changes has at least one.

**This document does not list the sites.** The enumeration is the grep:

```bash
grep -rn 'TODO' scripts evals/seven-steps-primer-defects README.md evals/seven-steps-primer/README.md
grep -rn 'TODO(seam)' scripts evals          # the ones that block step 6
grep -rn 'TODO' evals/seven-steps-primer --include='*.js' --include='*.jsonl'   # must be empty
```

The third grep must stay empty. The Tier 1 step3 case greps the workspace for that token,
so the clean fixture never carries it. The seeded fixture will, by design, because its
markers are the step-3 markers the transcript describes; that is a different suite and a
different case.

## Marker convention

Unchanged from the first feature.

| Marker | Means |
|---|---|
| `TODO:` | An implementation site. Step 6 writes onto it. |
| `TODO(seam):` | Blocked on an open seam. Must not survive step 4. |

Three are outstanding:

| Seam | Where |
|---|---|
| `AskJudge` — print mode, system prompt, one-word reply, cost | `scripts/ledger.mjs` |
| The suite list for the grader self-tests — enumerate or take a list | `scripts/test/graders.test.mjs` |
| The same question from the runner's side: its module-level `paths` | `scripts/run-evals.mjs` |

The second and third are one seam seen from two files. They are marked in both because
the grep has to find both sites, and a marker that points at another file is a marker
step 6 skips.

## Decisions taken while placing markers

**One new module, a correction to step 0.** The plan's tree named six scripts and gave
the ledger and judge-probe functions no home. They are seven signatures with no natural
owner among the six, so `scripts/ledger.mjs` exists, with a test file beside it. Step 0's
module placement is corrected in place by this note; nothing about the design moves.

**The transcript is marked in `case.yaml`, not in itself.** A `history.jsonl` cannot
carry a comment, and a placeholder that is not valid JSON would be worse than no file.
The case file's `history_file` line carries the marker that says what the transcript
must contain.

**The skeleton graders have real frontmatter.** The grader self-test walks every
`graders/*.md` under a suite and refuses a file with no `type`. The three guard graders
that do not depend on the ledger (`liveness-read`, `service-started`, `skill-fired`) are
therefore written as valid graders with their design notes in place, and only
`service-started`'s anchored pattern is a marker. The `reported-*` and `surfaced-*`
graders cannot be named until the ledger exists; their site is the `graders:` line in
`case.yaml`.

**The registration placeholder holds no JSON block.** The runner refuses a suite whose
registration cannot be parsed, before any spend. So the second suite cannot be swept by
accident until step 4 writes the real file and it gets its own proceed.

**The seeded scaffold exits 1 on purpose.** A scaffold that copies nothing would let a
case grade an empty workspace and report incapacity as a finding. Until the five seeded
files exist it fails loudly.

**Markers in the two READMEs are HTML comments.** They are invisible in the rendered
page and outside every instrument digest.

## What the markers surfaced that the plan had not

**The read-only diagnostic wants the same transcript and scaffold as the scored case.**
The harness requires `context.*` paths to sit inside their own case directory, so the
diagnostic cannot point at the scored case's files. Either a copy that the instrument
test asserts byte-identical, or a relative path if the harness tolerates one that
resolves inside the directory. Marked in `step4-read-only/case.yaml`; settled by a run at
step 4, not by choosing now.

## What is deliberately not marked

- The results file, the records directory row, the step-7 cleanup and the thirty
  labelled verdicts: step 7's work, not step 6's.
- The bodies of I9 and I10: the human authors them at step 5. Their signatures are in
  `interfaces.mjs` and their site is marked in `invariants.mjs`; the marker says
  "proposals", not "implement".
- The fresh-context agents' orchestration: this session's work at step 4, not a script.
- `scripts/instrument.mjs` and its test: the digest is already per suite directory and
  nothing in it changes.

## Checked

The whole test suite runs green with the markers in place: 357 tests pass, one skipped
(the binary-marker test, which skips when the CLI is not in the cache path it looks in),
none fail. The markers are comments; the one new test file loads the new empty module.
