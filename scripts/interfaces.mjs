/**
 * Function signatures for the skill eval suite.
 *
 * `@callback` declarations rather than stubs: a signature here carries a name,
 * its parameters and its return type, and has no body at all — nothing to mistake
 * for an implementation, nothing that runs. Types come from `./types.mjs`.
 *
 * The split: everything that decides something is pure; everything that touches
 * the world takes a named runtime handle first. Each handle names who builds the
 * real instance — three could not be named at step 2 of the first feature and were
 * marked OPEN SEAM until recon resolved them. The second feature's seams are marked
 * the same way and listed in its own step-2 document.
 *
 * Rationale and call-flow diagrams: `docs/plans/primer-evals/2-interfaces.md`; the
 * grader-group, suite, ledger and isolation signatures:
 * `docs/plans/primer-evals/defect-injection/2-interfaces.md`.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Runtime handles — resources a signature RECEIVES rather than constructs.
 *
 * Real instances are wired once, at each script's entry point, and nowhere else.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback ReadTextFile
 * @param {string} path
 * @returns {Promise<string>}
 *
 * Real instance: `node:fs/promises` `readFile(path, 'utf8')`.
 */

/**
 * @callback WriteTextFile
 * @param {string} path
 * @param {string} contents
 * @returns {Promise<void>}
 *
 * Real instance: `node:fs/promises` `writeFile(path, contents, 'utf8')`, with
 * `mkdir(dirname, {recursive:true})` first.
 */

/**
 * @callback CopyDirectory
 * @param {string} from
 * @param {string} to
 * @returns {Promise<void>}
 *
 * Real instance: `node:fs/promises` `cp(from, to, {recursive:true, force:true})`.
 *
 * Must genuinely copy: the harness's plugin ownership check rejects a path that
 * "is a symlink (or can be read as a link)".
 */

/**
 * @callback SpawnCapture
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string,string>} env
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 *
 * Real instance: `node:child_process` `spawn`, stdout collected to a string.
 * Buffers rather than streams; the child may emit up to 64 MiB under `--json`.
 */

/**
 * @callback Clock
 * @returns {string} ISO-8601 timestamp
 *
 * Real instance: `() => new Date().toISOString()`. A handle rather than a direct
 * call so a merged report is reproducible byte-for-byte in a test.
 */

/**
 * @callback RevParse
 * @param {string} ref
 * @returns {Promise<string>}
 *
 * Real instance: `git rev-parse <ref>` through {@link SpawnCapture}, wired at the
 * entry point so nothing below shells out on its own.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT HANDLES — all three were open seams at step 2 and were resolved by
 * observation in step 4. Each records the mechanism actually seen, not a plan.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback EvalCommand
 * @returns {{ command: string, env: Record<string,string> }}
 *
 * RESOLVED in recon: read the executable from `EVAL_CLAUDE_BIN` (default `claude`)
 * and always inject `CLAUDE_CODE_WALNUT_SPIRE=1`. Injecting unconditionally is safe
 * — on a flag-enabled account it is a no-op — and it keeps the committed script
 * working on machines that cannot receive the rollout. Never put the variable in the
 * repo's `.claude/settings.json`: project settings are untrusted before the
 * workspace trust step.
 */

/**
 * @callback ResultsSnapshot
 * @param {EvalInvocation} inv
 * @returns {Promise<string[]>} the NAMES of every `<eval-dir>/results/<ISO-timestamp>/`
 *   directory, sorted; `[]` when the suite has none
 *
 * RESOLVED in recon: with target `.` and `--eval-dir evals/<skill>`, the harness
 * writes `<eval-dir>/results/<ISO-timestamp>/aggregate-result.json` alongside
 * `report.html`. `--eval-dir` accepts a PATH, not only a bare directory name.
 *
 * REPLACES `ResultsLocator`, which handed back the newest timestamped path. Newest-wins
 * is only correct while this process is the sole writer: any other harness run against
 * the same eval dir during a sweep (the README's control-all-steps diagnostic, say)
 * produces a newer directory, and the sweep then claims somebody else's numbers with
 * everything still looking plausible. The caller takes this snapshot before and after
 * the spawn and compares the two SETS, so it can say exactly which directories the sweep
 * is responsible for — and how many. Exactly one is attributable; none or several is not.
 *
 * Only timestamp-shaped names count: `<condition>.json` and `drift.json` live in the
 * same folder.
 */

