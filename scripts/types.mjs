/**
 * Data structures for skill eval suites run against `claude plugin eval`.
 *
 * JSDoc rather than TypeScript because the suites are zero-dependency by design:
 * these check in an editor and under `npx tsc --noEmit --checkJs` without adding
 * a build step or a package to install.
 *
 * Nothing here names a particular skill. A suite lives at `evals/<skill>/` and
 * supplies its own conditions, cases and pre-registration; this file is shared.
 *
 * Rationale: `docs/plans/primer-evals/1-types.md`; the grader-group, declared-evidence
 * and defect-ledger shapes: `docs/plans/primer-evals/defect-injection/1-types.md`.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * External — owned by `claude plugin eval`, not by us.
 * Only the subset the merger reads. aggregate-result.json, schemaVersion 1;
 * an additive-only contract, so unknown fields must be tolerated, never asserted.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} HarnessGraderResult
 * @property {string}    name
 * @property {boolean}   passed
 * @property {number}    weight
 * @property {string}    explanation
 * @property {boolean}   withOnly   true = demoted to a plugin-fired indicator, excluded
 *                                  from the score denominator in both arms
 * @property {boolean}   scored     always !withOnly
 * @property {boolean[]} [judgeVotes]  3 votes, strict majority, `llm`/`baseline` only
 * @property {string}    [evidence]    what the judge was shown, `llm`/`baseline` only.
 *                                     The real documents carry it and the typedef omitted
 *                                     it; the hand-labelling of judge verdicts reads it,
 *                                     so it is declared here rather than reached through
 *                                     an untyped property
 */

/**
 * @typedef {object} HarnessRun
 * @property {number}  score               weighted fraction of SCORED graders that passed
 * @property {boolean} passed              score === 1.0
 * @property {number}  turns
 * @property {number}  costUsd             API-equivalent estimate, not a charge
 * @property {number}  judgeCostUsd
 * @property {string|null} error           non-null does NOT imply score 0: a timed-out or
 *                                         turn-capped run is still graded on what it produced
 * @property {boolean} skippedPaidGraders  when true the arms are not comparable and Δ is omitted
 * @property {HarnessGraderResult[]} graders
 */

/**
 * @typedef {object} HarnessCaseAggregates
 * @property {number}  score
 * @property {number}  passRate
 * @property {number} [scoreWithout]
 * @property {number} [passRateWithout]
 * @property {number} [delta]   absent under `--ablation none`, and absent whenever
 *                              either arm skipped paid graders
 */

/**
 * @typedef {object} HarnessCase
 * @property {string} name
 * @property {string} dir
 * @property {{ with: HarnessRun[], without?: HarnessRun[] }} arms
 * @property {HarnessCaseAggregates} aggregates
 * @property {string[]} [advisories]   e.g. "grader X cannot pass with the granted tools"
 */

/**
 * @typedef {object} HarnessDocument
 * @property {1}       schemaVersion
 * @property {string}  claudeVersion
 * @property {string}  startedAt
 * @property {number}  costUsd
 * @property {boolean} partial
 * @property {'cost_ceiling'|'interrupted'|'auth_failed'} [partialReason]
 * @property {{ ablation: 'none'|'with-without', threshold: number,
 *              modelOverride?: string, judgeModel?: string }} suite
 * @property {HarnessCase[]} cases
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — conditions
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Which instruction text is loaded when a case runs. Prompt, fixture and graders
 * are identical across all of them; the condition is the only thing that varies.
 *
 * `none` is absent by design: it is not a condition we author, it arrives as the
 * harness's own `without` column inside every sweep — hence
 * {@link MergedCaseRow.baselineScores} rather than a fourth entry in
 * `conditionScores`.
 *
 * A registered condition's id: the name of its directory under `conditions/`. The
 * pre-registration's `conditions` list is the registry — `treatment`, `oneliner` and
 * `placebo` are the three the suite shipped with, and an amendment may add more.
 * `none` is reserved for the harness's without-arm and can never be one.
 *
 * @typedef {string} ConditionId
 */

/**
 * @typedef {object} Condition
 * @property {ConditionId} id
 * @property {'treatment'|'control'} role
 * @property {'generated'|'authored'} provenance
 * @property {string}  sourcePath      evals/<skill>/conditions/<id>/
 * @property {string|null} generatedFrom  source SKILL.md for a generated condition; null otherwise.
 *                                        Non-null is what `drift-check` verifies.
 * @property {string}  controlsFor     the confound this condition removes; '' for the treatment
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — cases and the pre-registration
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What a case's number is allowed to mean.
 *
 * `delta`      — ran with-without; the number is a contrast against a control.
 * `capability` — ran `--ablation none`; the number has no referent outside itself.
 *
 * Never averaged together. {@link MergedReport} keeps them in two arrays.
 *
 * @typedef {'delta'|'capability'} EvidenceKind
 */

