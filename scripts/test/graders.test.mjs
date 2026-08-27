/**
 * Self-tests for the suite's own instruments. `node --test`, zero dependencies.
 */

// TODO: implement CollectGraderProbes — pair each authored grader with its
// fixtures under prompt-fixtures/; a grader with no probes must fail loudly
// rather than be skipped.

// TODO: implement CheckGraderProbe — a mustNotMatch hit fails as loudly as a
// mustMatch miss.

// TODO: register one test per grader probe so a failure names the grader.

// TODO: test BuildEvalArgv — assert the exact argv, including target-first order.

// TODO: test MergeSweeps — a capability row must never reach deltaRows.

// TODO: test that every marker in docs/plans/primer-evals/harness-facts.md still
// resolves against the installed CLI binary, so an upgrade that moves the wording
// fails here instead of going unnoticed.