/**
 * @callback PreRegistrationDigest
 * @param {string} path
 * @returns {Promise<{ digest: string, dirty: boolean }>}   dirty travels WITH the
 *   digest: a caller that has to ask separately will eventually forget to
 *
 * RESOLVED in recon (policy call): content hash of the file as it stands, plus a
 * hard failure when `git status --porcelain` reports the pre-registration dirty. A
 * digest a reader cannot check out is worse than no digest, and a pre-registration
 * edited between sweeps is not a pre-registration.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * build-conditions — generating the treatment mirror
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback StripModelInvocation
 * @param {string} skillMarkdown
 * @returns {string}
 *
 * Pure. Removes the `disable-model-invocation` frontmatter line and nothing else,
 * so the condition under test is the shipped text rather than a paraphrase of it.
 */

/**
 * @callback DetectDrift
 * @param {string} generated
 * @param {string} committed
 * @returns {{ drifted: boolean, reason: string }}
 *
 * Pure. `reason` names the first divergence, or is empty. Drift means every
 * number after it describes a version that no longer exists.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * run-evals — one sweep per condition
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback BuildEvalArgv
 * @param {EvalInvocation} inv
 * @returns {string[]}
 *
 * Pure, so the exact command is assertable without running anything.
 *
 * Argument order is load-bearing: the target path must precede `--tag`,
 * `--allow-tools` and `--json`, each of which will otherwise consume it.
 *
 * Two optional pass-throughs, absent by default so every Tier 1 argv is unchanged:
 * `inv.maxCostUsd` becomes `--max-cost-usd <n>` and `inv.keepTemp` becomes `--keep-temp`.
 * A ceiling of zero or a negative number is refused here rather than by the harness.
 */

/**
 * @callback ResolveSuite
 * @param {string[]} argv
 * @param {string} repoRoot
 * @returns {{ suite: SuitePaths, rest: string[] }}
 *
 * Pure. Takes `--suite <dir>` out of the argv and returns the paths for that suite,
 * built by `suitePathsFor`, plus the remaining arguments for the ordinary parser. With
 * no flag the suite is the one the runner has always swept. The directory must sit
 * directly under `evals/` and hold a `PRE-REGISTRATION.md`; anything else is refused
 * before a spend. The runner's module-level `paths` constant stops being the only
 * instance: every caller that took it by default takes the resolved suite instead.
 */

/**
 * @callback ReadDeclaredEvidence
 * @param {Record<string, unknown>} caseYaml  the flattened `case.yaml`, dotted keys
 * @returns {{ evidence: EvidenceKind, ablation: 'none'|'with-without', declared: boolean }}
 *
 * Pure. The rule `readCaseSpec` applies. Derived by default: a `context.history_file`
 * makes the case `capability`/`none`, anything else `delta`/`with-without`. Declared
 * when the yaml carries BOTH `evidence` and `ablation` at the top level: the declared
 * pair wins and `declared` is true. A declared pair that is `delta`+`none` or
 * `capability`+`with-without` is refused, the same two pairs the registration refuses.
 * One field declared without the other is refused too — half a declaration is a
 * derivation wearing a label.
 */

/**
 * @callback SelectCondition
 * @param {CopyDirectory} copyDirectory
 * @param {SuitePaths} paths
 * @param {ConditionId} condition
 * @returns {Promise<void>}
 *
 * Places the chosen condition at `paths.conditionUnderTest` — the fixed path every
 * case names.
 */

