#!/usr/bin/env node
/**
 * One sweep per condition: copy the condition into place, invoke the harness,
 * keep the result document.
 * Signatures: ../scripts/interfaces.mjs § run-evals
 */

// TODO: wire handles at this entry point only — CopyDirectory (fs.cp) and
// SpawnCapture (child_process.spawn).

// TODO(seam): resolve EvalCommand — which executable, and the env it needs.
// Unresolved: the binary name varies by install and this account requires
// CLAUDE_CODE_WALNUT_SPIRE=1. Must be answered in step 4 before any sweep runs.
// See docs/plans/primer-evals/2-interfaces.md § open seams.

// TODO: implement SelectCondition — copy conditions/<id>/ to _condition/.
// Must be a real copy: the harness rejects a symlinked plugin path.

// TODO: implement BuildEvalArgv — target path FIRST, before --tag, --allow-tools
// and --json, each of which consumes it otherwise.

// TODO: implement RunSweep — never throw on non-zero exit; map 0/1/2/130/143 onto
// SweepResult.exitCode and let the caller decide what a low score means.

// TODO(seam): resolve ResultsLocator — where the harness wrote
// aggregate-result.json under this suite's --eval-dir shape. Unverified; --json
// <file> may make it moot. Step 4 recon target.

// TODO: implement the sweep loop — for each condition in order, select, run,
// persist to results/<condition>.json. Sequential: concurrent sweeps would
// contend on the single _condition/ path.

// TODO: argv handling — --condition to run a subset, --runs, --smoke for a
// single-case pilot at runs=1.