/**
 * @typedef {object} CaseSpec
 * @property {string}       name
 * @property {EvidenceKind} evidence
 * @property {'none'|'with-without'} ablation
 * @property {boolean}      [declared]  true when `evidence` and `ablation` came from the
 *                                      case's own frontmatter rather than from the
 *                                      `history_file` derivation. The derivation stays the
 *                                      default: a replay case is `capability`/`none`
 *                                      because its transcript carries the plugin into
 *                                      both arms. A replay case may be `delta`/
 *                                      `with-without` only when declared, and the two
 *                                      pairs the registration refuses (`delta`+`none`,
 *                                      `capability`+`with-without`) stay refused either
 *                                      way. Absent means not declared
 * @property {string[]}     tags       `control` marks the diagnostic, excluded from scored runs
 * @property {boolean}      scored
 * @property {string}       measures   one line, for the report; not a grader
 * @property {GraderGroup[]} [groups]   named subsets of this case's graders, each scored
 *                                      and contrasted on its own from the per-grader
 *                                      verdicts the sweep record holds. Absent means the
 *                                      case has no groups and only its harness score is
 *                                      read
 * @property {'case'|'groups'} [contrasts]  which score carries the registered contrasts.
 *                                      `case` (the default): the harness score, keyed
 *                                      `<case>/<control>`. `groups`: each group in
 *                                      `groups`, keyed `<case>#<group>/<control>`, and
 *                                      the case-level pair is registered as carrying no
 *                                      contrast — the merger reads this before it builds
 *                                      the control list, so it neither computes nor
 *                                      throws on the case-level pair, and the harness
 *                                      score is printed alone
 */

/**
 * A group scored from a fixed list of grader names. Per run, the score is the weighted
 * fraction of the named graders that passed, over the named graders that were scored,
 * with the harness's own `withOnly` exclusion. A run in which no named grader was
 * scored has no score for the group, not zero.
 *
 * @typedef {object} GradersGroup
 * @property {'graders'} kind
 * @property {string}    name       unique within the case; used in direction keys
 * @property {string[]}  graders    grader names as the harness reports them; every name
 *                                  must exist on the case, and a name may appear in more
 *                                  than one group
 */

/**
 * A group scored as the per-run difference of two other groups on the same run: the
 * `minuend` score minus the `subtrahend` score. A run missing either has no score.
 * This is how a registered "advantage on A over and above any advantage on B" is
 * computed on the same runs rather than read off two tables after the fact.
 *
 * @typedef {object} DifferenceGroup
 * @property {'difference'} kind
 * @property {string} name
 * @property {string} minuend      the name of a `GradersGroup` on the same case
 * @property {string} subtrahend   likewise; never the same as `minuend`
 */

/**
 * @typedef {GradersGroup|DifferenceGroup} GraderGroup
 */

/**
 * Expected direction of a contrast — a sign, never a predicted score.
 *
 *   `+1` the treatment should beat this control
 *   ` 0` no difference expected; a positive delta is then a failure, not a bonus
 *   `-1` the treatment should lose
 *
 * @typedef {-1|0|1} ExpectedDirection
 */