/**
 * @callback RunSweep
 * @param {SpawnCapture} spawnCapture
 * @param {EvalCommand} evalCommand
 * @param {ResultsSnapshot} resultsSnapshot
 * @param {EvalInvocation} inv
 * @param {ReadTextFile} readTextFile   reads the located `aggregate-result.json`; a locator
 *                                      that hands back a path leaves nobody able to open it
 * @param {string[]} [expectedCases]    the case names this invocation asked for; `[]` skips
 *                                      the check. A document reporting a case the invocation
 *                                      never named is not this invocation's, whatever its
 *                                      timestamp says, and one missing a case it did name is
 *                                      a shorter run than it claims
 * @returns {Promise<SweepResult>}
 *
 * Does not throw on non-zero exit: 1 means "scored below threshold", a result
 * rather than a failure. Exit 2 is partial and must not be compared to a complete run.
 * Anything ≥ 128 is a signalled death and no sweep may continue past one.
 *
 * `document` is null whenever the output cannot be attributed to this invocation. The
 * caller must treat that as a stop, not as "nothing missing".
 */

/**
 * @callback DiscoverCases
 * @param {ReadTextFile} readTextFile
 * @param {(path: string) => Promise<{name: string, isDirectory: boolean}[]>} listDirectory
 * @param {SuitePaths} paths
 * @returns {Promise<CaseSpec[]>}
 *
 * Reads each case directory's frontmatter for name and tags. The runner needs this
 * before it can exclude the control case or pick the smoke case, and no other
 * signature supplied it. `listDirectory` is appended to the declared signature:
 * discovery is a directory walk and `ReadTextFile` cannot enumerate.
 */

/**
 * @callback PlanSweep
 * @param {CaseSpec[]} cases   every discovered case, control cases included
 * @param {{conditions: ConditionId[], runs: number, smoke: boolean}} args
 * @param {SuitePaths} [suitePaths]
 * @returns {{scored: string[], excluded: string[],
 *            groups: {ablation: 'with-without'|'none', cases: string[]}[],
 *            scopeByName: boolean,
 *            preChecks: {path: string, why: string}[],
 *            sweeps: {condition: ConditionId, invocations: {ablation: 'with-without'|'none',
 *                     cases: string[], inv: EvalInvocation, argv: string[]}[]}[]}}
 *
 * Pure. The WHOLE run — per condition, one tag-filtered invocation when every scored case
 * shares an ablation, else one `--case` invocation PER CASE (the flag takes one glob and
 * keeps the last of several), their
 * argv already built, plus the files that must exist before the first one spends
 * anything. These decisions used to live in the entry point, where `BuildEvalArgv` could
 * be pinned byte for byte while the caller passed it the wrong arguments unobserved.
 *
 * `args.runs` is supplied by the entry point from the registration's `runsPerCase`
 * unless `--runs` overrides it. The code constant that used to supply it is gone: two
 * unlinked copies of one number were how a sweep could be refused by I1c after it had
 * been paid for. `args` also carries `maxCostUsd` and `keepTemp`, copied onto every
 * invocation.
 */

/**
 * @callback SweepStopReason
 * @param {{ablation: 'with-without'|'none', cases: string[], result: SweepResult}} part
 * @returns {{why: string, hint: string|null}|null}
 *
 * Pure. Why this invocation must be the run's last, or null to carry on: a signalled
 * death, a document that cannot be attributed to it (`document: null` — NOT "no cases
 * missing"), or a document reporting fewer cases than it named. Each costs one
 * invocation to discover and would otherwise cost three conditions' rate-limit windows.
 */

