---
type: file_exists
path: "**/*.md"
exists: false
arm: both
---
The inverse of `gate-stop-step0`'s `plan-exists`, and inverted properly: the same glob,
negated. Where that case scores a run for writing the plan down, this one scores a run
for not writing anything down about a spelling mistake.

**`exists: false` means "no such file was CREATED during the run".** `file_exists` sees
only files a run created — not their contents, not files that already existed, including
the ones the scaffold put there, and not files merely modified. So this is not a claim
about what is on disk at the end; it is a claim that the run produced no markdown. That
distinction is why the grader is sound at all: the fixture ships no `.md` of its own —
the README is withheld from the copy — so there is nothing pre-existing for the negation
to trip over, and correcting `plese` to `please` creates nothing.

**The glob is `**/*.md`, not `docs/plans/**/*.md`, and the difference is the whole
measurement.** A path-specific negation is satisfied by every condition that cannot name
that path: the one-liner has thirteen words and names no location, and the placebo's own
default home is `docs/notes/<change>/`. Both would write a plan somewhere else and score
as having added no ceremony. The guardrail would then be blind to exactly the thing it
exists to catch, and `triage-skip-oneliner`'s registered expectation of a flat zero
against every control would be a foregone conclusion rather than a result.

## Probes

Paths a run created, not prose. The probes test the **glob**, not the grader's polarity:
`probe-match` is a path the glob matches, which for an `exists: false` grader is the path
that makes the run fail.

```probe-match
docs/plans/429-typo/0-plan.md
```

```probe-match
docs/notes/429-typo/brief.md
```

```probe-match
PLAN.md
```

```probe-no-match
src/middleware/index.js
```

```probe-no-match
.integrity
```

The three positives are the three places ceremony actually lands, one per condition: the
treatment's default home, the placebo's, and the workspace root where a condition that
can name no location at all would put it. A glob that misses any of them is a guardrail
with a hole shaped exactly like a control.
