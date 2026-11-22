# Lessons

Appended at each run's cleanup; read at plan step 1 (lessons since the last retro marker).

## skills-v2tm (2026-11-02, PR #5)

- **Containment through links needs a design at plan time, not in review.** The brief froze a text-only check (D11) added after the plan's own security review. Review then needed five rounds (R1–R5) to settle symlinked, missing, slow and hanging plan folders. A plan that adds "this path must stay inside X" should spike, at plan step 2: every API that follows links (list, read, stat, exists); a link created, swapped or removed between two reads; a query that never answers. It should freeze one rule for all of them.
- **Write the test oracle from the contract's words.** Twice, tests forbade more than the contract did ("no file call there" against "nothing listed or read"; two first-call cost pins missed), and the implementer had to stop. Grep the existing tests for each bound and filter a ruling changes, in the same tests commit.
- **Run the mutants on each round's own lines.** Every round left uncaught mutants, some reading outside the tree on the real engine. A lane that lists the surviving mutants per changed line found them; the suite alone did not.

## skills-bnbu (2026-11-22, PR #12)

- **A stated wait counts every bounded call on the path, not only the ones the change touches.** The brief and its sketch said the first update waits "at most about 4 s" (the own read plus the clean-up). The same update also saves the session's claims under its own 2 s, so review measured 5.7 s and the docs needed a ruling round. Before freezing a sentence that states a bound, list every awaited call between the hook's start and its answer, and probe with all of them slow at once.
- **Probe a docs word against the values the code still treats the other way.** "An entry that reads as empty is skipped" covered null, "", [] and {}, which the code deletes; only an unset key is skipped. Name the exact value the code tests (`undefined` → "unset (no value)").

## skills-cm2l (2026-11-22, PR #13)

- **Enumerate every catch on the path that turns an error into an empty value, not only the awaits the ticket names.** The attack lines listed each await in `rowOf` that can reject. Both review lanes then found a fourth way into the ticket's own symptom: `markersOf` reads a failed `.shawarma` listing as "no markers", so the check still stops and the pane says no marker exists (ticket skills-3hy6). At plan step 2, grep the path from the timer to the draw for `.catch(` and `?? null`, and give each one an attack line.
- **Put the comments a change makes false into the sketch.** Review found six doc comments and README sentences that described the code before the change, and each rewrite was a new claim that needed its own run: two fix-review lanes went on prose alone. At plan step 2, grep the doc comments of every function the sketch touches and the README sections naming its behaviour, and rewrite them in the executed sketch.
- **Two open briefs on the same mod: rule the version at the gate, not at freeze.** The store clean-up PR merged first as 0.3.1, the version this brief had ruled, so the run needed a rebase, a second version ruling and one more review lane. When another plan dir names the same mod, freeze the version as "next after main at merge time" and read it at Wave 4.