/**
 * @callback WriteDriftRecord
 * @param {WriteTextFile} writeTextFile
 * @param {SuitePaths} paths
 * @param {DriftRecord} record
 * @returns {Promise<void>}
 *
 * Writes `results/drift.json` before the first sweep. `DetectDrift` had no sink, so
 * the merger required a record nothing produced — and, treating absence as drift,
 * refused to emit any report at all.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * merge-results — turning three sweeps into one comparison
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback ResolveInstrumentSha
 * @param {(suiteDir: string) => Promise<string>} digestSuite the digest function itself
 * @param {string} suiteDir
 * @returns {Promise<{sha: string, error: string}>} the digest of the instrument as it
 * stands on disk, or `''` and the reason it could not be taken
 *
 * The merger's own view of `instrumentDigest(suiteDir)` — the cases, their graders, the
 * transcripts they replay and the fixture: the SHARED half of the instrument. The other
 * half, one digest per registered condition, is {@link ResolveConditionShas}. `digestSuite` is
 * injected rather than called directly so a test can drive the disagreement without a
 * suite on disk: I2b refuses a merge whose sweep records disagree with each other, or
 * with the tree the merger can see, because a treatment measured against last week's
 * graders merges cleanly against this week's controls and every other invariant passes.
 *
 * The failure travels WITH the empty sha rather than being swallowed, because "no
 * instrument digest was computed" is the same sentence for a missing suite directory, a
 * file the process may not read, and a bug in the digest — three different things for
 * the operator to do next. It is returned, not thrown: the other invariants still have
 * things to say about the report.
 */

/**
 * @callback ResolveConditionShas
 * @param {(suiteDir: string, id: string) => Promise<string>} digestCondition
 * @param {string} suiteDir
 * @param {string[]} conditions  the registered condition ids
 * @returns {Promise<{shas: Record<string,string>, errors: Record<string,string>}>}
 *
 * The per-condition half of the instrument at merge time: `conditionDigest(suiteDir, id)`
 * for every registered id. One failure does not empty the map — it lands in `errors`
 * under its id and the other digests are still taken, so I2b can refuse the one sweep
 * whose condition is gone and say nothing false about the rest.
 */

/**
 * @callback ParseHarnessDocument
 * @param {string} json
 * @returns {HarnessDocument}
 *
 * Pure. Tolerates unknown fields (additive-only contract); rejects only a
 * `schemaVersion` other than 1.
 */

/**
 * @callback ExtractRunScores
 * @param {HarnessDocument} doc
 * @param {string} caseName
 * @returns {{ with: number[], without: number[] }}
 *
 * Pure. Every run's score, never a mean.
 */

/**
 * @callback ComputeContrasts
 * @param {Record<ConditionId, number|null>} conditionScores
 * @param {number[]} baselineScores
 * @param {PreRegistration} preRegistration
 * @param {string} caseName
 * @returns {Contrast[]}
 *
 * Pure. Expected direction comes from the pre-registration, never from the numbers.
 */

/**
 * @callback ComputeBaselineSpread
 * @param {number[][]} perCaseBaselines
 * @returns {number}
 *
 * Pure. Spread across sweeps of the stock-Claude column — the smallest contrast
 * worth reading as signal.
 */

/**
 * @callback MergeSweeps
 * @param {SweepResult[]} sweeps
 * @param {PreRegistration} preRegistration
 * @param {Provenance} provenance
 * @returns {MergedReport}
 *
 * Pure. Splits rows by {@link EvidenceKind} into two arrays so delta and
 * capability results cannot be averaged together by omission.
 *
 * For a case registered with `contrasts: 'groups'`, the row's `contrasts` stays empty,
 * no case-level pair is formed, and the group fields on {@link MergedCaseRow} are
 * filled from {@link ExtractGroupRunScores}, {@link ComputeDifferenceRunScores},
 * {@link ComputeGroupContrasts} and {@link CountRuns}. The harness score is still
 * read into `conditionScores`, because it is printed; it is not contrasted.
 */

/**
 * @callback BuildProvenance
 * @param {RevParse} revParse
 * @param {PreRegistrationDigest} digest
 * @param {Clock} clock
 * @param {SweepRecord[]} sweeps   the merger runs after the sweeps have exited, so the
 *                                 invocation is recovered from what they recorded
 * @returns {Promise<Provenance>}
 */

