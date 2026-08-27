/**
 * Self-tests for the suite's own instruments. Zero dependencies.
 * `node --test scripts/test/*.test.mjs` — the trailing glob matters; a bare
 * directory is read as a module path and fails to load.
 */

// TODO: a file declaring NO tests reports `pass 1`. This file does exactly that
// today, so the suite's own runner is currently passing vacuously — the same defect
// the invariants are built against, one level up. Assert a minimum declared-test
// count in CI so an empty or unloaded test file fails instead of flattering.

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

// TODO: wire I5 — collect every grader the suite defines and every committed probe,
// then assert i5GradersHaveCompleteProbes. Pass the discovered grader list in; the
// check refuses to judge an empty one.

// TODO: wire I6 — parse each case's graders and assert
// i6AbsenceClaimsHaveContentEvidence over the named absence cases. The list of
// absence cases is authored, not derived: a check must not decide for itself what
// it is supposed to find.

// TODO: wire I3 and I7 — README ceiling sentence, and control containment against
// the case specs.
