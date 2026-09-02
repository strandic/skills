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
 * Rationale: `docs/plans/primer-evals/1-types.md`.
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
 * @typedef {'treatment'|'oneliner'|'placebo'} ConditionId
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
 * @property {string[]}     tags       `control` marks the diagnostic, excluded from scored runs
 * @property {boolean}      scored
 * @property {string}       measures   one line, for the report; not a grader
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
 * @property {number}     threshold      set explicitly; the harness default of 1.0 is
 *                                       unreachable with `llm` graders and would always exit 1
 * @property {string}     subjectModel   pinned so a model rollout never reads as a regression
 * @property {string}     judgeModel     pinned, and not the subject model
 * @property {number}     runsPerCase
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
 *                                        cases, graders, transcripts, fixture and every
 *                                        condition's SKILL.md. Sweeps that disagree were
 *                                        measured with different instruments and are
 *                                        unmergeable (I2b)
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
 * @property {string}  instrumentSha  `instrumentDigest(suiteDir)` at check time, the same value
 *                                    every sweep record of this invocation carries. Without it
 *                                    a control-only re-run resets `drifted:false` for a
 *                                    treatment measured on an older instrument and I2 cannot
 *                                    see it (I2b)
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
 * @property {Contrast[]} contrasts      empty when evidence === 'capability'
 * @property {string[]}   advisories
 */

/**
 * @typedef {object} Provenance
 * @property {string} suiteSha            git sha of the suite at run time
 * @property {string} preRegistrationSha  sha of the suite's PRE-REGISTRATION.md; a mismatch
 *                                        against the committed file voids the run
 * @property {string} instrumentSha       `instrumentDigest(suiteDir)` — every case, grader,
 *                                        transcript, fixture and condition that produced
 *                                        these numbers, as one sha256. Taken from the sweep
 *                                        records once they agree; '' when they do not, or
 *                                        when any of them predates the digest. I2b refuses
 *                                        a report whose sweeps, drift record and suite on
 *                                        disk do not all name the same instrument. It is an
 *                                        instrument-agreement guard, not a staleness guard:
 *                                        it compares digests, never `startedAt`, so sweeps
 *                                        taken weeks apart on an unchanged instrument merge
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