/**
 * @callback FormatComparison
 * @param {MergedReport} report
 * @returns {string}
 *
 * Pure. Delta and capability tables under separate headings, noise floor beside
 * them: a contrast at or below the spread (within NOISE_EPSILON) must not read as a
 * finding.
 *
 * A row with groups prints one table per group: the score per condition and `none`,
 * then its contrasts, each with the floor it was judged against and the floor's parts.
 * A group whose floor is zero prints its scores and the word unmeasurable where its
 * contrasts would be. The three counts per condition and arm print beside the group
 * scores. A row whose case is registered `contrasts: 'groups'` prints its harness score
 * with no contrast column and a note that none was registered.
 */

/**
 * @callback ExtractGroupRunScores
 * @param {HarnessDocument} doc
 * @param {string} caseName
 * @param {GradersGroup} group
 * @returns {{ with: (number|null)[], without: (number|null)[] }}
 *
 * Pure. Every run's score on this group, in run order, never a mean. Per run: the
 * weight of the named graders that passed over the weight of the named graders that were
 * scored — the harness's own arithmetic, with `withOnly` graders left out of both. A
 * run in which no named grader was scored, and a run whose paid graders were skipped by
 * a cost ceiling, is `null` in its position rather than dropped, so the caller can count
 * it. A grader name the case does not carry is refused, not ignored.
 */

/**
 * @callback ComputeDifferenceRunScores
 * @param {(number|null)[]} minuend
 * @param {(number|null)[]} subtrahend
 * @returns {(number|null)[]}
 *
 * Pure. Position by position, minuend minus subtrahend; `null` where either is null.
 * Refuses arrays of different length — the two groups were scored on the same runs or
 * they were not.
 */

/**
 * @callback CountRuns
 * @param {HarnessDocument} doc
 * @param {string} caseName
 * @param {(number|null)[][]} groupRunScores  one array per group, from ExtractGroupRunScores
 * @returns {{ runCounts: ArmCounts, errorCounts: ArmCounts, excludedCounts: ArmCounts }}
 *
 * Pure. Runs present, runs with a non-null `error`, and runs excluded from every group
 * score, per arm. Excluded means `skippedPaidGraders` was true; a run with no scored
 * grader in one group but a score in another is not excluded.
 */

/**
 * @callback ComputeGroupFloor
 * @param {{ noneMeans: number[], treatmentRuns: number[], controlRuns: number[] }} parts
 *   `noneMeans`: the group's `none` mean from each sweep. `treatmentRuns` and
 *   `controlRuns`: every scored run's group score in the two cells entering the contrast;
 *   for the `none` control, the three without-arm columns concatenated
 * @returns {{ noneRange: number, errorBound: number, pooledSd: number,
 *             treatmentRuns: number, controlRuns: number, floor: number }}
 *
 * Pure. `noneRange` is max minus min of `noneMeans`, NaN with fewer than two.
 * `pooledSd` is the standard deviation pooled over the two run arrays. `errorBound` is
 * FLOOR_ERROR_MULTIPLIER × pooledSd × sqrt(1/treatmentRuns + 1/controlRuns). `floor` is
 * the larger of the two that are numbers; NaN when neither is. The multiplier is an
 * exported constant beside NOISE_EPSILON, so the marker and the checker cannot drift,
 * and its value is fixed by the registration.
 */

