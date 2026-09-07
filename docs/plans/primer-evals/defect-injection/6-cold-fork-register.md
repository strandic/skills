# Step 6 — cold implementer's register

**42 decisions the artifacts left open**, from one fresh context building onto the step-3
markers with nothing but the step documents, the registration and the existing code:
**6 blocking · 22 material · 14 cosmetic**.

The register is the point of a cold build. It measures the artifacts, not the
implementation: every line below is a place where the documents stopped short of the
code, and the entry says what was chosen and why. Where the choice contradicts a
document, the document is named.

One difference from the Tier 1 register: that one is ten fresh forks and reports how
often each gap was hit. This is one build, so the count is a list of gaps rather than a
frequency.

## Blocking — the build could not proceed without a ruling

1. **A grader a group names but the record does not carry.** `2-interfaces.md` says
   `ExtractGroupRunScores` refuses such a name; `merge-results.mjs`'s own B4 rule says a
   hole must not abort the merge, because a throw ends the run before any invariant is
   heard. Chose both: the pure function still throws, `mergeSweeps` catches it, records
   the reason as a row advisory, and leaves the group unscored — which reaches I11 as a
   group with no contrasts and no unmeasurable mark, so the merge is still refused and
   the whole invariant list is still printed. Owning artifact: `2-interfaces.md`
   (`ExtractGroupRunScores`), which never says what the CALLER does with the refusal.
2. **Where `refusedCounts` comes from.** The step brief says the merger fills it from
   I9's trace flags over the kept traces, but `MergeSweeps` is pure and takes three
   arguments, and nothing in `1-types.md` or `2-interfaces.md` gives it traces. Chose: a
   fourth optional parameter, `options.traceTexts`, a map from a run's `tracePath` to the
   trace as read from disk, filled by the entry point. A merge handed no traces publishes
   no fence count and I12 refuses it. Owning artifact: `2-interfaces.md` (`MergeSweeps`).
3. **`MergedCaseRow` was missing two fields the invariants already read.**
   `i11GroupFloorMarked` reads `row.unmeasurableGroups` and `i12CountsPublished` reads
   `row.refusedCounts`; neither is in `1-types.md`. Added both, and `1-types.md` is
   amended. Owning artifact: `1-types.md`, which was written before I11 and I12 existed.
4. **When I11, I12 and I13 are wired.** Wiring them unconditionally fails every Tier 1
   report, which registers no groups. Chose: they run only when the registration carries
   at least one `contrasts: 'groups'` case, and the report-wide I1b runs only when it
   carries at least one case-level delta case. `checkReport` gains a `skipped` list so a
   check that did not run says why. Owning artifact: `5-invariants.md`, which says I1b's
   group form applies "instead of refusing" without saying who decides.
5. **Which sentence I3 holds the second suite's README to.** The step-3 marker says the
   check takes "the plan path and the anchor", but that suite's plan blockquote (D6) was
   written before recon and superseded at gate 4 — it still says "run-only", a class the
   registration abandons. Chose: for this suite I3 reads `claimCeiling` out of
   `PRE-REGISTRATION.md`, which is the file I2 digests and I8 refuses edits to, and
   asserts that it opens on the anchor the plan named. Tier 1 is unchanged. Owning
   artifact: `0-plan.md` D6, whose *[step 4, if option 1]* note describes the replacement
   sentence rather than carrying it.
6. **The definition of done assumes three sweep records exist.** The recon leftovers hold
   two (`treatment`, `placebo`); recon never swept `run-oneliner`, and both records
   predate the twelve `reported-*` graders. So the merge is refused first by a missing
   sweep file, and — with a scratch third record supplied — by I1c/I11/I12 as expected,
   plus I2b, because the two recon sweeps were taken on different instrument digests.
   Nothing was invented to make the check pass. Owning artifact: the step-6 brief, and
   `4-recon.md`, which records that the sweep of the third condition was never run.

## Material — a real choice, defensible either way

7. **`floorErrorMultiplier` was in the registration and in no type.** Chose: optional on
   `PreRegistration`, required of a registration that carries a groups case, refused if it
   is not a positive number, and refused if it disagrees with the code's
   `FLOOR_ERROR_MULTIPLIER`. `5-invariants.md` asks for the comparison "at merge time",
   and the parser is the earliest point at merge time. Owning artifact: `1-types.md`.