/**
 * Committed before a suite's first full sweep and never edited afterwards
 * (`0-plan.md` D6).
 *
 * @typedef {object} PreRegistration
 * @property {ConditionId[]} conditions
 * @property {CaseSpec[]} cases
 * @property {Record<string, ExpectedDirection>} expectedDirection  keyed `<case>/<control>`
 *                                       for a case whose `contrasts` is `case`, and
 *                                       `<case>#<group>/<control>` for every group of a
 *                                       case whose `contrasts` is `groups`. `#` cannot
 *                                       appear in a case or group name, so the key splits
 *                                       without ambiguity. Completeness is per key kind:
 *                                       every registered group of a scored delta case
 *                                       needs a direction against every control
 * @property {number}     threshold      set explicitly; the harness default of 1.0 is
 *                                       unreachable with `llm` graders and would always exit 1
 * @property {string}     subjectModel   pinned so a model rollout never reads as a regression
 * @property {string}     judgeModel     pinned, and not the subject model
 * @property {number}     runsPerCase
 * @property {number}     [floorErrorMultiplier]  how many standard errors of a contrast the
 *                                       second floor component is. Registered rather than
 *                                       chosen at merge time, and checked against
 *                                       `FLOOR_ERROR_MULTIPLIER` when the merge runs.
 *                                       Required of a registration that carries a groups
 *                                       case, absent from one that does not
 * @property {string}     claudeVersion  the CLI version the predictions were made against;
 *                                       I2 voids a run whose report disagrees
 * @property {true}       publishAllConditions literal `true` — the undertaking to publish
 *                                       every condition whatever it shows is not a toggle
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — invocation
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * One sweep of `claude plugin eval` — everything that varies between sweeps.
 * `condition` is not a CLI flag: it selects the directory copied into `_condition/`
 * before the process starts, since the harness discovers the plugin from the path.
 *
 * @typedef {object} EvalInvocation
 * @property {ConditionId} condition
 * @property {string}   suiteDir
 * @property {'none'|'with-without'} ablation
 * @property {number}   runs
 * @property {string}   subjectModel
 * @property {string}   judgeModel
 * @property {string[]} allowTools    absence graders are vacuous without the mutation
 *                                    tools granted here — the run must be *able* to edit
 * @property {number}   threshold     never left to default: 1.0 is unreachable with `llm`
 *                                    graders, so CI would always exit 1
 * @property {string[]} caseGlobs
 * @property {string[]} tagFilters
 * @property {boolean}  scaffold
 * @property {string}   outputDir
 * @property {number}   [maxCostUsd]  `--max-cost-usd`, a ceiling PER INVOCATION. When it
 *                                    trips the harness marks the document partial and
 *                                    exits 2, the runner stops the sweep, and I1c refuses
 *                                    the short record — so it is a runaway guard set well
 *                                    above the invocation's expected spend (runs × arms ×
 *                                    the measured per-run cost, doubled), never a budget.
 *                                    Absent means no ceiling, which is what every Tier 1
 *                                    sweep ran with
 * @property {boolean}  [keepTemp]    `--keep-temp`: keep every run's sandbox (workspace and
 *                                    `out/trace.jsonl`) and print its path. Without it only
 *                                    errored runs are kept. A regex grader over the trace
 *                                    leaves no `evidence` in the record, so a suite that
 *                                    grades the trace keeps the sandboxes. Absent means off
 */

/**
 * What one sweep yields once the process has exited.
 *
 * @typedef {object} SweepResult
 * @property {ConditionId} condition
 * @property {number} exitCode   0 all cases at/above threshold · 1 below threshold, a case
 *                               failed to load, or bad options · 2 partial (cost ceiling or
 *                               auth) · 127 the executable could not be spawned · 128 + the
 *                               signal number for ANY signalled death (130 SIGINT, 143
 *                               SIGTERM, 137 SIGKILL, 129 SIGHUP). Everything ≥ 128 is an
 *                               interruption, never a result: mapping an unnamed signal to 1
 *                               reported a killed sweep as "a case scored below threshold"
 * @property {HarnessDocument|null} document  null when the sweep produced no document at all
 * @property {string} stderrTail  case-load errors and notices; stdout is the JSON document
 */

/**
 * What one sweep persists to `results/<condition>.json`, and what the merger reads
 * back. The sweep→merge handoff was diagrammed but never specified, so this fixes it:
 * the runner writes the harness document under `document`, plus what only the runner
 * knows.
 *
 * `document` is verbatim only when the sweep made ONE harness invocation. A sweep splits
 * into one invocation per distinct case ablation, and the parts are then combined
 * (`combineHarnessDocuments`): the `cases` arrays concatenate, `costUsd` sums,
 * `startedAt` is the earliest and `durationSeconds` the total, `partial` is three-valued,
 * `suite.ablation` can only name the first part's, and `aggregates` is DELETED rather
 * than left describing one part beside a `cases` array from both.
 *
 * @typedef {object} SweepRecord
 * @property {ConditionId}     condition
 * @property {number}          exitCode
 * @property {HarnessDocument} document
 * @property {string}          stderrTail
 * @property {string[][]}      argvs      every harness invocation this sweep made, in order,
 *                                        so a reader can re-run each of them exactly. A sweep
 *                                        is one invocation per distinct case ablation, so a
 *                                        case registered `ablation: none` cannot be run
 *                                        with-without by sharing a command line with one
 * @property {Record<string,'none'|'with-without'>} ablations  case name → the ablation that
 *                                        case was actually run at. Exactly that shape: one key
 *                                        per case name the sweep asked for, and a value that is
 *                                        the string 'none' or the string 'with-without' and
 *                                        nothing else (`buildSweepRecord` refuses anything
 *                                        else). The combined `document.suite.ablation` can only
 *                                        name one ablation, so this is the only per-case record
 *                                        of the split — and the merger READS it, checking each
 *                                        case's entry against the `ablation` PRE-REGISTRATION
 *                                        registers. That check is what turns "a case registered
 *                                        `none` must not run with-without" from an intention
 *                                        into something a merge can refuse
 * @property {string}          startedAt
 * @property {string}          instrumentSha  `instrumentDigest(suiteDir)` at sweep time — the
 *                                        SHARED instrument: cases, graders, transcripts and
 *                                        fixture, no condition. Sweeps that disagree were
 *                                        measured with different instruments and are
 *                                        unmergeable (I2b)
 * @property {string}          conditionSha   `conditionDigest(suiteDir, condition)` at sweep
 *                                        time — this condition's own directory, the half of
 *                                        the instrument only this sweep measured against.
 *                                        Compared against the tree for this condition alone,
 *                                        so editing one condition voids one sweep (I2b)
 */