/**
 * @callback ComputeGroupContrasts
 * @param {string} caseName
 * @param {string} groupName
 * @param {Record<ConditionId, number|null>} groupScores        per condition, the with-arm mean
 * @param {Record<ConditionId, (number|null)[]>} groupRunScores per condition, the with-arm runs
 * @param {number[]} groupBaselineScores                         the `none` mean per sweep
 * @param {(number|null)[][]} groupBaselineRunScores             the `none` runs per sweep
 * @param {PreRegistration} preRegistration
 * @returns {{ contrasts: Contrast[], unmeasurable: boolean }}
 *
 * Pure. One contrast per control, the direction read from the registration under
 * `<case>#<group>/<control>` and never inferred; a missing direction throws, as the
 * case-level function does. Each contrast carries the floor {@link ComputeGroupFloor}
 * built for it and its parts, and `belowNoiseFloor` is |value| <= floor + NOISE_EPSILON.
  * A floor at or below NOISE_EPSILON on any contrast makes the group unmeasurable (recon:
 * identical runs give 2e-16, never 0): no contrast is returned for it and the flag is
 * set, so the report shows a state rather than a number.
 * A treatment with no score returns no contrasts, as at case level.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * build-conditions — one generator, several suites
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback SuiteConditionPlan
 * @param {string} suiteDir
 * @returns {{ generated: Record<ConditionId, string>, copied: Record<ConditionId, string>,
 *             ablations: Record<ConditionId, string> }}
 *
 * Pure. What each condition directory of a suite is derived from: `generated` maps an id
 * to the shipped skill it mirrors (flag stripped), `copied` maps an id to another suite's
 * condition it must equal byte for byte, `ablations` maps an id to the shipped skill it
 * is cut from. The drift check walks every suite's plan and a copied condition that has
 * diverged from its source is drift, named by suite and id. The two suites share one
 * generator so the placebo cannot quietly become two placebos.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * the defect ledger — acceptance, classification, and the judge probe
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback ReadDefectLedger
 * @param {ReadTextFile} readTextFile
 * @param {(path: string) => Promise<{name: string, isDirectory: boolean}[]>} listDirectory
 * @param {string} ledgerDir   `fixtures/<seeded>/defects`
 * @returns {Promise<DefectSpec[]>}
 *
 * One entry per directory under the ledger. Refuses an entry missing any of its files,
 * a tally without `of`, or a `neighbour` that names no other entry. An empty ledger is
 * an empty array, which every consumer below refuses on its own terms.
 */

/**
 * @callback ClassifyDefect
 * @param {ReviewTally} tallyAlone
 * @returns {DefectClass|'dropped'}
 *
 * Pure. Zero named: `run-only`. Two or more: `read-visible`. Exactly one: `dropped`,
 * which means replaced by a fresh defect and reviewed again. No other input reaches a
 * class, and nothing but this function sets one.
 */

/**
 * @callback RunDetectScript
 * @param {SpawnCapture} spawnCapture
 * @param {string} scriptPath
 * @param {string} serviceDir   the directory holding the service the script must start
 * @returns {Promise<{ fired: boolean, stderr: string }>}
 *
 * `bash <scriptPath>` with `serviceDir` as the working directory. Exit 1 is `fired`,
 * exit 0 is not, any other exit is a thrown error: a script that could not run has
 * said nothing about the defect. Real instance: {@link SpawnCapture} at the entry point.
 */

/**
 * @callback CheckDefectAcceptance
 * @param {DefectSpec[]} ledger
 * @param {Record<string, { suiteGreenWithAll: boolean,
 *                          firedOnSeeded: boolean, firedOnClean: boolean,
 *                          firedAfterReference: boolean,
 *                          signatureInShippedFiles: boolean,
 *                          signatureInTranscript: boolean,
 *                          signatureInNonRunningTraces: boolean,
 *                          workspaceHasLedger: boolean }>} observed  keyed by defect id
 * @param {{ runOnly: number, readVisible: number }} minimum
 * @returns {{ ok: boolean, violations: string[], accepted: string[] }}
 *
 * Pure over what the acceptance runs recorded. A defect is accepted when the suite is
 * green with every defect present, its script fires on the seeded service, does not fire
 * on the clean one, still fires after the reference implementation, its signature is in
 * no shipped file, not in the transcript and in no trace from a run that did not start
 * the service, and the scaffolded workspace carries no ledger. `ok` also requires the
 * accepted set to meet the minimum per class. An empty ledger or an empty `observed` is
 * refused, not accepted vacuously.
 */

