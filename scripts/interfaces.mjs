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
 * @callback ResultsLocator
 * @param {EvalInvocation} inv
 * @returns {Promise<string>} path to that sweep's `aggregate-result.json`
 *
 * RESOLVED in recon: with target `.` and `--eval-dir evals/<skill>`, the harness
 * writes `<eval-dir>/results/<ISO-timestamp>/aggregate-result.json` alongside
 * `report.html`. Take the newest timestamped directory. `--eval-dir` accepts a
 * PATH, not only a bare directory name.
 */

/**
 * @callback PreRegistrationDigest
 * @param {string} path
 * @returns {Promise<string>}
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