8. **A floor that could not be computed is not an unmeasurable one.** `2-interfaces.md`
   says a floor at or below `NOISE_EPSILON` makes the group unmeasurable, and says nothing
   about a floor that is NaN. Chose: NaN produces a contrast with no floor, which I11
   refuses. "We could not measure the noise" and "the noise is below what this instrument
   resolves" are different sentences and only one is a finding. `0-plan.md` D4 supports it
   ("the merge is refused … when a floor is missing").
9. **Which pooled standard deviation.** No artifact names an estimator. Chose the classic
   pooled one, sum of squared deviations over `nT + nC - 2`, and NaN when that is zero or
   less: a spread invented out of one observation is not a spread.
10. **The `none` cell's run pool.** `2-interfaces.md` says "the three without-arm columns
    concatenated". Chose: every sweep's without-arm runs concatenated, whatever the number
    of sweeps, because the sample the standard error is taken over must be the sample the
    mean was taken over. Three is the count this registration happens to produce.
11. **`ResolveSuite` cannot check for a `PRE-REGISTRATION.md` and stay pure.** Chose: the
    pure resolver refuses the shape (one directory directly under `evals/`, absolute paths
    inside the checkout normalised), and `main`'s first read refuses the missing file
    before any spend. Both halves of the declared rule hold; only one is enforceable
    without touching the disk. Owning artifact: `2-interfaces.md` (`ResolveSuite`).
12. **How `parseArgv` stops defaulting `runs` from a constant.** Tier 1's tests pin
    `parseArgv([]).runs === 5`. Chose: a third parameter, `defaultRuns`, which `main`
    supplies from the registration; the constant survives only as the fallback for a
    caller with no registration, and its comment now says so. Owning artifact: the
    `run-evals.mjs` marker, which says the constant stops being the source without saying
    what a caller without a registration gets.
13. **An explicit `--runs` below the registered count.** The marker asks for it to be
    refused. Chose: refused in `main`, before any preflight, and `--smoke` is exempt —
    the pilot is deliberately short and its record is never merged.
14. **The judge prompt goes as an argument, not on stdin.** Recon put it on stdin;
    `SpawnCapture`, the handle every spawn in this repository goes through, has no stdin.
    Chose the trailing positional argument, which recon also tried and which returned
    normally, over widening the handle for one caller. Owning artifact: `2-interfaces.md`
    (`AskJudge`), whose resolution names a mechanism the declared handle cannot express.
15. **The detect script's service is its argument, not its working directory.**
    `2-interfaces.md` says `bash <script>` with the service as cwd; `SpawnCapture` carries
    no cwd, and every committed script takes the service root as `$1`. Chose the argument
    — which is also the half that fails loudly, since the default is the ledger's own copy
    and recon lost an acceptance pass to exactly that.
16. **`readDefectLedger` refuses a `class` that disagrees with the tally.** No artifact
    asks for it. Chose to refuse: `class` is set by `classifyDefect` and by nothing else,
    so a hand-edited `class` file is a human reclassifying, which D3 forbids.
17. **`DefectSpec.graders` is derived, not stored.** The ledger has no such file. Chose:
    `reported-<id>` always, plus `surfaced-<id>` only for a run-only defect, which is the
    rule D4 states. On this ledger that is twelve names and no `surfaced-*`.
18. **`transcriptDigests` is read from `defects/transcript-digests.txt`**, one
    `role digest` per line, with `criteria-author` mapped to the type's `criteriaAuthor`.
    The ledger file exists; no artifact names its format.
19. **A generator that writes the graders from the ledger.** The step brief asks for one,
    and the twelve `reported-*.md` files are frozen. Chose: `graderFilesFor` reproduces
    all twelve byte for byte — asserted by a test — so the generator is checked against
    the committed instrument rather than replacing it. The `surfaced-*` shape it would
    write for a run-only defect carries both probe halves, since I5 refuses a patterned
    grader without them.
20. **What I10 reads among the graders.** `5-invariants.md` says "every grader body".
    Chose: every `llm` body, plus every ledger file and both authoring briefs — 122 files,
    zero hits. The three unscored guards are excluded, with the reason stated in the test:
    their bodies reach no judge and no author under the fence, they name recon and step 4
    on purpose, and they are shared fixture state written by someone who has read the
    method — which the plan already lists as what the rule cannot cover.