/**
 * @callback JudgePrompt
 * @param {string} criteria
 * @param {string} focusLabel   e.g. `last_message`
 * @param {string} text
 * @returns {{ system: string, user: string }}
 *
 * Pure. The harness's own judge prompt, verbatim, so an offline probe asks the judge
 * exactly what a sweep would. Recorded from the shipped code at step 0; a CLI release
 * that changes it changes this function, and the test that pins it against the binary
 * says so.
 */

/**
 * @callback AskJudge
 * @param {SpawnCapture} spawnCapture
 * @param {EvalCommand} evalCommand
 * @param {string} model
 * @param {{ system: string, user: string }} prompt
 * @returns {Promise<'PASS'|'FAIL'|'unclear'>}
 *
  * RESOLVED in recon (4-recon.md seam 4). Real instance: the pinned binary in print mode,
 * `-p --model <judge> --system-prompt <system> --output-format json`, the user prompt on
 * stdin; the reply's `result` is read as the harness reads it (PASS present and FAIL
 * absent), `is_error` is retried once and then `unclear`. About $0.075 per call in print
 * mode, seventeen times the harness's own judge rate, so it is priced apart from a sweep.
 */

/**
 * @callback CheckCriterionProbes
 * @param {{ probe: 'by-cause'|'by-observable'|'hedge'|'wrong'|'neighbour',
 *           verdict: 'PASS'|'FAIL'|'unclear' }[]} verdicts
 * @returns {{ ok: boolean, failures: string[] }}
 *
 * Pure. `by-cause` and `by-observable` must PASS; `hedge`, `wrong` and `neighbour` must
 * FAIL; `unclear` fails whichever it is. All five must be present — a criterion probed
 * on four is a criterion probed on the four it happened to pass.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * isolation and vocabulary checks — proposals for step 5, signatures now
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback CheckAuthoringIsolation
 * @param {{ role: string, text: string }[]} transcripts
 * @param {string[]} forbiddenRoots   absolute paths; the repository checkout at least
 * @returns {{ ok: boolean, violations: string[], digests: Record<string, string> }}
 *
 * Pure over the transcript text. A transcript that names a path under any forbidden
 * root fails, with the role and the path. `digests` is the sha256 of each transcript,
 * to be recorded in the ledger. An empty transcript list is refused: an isolation
 * nobody was subject to is not isolation.
 */

/**
 * @callback CheckTraceIsolation
 * @param {{ condition: ConditionId, arm: 'with'|'without', run: number, text: string }[]} traces
 * @param {string[]} forbiddenFragments   e.g. `/defects/`, the shipped skill's directory,
 *                                        the clean fixture's directory
 * @returns {{ ok: boolean, violations: string[] }}
 *
 * Pure over trace text. A trace containing any fragment fails, naming condition, arm
 * and run. Fragments, not roots: the condition under test is a directory inside the
 * repository that every with-arm trace may legitimately name. Refuses an empty trace
 * list and an empty fragment list.
 */

/**
 * @callback CheckInstrumentVocabulary
 * @param {{ path: string, text: string }[]} files
 * @param {string[]} words   authored by the human at step 5; matched whole-word,
 *                           case-insensitive
 * @returns {{ ok: boolean, violations: string[] }}
 *
 * Pure. A file containing any word fails, naming the file and the word. Refuses an
 * empty file list and an empty word list. Lexical only, and known to be: it catches a
 * grader written from the skill's text and cannot catch a brief that states the
 * hypothesis in other words.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * grader self-tests
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback CheckGraderProbe
 * @param {GraderProbe} probe
 * @returns {{ ok: boolean, failures: string[] }}
 *
 * Pure. Fails on a `mustNotMatch` hit as loudly as on a `mustMatch` miss — the
 * over-matching regex fails silently, and in the direction that flatters.
 */

/**
 * @callback CollectGraderProbes
 * @param {ReadTextFile} readTextFile
 * @param {SuitePaths} paths
 * @returns {Promise<GraderProbe[]>}
 *
 * Pairs each authored grader with its committed fixtures, so a grader added
 * without probes is a visible gap rather than an untested one.
 */

export {};
