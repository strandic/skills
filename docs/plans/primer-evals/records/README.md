# Sweep records

Committed copies of `evals/seven-steps-primer/results/*.json` for every sweep that was
merged and published. The live directory is gitignored and was lost once (2026-09-03,
with a worktree); a report without its records cannot be re-read per grader. To re-merge
a set, copy its four files back into `evals/seven-steps-primer/results/` and run the merger
against a tree at the report's suite sha.

| directory | report | suite | instrument |
|---|---|---|---|
| `2026-09-04/` | `../RESULTS-2026-09-04.md` (three conditions) and `../RESULTS-2026-09-04-no-triage.md` (the same three plus `treatment-no-triage`, swept later the same day) and `../RESULTS-2026-09-04-no-failure-modes.md` (plus `treatment-no-failure-modes`) | `510488a` / `88be913` / `4fefb29` | `a21420ccf879` |