21. **The owner's word list had no home in code.** It existed only inside
    `invariants.test.mjs`. Chose: `METHOD_VOCABULARY`, exported from `invariants.mjs`
    beside `FLOOR_ERROR_MULTIPLIER`, as data rather than a rule — the check still takes
    its list from its caller and still refuses an empty one. Two callers now read one
    copy. Owning artifact: `5-invariants.md`, which says the list is the owner's without
    saying where it lives.
22. **The manipulation-check section needed data that no type carried.** Added
    `manipulationChecks` to `MergedCaseRow`: for every grader the case scored that no
    group names, the fraction of with-arm runs that passed it, per condition.
23. **The fence fragments.** `0-plan.md` D3 names `/defects/`, `skills/seven-steps-primer`
    and "the Tier 1 fixture directory". Chose `fixtures/notesvc/` with the trailing slash,
    which is the only way it does not also match the seeded fixture's own path.
24. **A trace that could not be read.** Chose: the affected cell's refused count is
    removed, not set to zero, so I12 refuses the report and names the cell. A count of
    zero would be absence read as agreement, which is the failure the whole suite is built
    against. A run with no `tracePath` at all — a sweep run without `--keep-temp` — is the
    same case.
25. **`build-conditions.mjs`'s `paths` export.** The runner imports it. Chose: keep its
    shape, add `copied` to it, add `pathsFor(suiteDir)` and `checkAll`, and let the
    existing `check`/`generate` walk `where.copied ?? {}` — so the Tier 1 path is
    byte-identical and the second suite is a second instance rather than a second
    function. Owning artifact: `2-interfaces.md` (`SuiteConditionPlan`), which describes
    the plan but not how the existing two-argument functions receive it.
26. **An authored condition appears in no plan.** `SuiteConditionPlan` has three maps and
    the run one-liner is in none of them. Chose to state it as the rule and test it:
    generating an authored condition would overwrite the text under test.
27. **`step4-read-only/case.yaml`.** Chose to settle the two that are mechanical — the
    prompt is now the scored case's verbatim, and the turn cap of 30 is justified from
    recon's measured 26 to 31 turns — and to leave two for step 7, marked as open in the
    file: whether `history_file` is reused by a relative path or by a copy (never run, and
    `4-recon.md` says so), and whether the twelve `reported-*` graders are duplicated into
    it. Neither can be settled without running the case, and the case reaches no table.
28. **The two `liveness-read.md` guards.** The diagnostic's marker says "keep
    byte-identical", and the two bodies differed. Chose: made them identical, and added the
    test the marker says asserts it.
29. **`checkDefectAcceptance`'s rules are eight booleans, each failed alone in a test.**
    `2-interfaces.md` lists them in prose; the table and the message per rule are chosen
    here. An unobserved boolean is a violation, not a pass.
30. **The fixture-health test runs the service.** The step-3 marker asks for suite-green,
    each script red on seeded / green on clean / red after the reference implementation,
    the signature grep, the scaffolded workspace and two concurrent starts. Chose to run
    all of it in `node --test` — 8 seconds, 36 service starts — building the clean copy by
    reversing every `diff.patch` and the implemented copy by applying
    `reference-implementation.patch`, and skipping with a reason when `git` is absent.
31. **`i9TraceFlags` counts runs 1-based per arm**, which is how the advisory names them.
    No artifact says.
32. **`countRuns`'s `groupRunScores` parameter.** The declared signature takes it and the
    declared behaviour does not use it. Chose: it is the cross-check that the group arrays
    and the document describe the same runs, and a disagreement is refused.
33. **A single-arm case carries no `without` count**, rather than a zero that reads as an
    empty arm. `ArmCounts` types `without` as optional; nothing says when it is absent.
34. **A Tier 1 check had stopped running, and nobody could have noticed.** "Every
    harness-fact marker still resolves against the pinned CLI binary" looks for the binary
    in `~/.local/share/claude/versions/`, and the pin was deliberately moved out of that
    directory because the updater prunes it — the suite's own README tells an operator to
    keep it under `claude-pinned/`. So the check had been skipping on every machine that
    followed the README. Chose: try both homes. It now runs, and every citation still
    resolves in 2.1.250. The new judge-prompt pin beside it was written the same way for
    the same reason. Owning artifact: `evals/seven-steps-primer/README.md`, which moved
    the pin without the test hearing about it.

