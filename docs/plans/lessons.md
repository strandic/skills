# Lessons

Appended at each run's cleanup; read at plan step 1 (lessons since the last retro marker).

## skills-v2tm (2026-11-02, PR #5)

- **Containment through links needs a design at plan time, not in review.** The brief froze a text-only check (D11) added after the plan's own security review. Review then needed five rounds (R1–R5) to settle symlinked, missing, slow and hanging plan folders. A plan that adds "this path must stay inside X" should spike, at plan step 2: every API that follows links (list, read, stat, exists); a link created, swapped or removed between two reads; a query that never answers. It should freeze one rule for all of them.
- **Write the test oracle from the contract's words.** Twice, tests forbade more than the contract did ("no file call there" against "nothing listed or read"; two first-call cost pins missed), and the implementer had to stop. Grep the existing tests for each bound and filter a ruling changes, in the same tests commit.
- **Run the mutants on each round's own lines.** Every round left uncaught mutants, some reading outside the tree on the real engine. A lane that lists the surviving mutants per changed line found them; the suite alone did not.