/**
 * Written by the runner to `results/drift.json` before any sweep. The merger requires
 * it and treats its ABSENCE as drift, so a run that skipped the check cannot quietly
 * produce a report.
 *
 * @typedef {object} DriftRecord
 * @property {boolean} drifted
 * @property {string}  reason
 * @property {string}  checkedAt
 * @property {string}  instrumentSha  `instrumentDigest(suiteDir)` at check time — the shared
 *                                    half, the same value every sweep record of this
 *                                    invocation carries. It ties the drift verdict to the
 *                                    cases and graders it was taken beside; a stale treatment
 *                                    mirror itself is caught by that record's `conditionSha`
 *                                    (I2b)
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — merged results
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} Contrast
 * @property {ConditionId}       treatment
 * @property {ConditionId|'none'} control
 * @property {number}            value      treatmentScore - controlScore
 * @property {ExpectedDirection} expected   from the pre-registration, not from the result
 * @property {boolean} [belowNoiseFloor]  set when |value| <= baselineSpread + NOISE_EPSILON.
 *                                        `<=`, not `<`: a contrast that TIES the floor is
 *                                        inside it, since the floor is the smallest
 *                                        difference the instrument resolves. The epsilon is
 *                                        there because the two quantities are means of the
 *                                        same fifteenths summed in different orders, so a
 *                                        mathematical tie lands one ulp either side.
 *                                        Such a contrast is published, never suppressed —
 *                                        but it must carry this mark (I1b)
 * @property {string}  [group]     the group this contrast belongs to, for a case whose
 *                                 `contrasts` is `groups`. Absent on a case-level contrast
 * @property {number}  [floor]     the floor THIS contrast was judged against, when it is
 *                                 not the report-wide `baselineSpread`: the larger of
 *                                 `floorParts.noneRange` and `floorParts.errorBound`.
 *                                 `belowNoiseFloor` is then |value| <= floor + epsilon.
  *                                 A floor at or below NOISE_EPSILON is not a measurement
 *                                 (identical runs give 2e-16, never 0): such a contrast
 *                                 is withheld and its group marked unmeasurable
 * @property {{ noneRange: number, errorBound: number, pooledSd: number,
 *              treatmentRuns: number, controlRuns: number }} [floorParts]
 *                                 how `floor` was built, kept so a reader can check it.
 *                                 `noneRange`: max − min of the per-sweep `none` means of
 *                                 this group (Tier 1's rule). `errorBound`: 2 × pooledSd ×
 *                                 sqrt(1/treatmentRuns + 1/controlRuns), with `pooledSd`
 *                                 the standard deviation of the group's per-run scores
 *                                 pooled over the two cells entering this contrast, and
 *                                 `controlRuns` the three without-arm columns together
 *                                 when the control is `none`. The multiplier 2 is fixed
 *                                 by the registration, not chosen here
 */

