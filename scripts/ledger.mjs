/**
 * The defect ledger: reading it, classifying and accepting its entries, and probing a
 * criterion against the judge outside the harness.
 *
 * Signatures: `scripts/interfaces.mjs` (ReadDefectLedger, ClassifyDefect,
 * RunDetectScript, CheckDefectAcceptance, JudgePrompt, AskJudge, CheckCriterionProbes).
 * Shapes: `scripts/types.mjs` (DefectSpec, DefectClass, ReviewTally).
 * Placement: a module of its own, recorded as a correction to step 0's tree in
 * `docs/plans/primer-evals/defect-injection/3-todos.md`.
 *
 * Nothing here names a defect, a suite or a skill.
 */

// TODO: readDefectLedger(readTextFile, listDirectory, ledgerDir) — one DefectSpec per directory; refuse a missing file, a tally without `of`, a neighbour naming no other entry.

// TODO: classifyDefect(tallyAlone) — 0 named → 'run-only'; ≥ 2 → 'read-visible'; exactly 1 → 'dropped'. Pure; nothing else sets a class.

// TODO: runDetectScript(spawnCapture, scriptPath, serviceDir) — `bash <script>` in serviceDir; exit 1 → fired, 0 → not fired, anything else throws.

// TODO: checkDefectAcceptance(ledger, observed, minimum) — pure over the recorded booleans; refuse an empty ledger or empty observations; accepted set must meet the per-class minimum.

// TODO: judgePrompt(criteria, focusLabel, text) — the harness's prompt verbatim: system "You are a strict, terse evaluation judge for coding-agent traces."; user "You are grading the output of a coding agent against a criterion.\n\nCriterion:\n<criteria>\n\n\nAgent output (<focusLabel>):\n<text>\n\n\nRespond with exactly one word: PASS or FAIL."

// TODO: askJudge(spawnCapture, evalCommand, model, prompt) — RESOLVED in recon: the pinned CLI in print mode (`-p --model <judge> --system-prompt <sys> --output-format json`, the user prompt on stdin) accepts a separate system prompt and answers with one word; parse `result` as the harness does (PASS present and FAIL absent), `is_error` → 'unclear'. One call costs about $0.075 in print mode (65 calls, $4.85), far above the harness's own judge rate; a transient "Not logged in" reply (is_error, 0 cost) was seen three times in one minute and never again — retry once before reporting 'unclear'.

// TODO: checkCriterionProbes(verdicts) — by-cause and by-observable must PASS; hedge, wrong and neighbour must FAIL; 'unclear' fails; all five required.

export {};
