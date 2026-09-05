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

## Set the artifact home

Step artifacts need a home in _this_ repo (default `docs/plans/<feature>/`) — unnamed, they improvise their own location. Name yours **in** the step-0 artifact rather than before it. Bind your tracker to the reviewer's word: a step is done when the human clears its gate, never when the artifact merely appears. A saved preference may pre-set these choices (home, worktree, checkpoints); where it lives is the human's call — a personal memory, or committed project config for a team — so honour it as the default and confirm, don't re-ask.

**Two setup choices — the human's call, never yours; put them at gate 0, not ahead of it.** Name your defaults, produce step 0, and hand over both questions beside the artifact so one reply settles all three. Blocking before step 0 spends a round-trip and gives the human nothing to review. _Worktree isolation:_ if wanted, create the feature's worktree before step 0 and keep every artifact in it, so the whole feature — plan, code, reviews — lands as one unit. _Per-gate checkpoints:_ if wanted, commit each step's artifacts _after_ its _proceed_ (never before), so `git log` is the step-level audit trail — but add no "cleared-by" line, since the agent authors the commit and could forge it: the approval is the _proceed_, not a field. (The step-4 checkpoint is the corrected artifacts + report, spike reverted.)

## The steps

- **0 — research & plan.** Read the code and the constraints. Produce: scope, module placement, test strategy, the open questions for the human, and the _style_ question — does the artifact style match the house style? Wrong designs die cheapest here. The plan is this turn's whole deliverable: write it, change no source, and stop — however obvious the fix now looks. **Gate.**
- **1 — data structures.** The types and nothing else. **Gate.**
- **2 — interfaces.** Signatures and nothing else — one pure function per unit of behaviour where the domain allows. Every parameter that is a runtime handle — a live resource the signature _receives_ rather than constructs — must name who builds the real instance in the real environment, or it is flagged as an open seam: an injected dependency reads as clean precisely because it defers that question, so **no un-provided dependency reaches a later step unflagged**. **Gate.**
- **3 — to-dos.** Place a literal marker (a `TODO` comment) **in the source at every site** where code will change — enumerated, not described. _A list in a planning doc does not satisfy this step_: the markers live in the code so step 4 can implement directly onto them, and their absence is grep-able. Every site, or the step isn't done. **Gate.**
- **4 — recon: build, run, fix the artifact upstream, revert.** Implement on top of the to-dos and run at the true input — a build and an execution, not an inspection — then push each defect back into the artifact that owns it, and only then revert:
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

**The rule that outranks the rest.** One step, one artifact, one gate, then stop. A correct diagnosis is not permission to implement it; a fix that looks obvious is not permission to skip the gate. If you have done more than the current step asked, you have left the method.
