---
name: seven-steps-primer
description: Step-gated method for building one medium, structural feature with an agent, without slop — you clear every gate; the agent never self-certifies a step.
---

Build one feature as a sequence of **gates**. Each step produces one small artifact, then stops at a gate that _you_ — the human — clear before the next step starts. **The agent never advances a gate itself.** An agent that self-certifies its steps collapses the whole method back into ordinary slop generation; the gates _are_ the method.

Planning is finished only when implementation has become **mechanical** — the feature buildable from the artifacts alone, without going anywhere else. If it can't be, an earlier artifact was wrong: go back and fix it before moving on. Recon (4) is where that going-back happens on evidence rather than at step 6 on an assumption — a defect a real run surfaces corrects its owning artifact before the build begins.

## How to run it

One step per turn. Produce the step's artifact, present it, and **stop at the gate**. Do not begin the next step until you hear an explicit _proceed_. If you did not hear it, you are still in the current step. If checkpoints are on (see _Set the artifact home_), commit the step's artifacts **after** the _proceed_, never before.

## Does this earn the gates?

Triage before starting — the method is tuned for **medium, structural** change:

- **Skip it** — a one-line fix, a mechanical edit, a doc tweak. Say so and stop; the gates won't earn their cost.
- **Decompose first** — a milestone, an epic, or a vague goal. The method fits _one_ medium structural change, not a program of work. Split it, then run the method on a single child. Research where the design _is_ the deliverable doesn't qualify — you can't plan to mechanical what you're still discovering.
- **Run it** — a wrong design would be expensive, but the change is small enough that the gates don't smother it.

## The steps

- **0 — research & plan.** Read the code and the constraints. Produce: scope, module placement, test strategy, the open questions for the human, and the _style_ question — does the artifact style match the house style? Wrong designs die cheapest here. **Gate.**
- **1 — data structures.** The types and nothing else. **Gate.**
- **2 — interfaces.** Signatures and nothing else — one pure function per unit of behaviour where the domain allows. Every parameter that is a runtime handle — a live resource the signature _receives_ rather than constructs — must name who builds the real instance in the real environment, or it is flagged as an open seam: an injected dependency reads as clean precisely because it defers that question, so **no un-provided dependency reaches a later step unflagged**. **Gate.**
- **3 — to-dos.** Place a literal marker (a `TODO` comment) **in the source at every site** where code will change — enumerated, not described. _A list in a planning doc does not satisfy this step_: the markers live in the code so step 4 can implement directly onto them, and their absence is grep-able. Every site, or the step isn't done. **Gate.**
- **4 — recon: build, run, fix the artifact upstream, revert.** Implement on top of the to-dos and run at the true input — a build and an execution, not an inspection — then push each defect back into the artifact that owns it, and only then revert:
  - **Recon is a run, not a read.** Reading the dependency source, tracing the types in your head, reasoning from the interfaces: none of these are recon — none of them can fail, and only a run can fail, so the failure is the product. A seam that did not execute is un-probed, full stop; "verified by reading" does not clear this gate.
  - **Run every seam — hardest the one you feel surest of.** A doubt gets tested and a certainty gets skipped, so the false premise hides in the certainty. Confidence is the tell, not the licence.
  - **Name the excuse and refuse it** — "a live run needs the full build", "the environment is costly to stand up", "low marginal info", "the source clearly shows it", "it's the same part, just reused": each is a bet that reading substitutes for running, and that bet is the leak. (A part reused _as-is_ in a new runtime is a recon target, not a given — "unchanged" holds only where it was built.)
  - **An environment that blocks the run is a _finding_, not a licence to read.** A build the repo can't produce, a workspace install that landmines, a missing credential: write it up as a defect against the step that assumed the seam was runnable, then find the way to run it — if the build is the hard thing, the build is the seam.
  - **Run the whole path, not a basket of probes; probe the technique.** Start at the true input and use the real component at _every_ hop — a hand-supplied intermediate is a red flag marking an un-probed seam, and a targeted probe set only disconfirms the risks you already listed. Carry the mechanism you actually _observed_ — a plausible-but-wrong technique still fits the interfaces, so only a real attempt reveals the simplest-and-correct one.
  - **Tests are part of the run.** Run the existing suite (a spike that regresses it is a finding) and write throwaway probe-tests where an assertion is the cleanest way to observe a mechanism — spike, reverted; the _enforcing_ tests are Step 5's checks and Step 6's suite, authored from the corrected artifacts. e2e proper is Step 7 (live data); recon may run a _targeted, ephemeral_ live probe of an external seam — a real call, torn down after — not the e2e suite.
  - **Close the loop before you revert — this is the point of the step.** Every defect is a lie an earlier artifact told, and that artifact owns the fix: a premise fixes Step 0, a type or contract Step 1, a mis-drawn seam Step 2, a wrong site Step 3. Correct it _in place_; if that changes what the step asserted, its gate re-opens — re-clear it, so a falsehood never reaches an invariant the human ratifies. **Revert discards the throwaway spike and nothing else — never the corrections.**
  - **Output = corrected artifacts + an evidence-bearing report**, not a bare list of breaks: per seam, the real command run and the mechanism observed (the payload that stripped-not-rejected, the status the log routed, the value the guard compared); a seam with no observed-run evidence fails the gate. Real data leaks — the artifacts and report carry **aggregates and structure, never identities or real content**. **Gate.**
