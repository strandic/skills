# Sweep records

Committed copies of `evals/seven-steps-primer/results/*.json` for every sweep that was
merged and published. The live directory is gitignored and was lost once (2026-09-03,
with a worktree); a report without its records cannot be re-read per grader. To re-merge
a set, copy its four files back into `evals/seven-steps-primer/results/` and run the merger
against a tree at the report's suite sha.

| directory | report | suite | instrument |
|---|---|---|---|
| `2026-09-04/` (treatment and placebo here are the text BEFORE Amendment 10; the three ablation records are of conditions since withdrawn from the active registration) | `../RESULTS-2026-09-04.md` (three conditions) and `../RESULTS-2026-09-04-no-triage.md` (the same three plus `treatment-no-triage`, swept later the same day) and `../RESULTS-2026-09-04-no-failure-modes.md` (plus `treatment-no-failure-modes`) and `../RESULTS-2026-09-05-no-setup.md` (plus `treatment-no-setup`, swept 2026-09-05; all six conditions) | `510488a` / `88be913` / `4fefb29` / `3049b39` | `a21420ccf879` |
| `2026-09-05/` | `../RESULTS-2026-09-05.md` — the text after Amendment 10 (treatment and placebo re-swept; the oneliner record is the 2026-09-04 one, unchanged), and `../RESULTS-2026-09-05-no-recon.md` (plus `treatment-no-recon`) | `ce5814d` / `78aa56b` | `a21420ccf879` |
