/**
 * Data structures for skill eval suites run against `claude plugin eval`.
 *
 * JSDoc rather than TypeScript because the suites are zero-dependency by design:
 * these check in an editor and under `npx tsc --noEmit --checkJs` without adding
 * a build step or a package to install.
 *
 * Nothing here names a particular skill. A suite lives at `evals/<skill>/` and
 * supplies its own arms, cases and pre-registration; this file is shared.
 *
 * Three shapes encode rules from `docs/plans/primer-evals/0-plan.md` in the type
 * system rather than in prose, because prose does not fail:
 *   - delta and capability evidence are separate arrays, so they cannot be averaged
 *   - expected direction is a sign, never a number, so it cannot be typeset as a result
 *   - baseline scores stay a list, so the free noise-floor estimate is not averaged away
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
 * Ours — arms
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The arms a suite builds and swaps into `_arm/`.
 *
 * `treatment` is the skill under test. The other two are controls, each stripping
 * a confound the treatment would otherwise be credited with: `oneliner` removes
 * gating-as-an-idea, `placebo` removes same-shape-scaffolding.
 *
 * `none` is deliberately absent from this union. It is not an arm we author: it
 * arrives free as the harness's own `without` column inside every pass, which is
 * why {@link MergedCaseRow.baselineScores} is a list rather than a fourth entry
 * in {@link MergedCaseRow.armScores}.
 *
 * @typedef {'treatment'|'oneliner'|'placebo'} ArmId
 */

/**
 * @typedef {object} Arm
 * @property {ArmId}   id
 * @property {'treatment'|'control'} role
 * @property {'generated'|'authored'} provenance
 * @property {string}  sourcePath      evals/<skill>/arms/<id>/
 * @property {string|null} generatedFrom  source SKILL.md for a generated arm; null otherwise.
 *                                        Non-null is what `drift-check` verifies.
 * @property {string}  controlsFor     the confound this arm removes; '' for the treatment
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — cases and the pre-registration
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What a case's number is allowed to mean.
 *
 * `delta`      — ran with-without; the number is a contrast against a control.
 * `capability` — ran `--ablation none` because a `history_file` replay carries the
 *                plugin into both arms. The number has no referent outside itself:
 *                0.65 against nothing is not evidence, only description.
 *
 * These are never averaged together, never summed into one headline, and never
 * put in one table without a visible split. {@link MergedReport} keeps them in
 * two arrays so that doing so requires deliberately concatenating them.
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
 * Expected direction of a contrast — a SIGN, never a predicted score.
 *
 * The type is this narrow on purpose. A predicted number rendered beside a
 * measured one gets read as a measurement, screenshotted, and quoted; the fix is
 * that no field exists which could hold one.
 *
 *   `+1` the treatment should beat this control
 *   ` 0` no difference expected — an anti-ceremony guardrail case, where a delta
 *        near zero is the pass condition and a positive delta is a failure
 *   `-1` the treatment should lose
 *
 * @typedef {-1|0|1} ExpectedDirection
 */

/**
 * Committed before a suite's first full pass and never edited afterwards
 * (`0-plan.md` D6).
 *
 * @typedef {object} PreRegistration
 * @property {ArmId[]}    arms
 * @property {CaseSpec[]} cases
 * @property {Record<string, ExpectedDirection>} expectedDirection  keyed `<case>/<control>`
 * @property {number}     threshold      set explicitly; the harness default of 1.0 is
 *                                       unreachable with `llm` graders and would always exit 1
 * @property {string}     subjectModel   pinned so a model rollout never reads as a regression
 * @property {string}     judgeModel     pinned, and not the subject model
 * @property {number}     runsPerCase
 * @property {true}       publishAllArms literal `true`: the undertaking to publish the
 *                                       placebo and one-liner columns whatever they show
 *                                       is not a toggle, so the type admits no other value
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — merged results
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} Contrast
 * @property {ArmId}             treatment
 * @property {ArmId|'none'}      control
 * @property {number}            value      treatmentScore - controlScore
 * @property {ExpectedDirection} expected   from the pre-registration, not from the result
 */

/**
 * @typedef {object} MergedCaseRow
 * @property {string}       case
 * @property {EvidenceKind} evidence
 * @property {Record<ArmId, number|null>} armScores      null where the arm did not run
 * @property {Record<ArmId, number[]>}    armRunScores   every run, so per-case scatter is
 *                                                       reportable and means never travel alone
 * @property {number[]} baselineScores   the `without` column from EACH pass, kept apart on
 *                                       purpose. One stock-Claude column per pass against
 *                                       identical cases: their spread IS the noise floor,
 *                                       measured for free. Averaging them destroys the only
 *                                       variance estimate the design gets without extra runs.
 * @property {Contrast[]} contrasts      empty when evidence === 'capability'
 * @property {string[]}   advisories
 */

/**
 * @typedef {object} Provenance
 * @property {string} suiteSha            git sha of the suite at run time
 * @property {string} preRegistrationSha  sha of the suite's PRE-REGISTRATION.md; a mismatch
 *                                        against the committed file makes the numbers unfalsifiable
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
 *                                              not a filter over one list, so the split
 *                                              survives careless reporting
 * @property {number}          baselineSpread   max - min across the per-pass baseline columns
 * @property {boolean}         partial          true if any pass was partial; such a report
 *                                              must not be compared against a complete one
 * @property {string[]}        advisories
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Ours — grader self-tests and paths
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * One authored grader regex plus the text that proves it discriminates.
 * A regex that matches everything passes every case and is the most likely way
 * this suite lies to us, so `mustNotMatch` is not optional.
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
 * @property {string} armsDir       <suiteDir>/arms
 * @property {string} armUnderTest  <suiteDir>/_arm — a COPY of the selected arm, never a
 *                                  symlink: the harness's plugin ownership check rejects a
 *                                  path that "is a symlink (or can be read as a link)"
 * @property {string} resultsDir    <suiteDir>/results
 */

export {};
