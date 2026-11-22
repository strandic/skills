# Lessons

Appended at each run's cleanup; read at plan step 1 (lessons since the last retro marker).

## skills-v2tm (2026-11-02, PR #5)

- **Containment through links needs a design at plan time, not in review.** The brief froze a text-only check (D11) added after the plan's own security review. Review then needed five rounds (R1–R5) to settle symlinked, missing, slow and hanging plan folders. A plan that adds "this path must stay inside X" should spike, at plan step 2: every API that follows links (list, read, stat, exists); a link created, swapped or removed between two reads; a query that never answers. It should freeze one rule for all of them.
- **Write the test oracle from the contract's words.** Twice, tests forbade more than the contract did ("no file call there" against "nothing listed or read"; two first-call cost pins missed), and the implementer had to stop. Grep the existing tests for each bound and filter a ruling changes, in the same tests commit.
- **Run the mutants on each round's own lines.** Every round left uncaught mutants, some reading outside the tree on the real engine. A lane that lists the surviving mutants per changed line found them; the suite alone did not.

## skills-bnbu (2026-11-22, PR #12)

- **A stated wait counts every bounded call on the path, not only the ones the change touches.** The brief and its sketch said the first update waits "at most about 4 s" (the own read plus the clean-up). The same update also saves the session's claims under its own 2 s, so review measured 5.7 s and the docs needed a ruling round. Before freezing a sentence that states a bound, list every awaited call between the hook's start and its answer, and probe with all of them slow at once.
- **Probe a docs word against the values the code still treats the other way.** "An entry that reads as empty is skipped" covered null, "", [] and {}, which the code deletes; only an unset key is skipped. Name the exact value the code tests (`undefined` → "unset (no value)").