## Cosmetic — a wording or a shape, decided and moved on

35. **`USAGE` rewritten**, including the marker's demand that "the pre-registered count"
    become literally true. It now names the registration rather than a number.
36. **The group tables' columns**: condition, score, and the four counts; then vs, Δ,
    registered direction, floor, none range, 2×SE, pooled SD, runs T, runs C, note. Every
    part of the floor is printed so a reader can recompute it.
37. **"unmeasurable" is printed as a sentence, not a cell**, so it cannot be read as a
    number that happened to be missing.
38. **The advisories are printed when the merge is refused.** A violation says which rule
    refused; an advisory often says why, and on a refusal the report that would have
    carried them is never written.
39. **`parseArgv` refuses `--suite` with its own message** rather than as an unknown
    option, because reaching it means a caller passed the raw argv and the flag would
    otherwise be silently ignored while the command line named another suite.
40. **The test-count ratchet moves 191 → 490.** Bumped deliberately, with the reason in
    the comment beside it.
41. **A fixture string in `invariants.test.mjs` said `matched TODO`**, which the marker
    enumeration grep found. Renamed to `matched the marker`; the one place a test needs
    the literal token now holds it in a named constant, so the grep reads it as the
    fixture's.
42. **Two markers were left in place because their files are frozen**:
    `fixtures/notesvc-seeded/README.md` and `fixtures/notesvc-seeded/defects/README.md`.
    Both describe work step 4 completed, both sit inside the frozen fixture, and both are
    hashed into the instrument digest, so editing them would move a digest the recon
    records already carry. Owning artifact: the freeze itself.

## What the artifacts got right

Worth recording, because a register that only lists gaps reads as though the documents
were useless.

- **The types carried the rulings.** `CaseSpec.contrasts`, the two-kind `GraderGroup`
  union and `Contrast.floorParts` each removed a decision from the implementation
  entirely. The `#` in the direction key is the clearest case: the rule "a groups case
  carries no case-level direction" fell out of parsing rather than having to be enforced.
- **The nulls-carry-meaning rule in `2-interfaces.md`** made "excluded, not scored zero"
  a property of the arithmetic rather than something to remember.
- **`4-recon.md` priced everything it settled.** The judge prompt, the trace's shape, the
  argv, the caps and the run costs were all read off it rather than guessed.
- **The frozen instrument matched the generator on the first try.** Twelve `reported-*`
  graders, written at step 4 by an isolated author, are byte for byte what
  `graderFilesFor` produces from the ledger. Nothing had to be adjusted to make that true.
- **The fence check earned its place immediately.** Run over the two real recon traces, it
  flagged the placebo with-arm run that `find /` had listed the shipped skill in — the run
  `4-recon.md` describes — and counted it rather than dropping it, which is what gate 4
  ruled.

## Corrections made to earlier artifacts

`1-types.md` and `2-interfaces.md` are amended, and each says what changed at the bottom
of the document: four fields added to two types (entries 3, 7, 22), and four signatures
whose declared shape did not survive contact with the handles they were given (entries 2,
11, 14, 15). Nothing else in either document moved, and no gate re-opens: every change is
additive or a narrowing that the plan already implies.

## Owner's review at gate 6

Verified in the worktree before the gate: 505 tests green, no drift in either suite, the
`--suite` path documented, the merge refused first by the missing `run-oneliner` sweep,
and zero diff on every frozen artifact. The human read the six blocking entries and said
proceed.

Three things the build left, fixed by the owner after the gate and before the commit:
the two fixture READMEs still carried step-3 markers, one of them the whole body of
`fixtures/notesvc-seeded/README.md`. Both READMEs are now written. The ledger README's
acceptance list is copied from the rule table in `ledger.mjs`, not from memory: the
fourth rule is that `detect.sh` *still fires* after the reference implementation, which
is the opposite of what a first draft said. Neither file ships to the sandbox; the
fixture's digest is re-baselined by the step-7 confirmation runs.
