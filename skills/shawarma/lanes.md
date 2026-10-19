# Lanes — read at every lane launch; paste the lane's cell into its prompt

Written into a brief's §7 at plan step 2.

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | *(template text)* §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines <ids>, a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests <ids>, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | *(template text)* the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines, one per row, each one input or one verb sequence with the oracle that grades it — the expected reading stays in the planner's notes; a class word (spike.md q3) is an `enumerate:` row with its source; one line per repeat over input the diff adds or changes, its worst-case input named. The plan-time attack lane (plan step 2) also flags each spike.md rule the diff triggers that §2 does not apply, and each ticket checklist item with no §3 row, §4 test, §5 follow-up or §8 reason. Every lane, before running a line, checks its named oracle: one sharing a parser, a ref or an environment with what it grades is returned as a finding, not run, and the line is changed before it runs:

- `<id> <attack> → oracle <name>`
- `<id> enumerate: <finite list, source> → oracle <name>`

Mutants for 3b, one per row:

- `mutant: <the one-line patch, as executed> → <tests red on the final §4 files> (<output path>)`

