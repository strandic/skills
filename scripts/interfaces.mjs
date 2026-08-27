/**
 * Function signatures for the skill eval suite.
 *
 * `@callback` declarations rather than stubs: a signature here carries a name,
 * its parameters and its return type, and has no body at all — nothing to mistake
 * for an implementation, nothing that runs. Types come from `./types.mjs`.
 *
 * The split: everything that decides something is pure; everything that touches
 * the world takes a named runtime handle first. Each handle names who builds the
 * real instance — three cannot yet be named and are marked OPEN SEAM.
 *
 * Rationale and call-flow diagrams: `docs/plans/primer-evals/2-interfaces.md`.
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
 * OPEN SEAMS — handles whose real instance is NOT yet determined.
 *
 * Each is an injected dependency that reads as clean precisely because it defers
 * the question of who supplies it. None may reach implementation unanswered.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @callback EvalCommand
 * @returns {{ command: string, env: Record<string,string> }}
 *
 * OPEN SEAM — undecided. The executable name varies by install, and an account
 * without the early-access flag needs `CLAUDE_CODE_WALNUT_SPIRE=1` or every
 * invocation exits 1. Neither is hardcodable in a committed script.
 * See 2-interfaces.md § open seams.
 */

/**
 * @callback ResultsLocator
 * @param {EvalInvocation} inv
 * @returns {Promise<string>} path to that sweep's `aggregate-result.json`
 *
 * OPEN SEAM — `--eval-dir` and `--output-dir` both move the results path and the
 * documented rule branches on target kind; unobserved for this suite's shape.
 * `--json <file>` may sidestep it. Recon target. See 2-interfaces.md.
 */

/**
 * @callback PreRegistrationDigest
 * @param {string} path
 * @returns {Promise<string>}
 *
 * OPEN SEAM — committed blob sha or content hash. They disagree when the tree is
 * dirty, and whether that should hard-fail the run is policy. See 2-interfaces.md.
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
 * @param {EvalInvocation} inv
 * @returns {Promise<SweepResult>}
 *
 * Does not throw on non-zero exit: 1 means "scored below threshold", a result
 * rather than a failure. Exit 2 is partial and must not be compared to a complete run.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * merge-results — turning three sweeps into one comparison
 * ──────────────────────────────────────────────────────────────────────────── */

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
 */

/**
 * @callback BuildProvenance
 * @param {RevParse} revParse
 * @param {PreRegistrationDigest} digest
 * @param {Clock} clock
 * @param {EvalInvocation} inv
 * @returns {Promise<Provenance>}
 */

/**
 * @callback FormatComparison
 * @param {MergedReport} report
 * @returns {string}
 *
 * Pure. Delta and capability tables under separate headings, noise floor beside
 * them: a contrast smaller than the spread must not read as a finding.
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
