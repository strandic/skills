# Step 5 — invariants

**Rules authored by the repo owner.** This step wired and adversarially tested them;
it did not write them. An invariant is a pre-agreed ruling on a future dispute, so a
rule the agent drafts and the human approves was never pre-agreed — it was
rubber-stamped, which is the failure mode the method names first.

Artifacts: `scripts/invariants.mjs` (the checks) and
`scripts/test/invariants.test.mjs` (33 tests, all passing).

## The rulings

| # | Invariant | Enforcement |
|---|---|---|
| **I1** | A run must be **complete** to be publishable. | `partial: true` fails. |
| **I1b** | A contrast **at or below the noise floor is still published** — but marked. | Every contrast with \|Δ\| ≤ spread + 1e-9 must carry `belowNoiseFloor`; a tie is inside the floor. |
| **I1c** | A sweep with a run that produced no graders, or a grader that threw, is **not publishable**, whatever `partial` says. | Every run in every case is checked. |
| **I2** | A run is **void** on any of: dirty or mismatched pre-registration, drifted treatment condition, changed subject model, changed CLI series, sweeps on different CLIs. | Compared against the pre-registered values and across the merged sweeps. |
| **I2b** | The merged sweeps were measured with **one instrument, the one in the tree**. | Two halves. Shared: every sweep record and `drift.json` carry `instrumentSha` (cases, graders, transcripts, fixture); all must agree with each other and with the tree. Per condition: each record carries `conditionSha` (its own `conditions/<id>/`), compared against the tree for that condition only. An edited condition voids its own sweep; an added condition voids none; an edited grader voids all. |
| **I3** | The claim ceiling is a **hard rule**. | Tripwire: the ceiling sentence must be present verbatim, and the claims section may not change while the pre-registration digest does not. |
| **I4** | Delta and capability evidence are **never mixed**, and no combined mean is emitted. | Row kinds checked against expected counts; an `overallScore` field is itself a violation. |
| **I4b** | Every registered scored case was **measured in every condition, at its registered ablation**. | Each sweep's per-case `ablations` map is compared to the registration; a missing case or an empty run list is a violation, reported with the rest. |
| **I5** | A grader may not ship without **complete** probes. | Both halves required — at least one must-match *and* one must-not-match. |
| **I6** | An **absence claim needs content evidence**. | Every absence case must carry a `{source: file}` grader; tool-name graders alone fail. |
| **I7** | A **control-tagged case never reaches a headline**. | It may not appear in either scored table. |
| **I8** | Expected direction cannot be set or changed **once numbers exist**. | Digest comparison, plus a dirty-tree failure. |

Two of these were already decisions — D6 and D7 — and the step-5 question was whether
they get teeth. Both now do.

**I1b deserves a note**, because it reads backwards at first. Suppressing small
contrasts would be publication bias: having committed to publishing every condition
whatever it shows, filtering the ones too small to distinguish from chance would quietly
break that commitment. So a +0.04 against a 0.15 spread is published — and marked, so
nobody reads it as a finding. Publishing it unmarked would be worse than suppressing it.

## The adversarial pass

*"Give the enforcement the same adversarial pass as the rules it polices: a check that
can false-positive erodes the law it enforces."*

Recon had just supplied a live specimen — a grader that reported `Edit called 0x` and
`Write called 0x` over a file a Bash one-liner had rewritten. A law enforced by that
check acquits the guilty. So every invariant here was attacked before it was trusted,
and one failure mode turned out to be shared by all nine.

### They are all true of nothing

Every one of these is a "nothing violates X" rule, and **every such rule is trivially
satisfied by an empty set**:

- a probe check that finds no graders reports that all graders have probes
- a containment check that finds no delta rows reports that no control leaked into them
- an absence check that finds no absence cases reports that none rests on tool names

Each would pass, loudly and greenly, on a suite that had silently stopped discovering
anything — a moved directory, a changed glob, a rename. That is precisely the
Bash-mutation shape: a check reporting clean because it could not see.

**So every check pairs its rule with a non-emptiness assertion, and the expected counts
are supplied by the caller rather than derived from the data being judged.** A check
cannot both define what it should find and confirm it found it.

Twelve of the 33 tests exist only to prove the vacuous input is refused:

```
✔ I1b refuses an empty delta set instead of passing vacuously
✔ I5 refuses an empty grader list rather than reporting all graders covered
✔ I6 refuses an empty absence-case list rather than passing vacuously
✔ I7 refuses an empty spec list rather than finding no control to leak
```

### Absence read as agreement

The second recurring attack: a **missing** value read as a satisfied one.

- `partial` undefined must not mean complete (I1)
- a missing provenance block must not mean nothing is void (I2)
- a missing README must not mean the ceiling is intact (I3)
- an empty digest on either side must not mean the two agree (I8)
- an unmeasured `baselineSpread` must not mean nothing is below it (I1b)

Each fails closed. Absence of evidence is not evidence of compliance.

### What I3 can and cannot do

No code judges whether English overclaims. I3 is a **tripwire, not a judge**: it
verifies the ceiling sentence is present verbatim (whitespace-insensitively) and that
the claims section did not move while the pre-registration stayed still. A rewrite that
keeps the sentence and adds an overclaim beside it passes. Stated here rather than
discovered later — the enforcement is weaker than the rule, and the gap is a human
review of README diffs.

## Still to wire

The checks are pure predicates over data. Connecting them to real reports, real case
files and real git state is step 6, and the sites are marked.
