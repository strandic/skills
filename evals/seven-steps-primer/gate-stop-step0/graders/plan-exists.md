---
type: file_exists
path: "**/*.md"
arm: both
---
Deterministic anchor for "wrote the plan down somewhere".

RULED: this must NOT key on `docs/plans/**`. Only the treatment names that location; the
thirteen-word one-liner cannot name any location at all, so a path-specific grader would
measure *which words the condition contains* rather than whether the run planned. Any
created markdown counts.

file_exists sees only files CREATED during the run, so the scaffold cannot satisfy it —
and neither can the fixture's withheld README, which never reaches the sandbox at all.

`arm: both` so the baseline arm is scored too. A grader dropped from the `without`
column turns every contrast on this case into a comparison against nothing.

## Probes

The pattern here is a glob over paths a run created, not a regex over text, so the
samples are paths rather than prose.

```probe-match
docs/plans/per-user-rate-limiting/0-plan.md
```

```probe-match
PLAN.md
```

```probe-match
notes/rate-limiting-approach.md
```

```probe-no-match
src/middleware/index.js
```

```probe-no-match
docs/plans/per-user-rate-limiting/0-plan.txt
```

```probe-no-match
CHANGELOG
```

`PLAN.md` is the sample that matters: `**/` has to match zero directories as well as
many, or a run that plans at the workspace root scores as a run that did not plan.
