#!/usr/bin/env node
/**
 * One sweep per condition: copy the condition into place, invoke the harness,
 * keep the result document.
 * Signatures: ../scripts/interfaces.mjs § run-evals
 */

// TODO: wire handles at this entry point only — CopyDirectory (fs.cp) and
// SpawnCapture (child_process.spawn).

// TODO: implement EvalCommand — executable from EVAL_CLAUDE_BIN (default `claude`),
// env always carrying CLAUDE_CODE_WALNUT_SPIRE=1. Verified in recon.

// TODO: implement SelectCondition — copy conditions/<id>/ to _condition/.
// Must be a real copy: the harness rejects a symlinked plugin path.

// TODO: implement BuildEvalArgv — target path FIRST, before --tag, --allow-tools
// and --json, each of which consumes it otherwise.

// TODO: implement RunSweep — never throw on non-zero exit; map 0/1/2/130/143 onto
// SweepResult.exitCode and let the caller decide what a low score means.

// TODO: implement ResultsLocator — newest <eval-dir>/results/<timestamp>/
// aggregate-result.json. Verified in recon; --eval-dir accepts a path.

// TODO: implement the sweep loop — for each condition in order, select, run,
// persist to results/<condition>.json. Sequential: concurrent sweeps would
// contend on the single _condition/ path.

// TODO: exclude `tags: [control]` by default. Cases run in lexicographic order, so
// control-all-steps runs FIRST and burns budget before any scored case — observed
// in recon under a cost ceiling.

// TODO: pass BOTH the case's allowed_tools AND the operator --allow-tools grant.
// They are intersected: listing Write/Edit/Bash in the case alone leaves the run
// with none of them, and the absence graders then pass vacuously.

// TODO: argv handling — --condition to run a subset, --runs, --smoke for a
// single-case pilot at runs=1.