/**
 * @typedef {object} MergedCaseRow
 * @property {string}       case
 * @property {EvidenceKind} evidence
 * @property {Record<ConditionId, number|null>} conditionScores    null where it did not run
 * @property {Record<ConditionId, number[]>}    conditionRunScores every run; scatter is
 *                                                       only if these survive
 * @property {number[]} baselineScores   the `without` column from EACH sweep, kept apart:
 *                                       their spread is the suite's noise floor
 * @property {Contrast[]} contrasts      empty when evidence === 'capability', and empty
 *                                       when the case's `contrasts` is `groups`
 * @property {string[]}   advisories
 * @property {Record<string, Record<ConditionId, number|null>>} [groupScores]
 *                                       group name → condition → mean of that group's
 *                                       per-run scores in the with-arm; null where the
 *                                       case did not run or no run scored the group
 * @property {Record<string, Record<ConditionId, number[]>>} [groupRunScores]
 *                                       group name → condition → every scored run, kept
 *                                       for the scatter; a run with no group score is
 *                                       omitted, never written as 0
 * @property {Record<string, number[]>}   [groupBaselineScores]
 *                                       group name → the group's `none` mean from EACH
 *                                       sweep, kept apart: their range is the first floor
 *                                       component
 * @property {Record<string, number[][]>} [groupBaselineRunScores]
 *                                       group name → per sweep, every without-arm run's
 *                                       group score. The second floor component pools
 *                                       these, so a mean alone would not do
 * @property {Record<string, Contrast[]>} [groupContrasts]
 *                                       group name → its contrasts, each carrying its own
 *                                       `floor`. Present exactly when the case's
 *                                       `contrasts` is `groups`
 * @property {Record<ConditionId, ArmCounts>} [runCounts]
 *                                       runs actually present per condition and arm — a
 *                                       registered reported figure, printed beside the
 *                                       group scores, because the header's `runsPerCase`
 *                                       is the registered lower bound and not the count
 * @property {Record<ConditionId, ArmCounts>} [errorCounts]
 *                                       runs with a non-null `error` (timed out, turn-
 *                                       capped) per condition and arm. On a presence-
 *                                       graded case such a run scores near zero and reads
 *                                       as "found nothing", so the count is published
 *                                       rather than hidden in the mean
 * @property {Record<ConditionId, ArmCounts>} [excludedCounts]
 *                                       runs left out of every group score because their
 *                                       paid graders were skipped by a cost ceiling. Never
 *                                       scored as zero
 * @property {Record<ConditionId, ArmCounts>} [refusedCounts]
 *                                       runs whose kept trace named a fence fragment (I9's
 *                                       second half), per condition and arm. Ruled at gate
 *                                       4: such a run is counted and flagged, never
 *                                       dropped, so this is a published figure and not a
 *                                       filter. A run whose trace could not be read
 *                                       produces no count, which I12 refuses
 * @property {string[]} [unmeasurableGroups]
 *                                       the groups whose floor came out at or below
 *                                       NOISE_EPSILON. Their contrasts are withheld and the
 *                                       report prints the word rather than a number (I11)
 * @property {Record<string, Record<ConditionId, number|null>>} [manipulationChecks]
 *                                       grader name → condition → the fraction of scored
 *                                       with-arm runs that passed it, for every grader the
 *                                       case scored that no registered group names. These
 *                                       are reported with their numbers and no held-or-
 *                                       failed verdict (D4)
 */

/**
 * A count per arm. `without` is absent for a case that ran single-arm.
 *
 * @typedef {object} ArmCounts
 * @property {number} with
 * @property {number} [without]
 */

/**
 * @typedef {object} Provenance
 * @property {string} suiteSha            git sha of the suite at run time
 * @property {string} preRegistrationSha  sha of the suite's PRE-REGISTRATION.md; a mismatch
 *                                        against the committed file voids the run
 * @property {string} instrumentSha       `instrumentDigest(suiteDir)` — every case, grader,
 *                                        transcript and fixture that produced these numbers,
 *                                        as one sha256 (the conditions are digested apart,
 *                                        see `conditionShas`). Taken from the sweep
 *                                        records once they agree; '' when they do not, or
 *                                        when any of them predates the digest. I2b refuses
 *                                        a report whose sweeps, drift record and suite on
 *                                        disk do not all name the same instrument. It is an
 *                                        instrument-agreement guard, not a staleness guard:
 *                                        it compares digests, never `startedAt`, so sweeps
 *                                        taken weeks apart on an unchanged instrument merge
 * @property {Record<ConditionId, string>} [conditionShas]  each sweep's `conditionSha`
 *                                        under its condition id, '' where the record
 *                                        predates it. Never expected to agree across
 *                                        conditions; I2b checks each against the tree
 * @property {string} claudeVersion
 * @property {string} subjectModel
 * @property {string} judgeModel
 * @property {string} startedAt
 * @property {number} runsPerCase
 * @property {number} costUsdEstimate     API-equivalent, not a charge, under subscription
 *                                        auth; the real budget is then rate-limit windows
 */