- **5 — invariants.** _You_ state them; the agent only wires and enforces them — authorship can't be delegated, because an invariant is a pre-agreed ruling on a future dispute. Give the enforcement the same adversarial pass as the rules it polices: a check that can false-positive erodes the law it enforces. **Gate.**
- **6 — implement.** Mechanical if the earlier steps did their job — typing, not deciding. A design decision surfacing here is a defect in an earlier artifact: stop and go back. **Before implementing, put the cold/warm fork to the human as a required gate decision — never assume it:** _cold_ hands step 6 to a fresh context (a new session or a subagent) carrying only the step artifacts + invariant checks, so the artifacts alone drive the build and the method itself is validated; _warm_ implements in the current context, fine when you only mean to ship. Done when the step-5 invariants hold. **Gate.**
- **7 — done-state on live data.** Ship only when all three hold: the invariants hold in production, the feature does something real no existing tool could, and a covering artifact exists (a runbook or ship-checklist read at this gate). Fixtures encode your imagination; live data encodes reality. **Gate.**

## Deliverables

Hand each gate something _inspectable_ — a diff, a `grep`, a file — not prose that only _describes_ the work; a verifiable artifact makes its own absence obvious. The artifact's **form** differs by step, so don't default every step to a planning doc:

**0** a plan · **1** the types · **2** the signatures · **3** `TODO` markers **in the source** (grep-able) · **4** corrected upstream artifacts + a report (per-seam command + observed mechanism), spike code reverted · **5** the invariant + its check in code · **6** the implementation · **7** live behaviour + a runbook.

A step whose artifact lives in code (3, 4, 6) is **not** satisfied by a document _about_ it. If you can't point at the deliverable and check it, the step isn't done.

## Failure modes

- **Rubber-stamp gate** — a gate reviewed without attention grants the feeling of ownership without the substance. Gate density should follow _irreversibility_: collapse gates over cheap, redoable artifacts, but never collapse research (0), recon (4), or the done-state (7).
- **Rushing to the diff** — racing toward step 6 while an earlier step is open. Seeing a later step is not licence to start it; each step produces only its own artifact.
- **Self-certifying** — the agent declaring a gate cleared. Only the human clears a gate.
- **Trusting the shipped half** — reusing a part that already exists and passed its own tests, in a new runtime or context, without re-probing the join. "Already works" was true somewhere else; the seam where you attach it is net-new and owned by neither side, so that is exactly where the unprobed gap hides.
- **Reading in place of running** — you inspected instead of ran: traced the source, waved through the seam you were sure of, priced the run as not worth it. Inspection can't fail, so it isn't recon, and the false premise hides in the certainty you skipped — run every seam, hardest the one you'd skip.
- **Reporting the break instead of fixing the artifact** — you logged what broke and reverted, losing the fix with the spike. A break is a defect in the prior step's artifact (0 premise / 1 type / 2 seam / 3 site): fix it in place and re-clear that gate _before_ the revert, which discards the spike, never the corrections.
- **Verdicts without evidence** — the report says "works" with no command and no observed mechanism. Show the real run and what you saw (the value that stripped-not-rejected, the status that routed); no observed-run evidence, no passed gate.