/**
 * @typedef {object} MergedReport
 * @property {Provenance}      provenance
 * @property {MergedCaseRow[]} deltaRows        evidence === 'delta'
 * @property {MergedCaseRow[]} capabilityRows   evidence === 'capability' — a separate array,
 *                                              not a filter, so the split survives reporting
 * @property {number}          baselineSpread   max - min across the per-sweep baseline columns
 *                                              of the DELTA rows only, worst case wins. A
 *                                              capability row's without-arm is a second
 *                                              measurement of the same thing, so its spread
 *                                              is noise about nothing (`noiseFloorOf`)
 * @property {boolean}         partial          true if any sweep was partial; such a report
 *                                              must not be compared against a complete one
 * @property {string[]}        advisories
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — the defect ledger
 * A seeded fixture carries planted defects; each one is described here so the
 * acceptance checks, the vocabulary check and the report can read it. The ledger lives
 * beside the fixture, is withheld from the scaffold copy, and is hashed into the
 * instrument digest.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What kind of defect a planted one turned out to be. Never the designer's intent: the
 * class is set by the reviewer tally and nothing else.
 *
 * `run-only`      — named by no read-only reviewer; shows when the service is run.
 * `read-visible`  — named by two or more read-only reviewers.
 *
 * A defect named by exactly one reviewer has no class: it is dropped and replaced.
 *
 * @typedef {'run-only'|'read-visible'} DefectClass
 */

/**
 * How many independent read-only reviewers named a defect, out of how many looked.
 * `of` travels with `named` so a tally is never read against an assumed panel size.
 *
 * @typedef {object} ReviewTally
 * @property {number} named
 * @property {number} of
 */

/**
 * One planted defect, as the ledger records it. File contents are not inlined: each
 * entry names its files under `fixtures/<seeded>/defects/<id>/`, and the digest covers
 * them.
 *
 * @typedef {object} DefectSpec
 * @property {string}      id
 * @property {DefectClass} intendedClass   what the designer meant to plant; recorded, not used
 * @property {DefectClass} class           set by `tallyAlone`, mechanically
 * @property {ReviewTally} tallyAlone      reviewed as the only defect in an otherwise clean
 *                                         fixture — the classification
 * @property {ReviewTally} tallyInCompany  reviewed with every other accepted defect present,
 *                                         which is the fixture the sweep runs. A read-visible
 *                                         defect nobody names in company is reported as such
 * @property {string}      signature       the runtime signal the `surfaced-*` grader matches:
 *                                         letters, digits, spaces, hyphens, underscores; at
 *                                         least six characters; not a bare status code; not a
 *                                         literal in any shipped source file
 * @property {string}      neighbour       id of the nearest other defect in the same part of
 *                                         the service; its observable-only probe reply must
 *                                         FAIL this defect's criterion
 * @property {string[]}    graders         the grader names on the case that score this defect
 *                                         (`reported-<id>`, and `surfaced-<id>` for run-only)
 * @property {Record<'designer'|'criteriaAuthor'|'reviewers', string>} transcriptDigests
 *                                         sha256 of each authoring transcript, so the
 *                                         isolation check has something to check against
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — grader self-tests and paths
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * One authored grader regex plus the text that proves it discriminates.
 * `mustNotMatch` is not optional: a regex that matches everything passes every
 * case while measuring nothing.
 *
 * @typedef {object} GraderProbe
 * @property {string}   graderId      `<case>/graders/<file>`
 * @property {string}   pattern
 * @property {string}   flags         only `d g i m s u v y`; inline `(?i)` is rejected
 * @property {string[]} mustMatch
 * @property {string[]} mustNotMatch
 */

/**
 * Built per suite. The runner used to hold one instance for one suite; a second suite
 * beside the first is a second instance of this shape and nothing else changes in it.
 * `resultsDir` is where that suite's own `drift.json` lives too — one drift record cannot
 * vouch for two suites with different instrument digests.
 *
 * @typedef {object} SuitePaths
 * @property {string} repoRoot
 * @property {string} suiteDir      evals/<skill>
 * @property {string} conditionsDir <suiteDir>/conditions
 * @property {string} conditionUnderTest  <suiteDir>/_condition — a COPY, never a
 *                                  symlink: the harness's plugin ownership check rejects a
 *                                  path that "is a symlink (or can be read as a link)"
 * @property {string} resultsDir    <suiteDir>/results
 */

export {};
