---
name: seven-steps-primer
description: Step-gated method for building one medium, structural feature with an agent, without slop — you clear every gate; the agent never self-certifies a step.
---

Build one change as a sequence of **gates**. Each step produces one small artifact — a written record a later reader can check — then stops at a gate that _you_ — the human — must clear before the next step starts. **The agent never advances a gate itself.** A record the agent signs off itself records nothing except its own confidence, and confidence is exactly the thing a later reader cannot check; the gates _are_ what make the record worth keeping.

The record is finished only when a reader who was not here can follow the change from the artifacts alone, without asking anyone and without opening anything the artifacts do not name. If they can't, an earlier artifact was thin: go back and thicken it before moving on, because a thin artifact does not announce itself later. The read-through (4) is where thin artifacts get caught against the code as it actually reads rather than at step 6 against the code you remember — a gap a real reader hits corrects its owning artifact before the change is made.

## How to run it

One step per turn. Produce the step's artifact, present it, and **stop at the gate**. Do not begin the next step until you hear an explicit _proceed_ — not a nod, not a question answered, not silence. If you did not hear it, you are still in the current step and the artifact in front of you is still a draft. If per-gate commits are on (see _Where the record lives_), commit the step's artifact **after** the _proceed_, never before.

## Is the change worth a record?

Ask before starting, and answer it out loud — the method is tuned for a change **somebody will have to read again**:

- **Skip it** — a comment, a version bump, a one-line correction, a rename your tools performed for you. Make the change, say why the record was not earned, and move on; a record here would outweigh the thing recorded.
- **Bundle it** — too small to stand alone, too real to leave undocumented. Hold it and let it ride with the next change that earns a record of its own, and name what it is waiting for; a record per keystroke buries the ones that matter under the ones that don't.
- **Run it** — the change introduces a name, a dependency, or a behaviour that someone will meet later without you standing next to them to explain it, and that is exactly the reader this method writes for.

## Where the record lives

The record needs a home in _this_ repo (default `docs/notes/<change>/`) — unnamed, the artifacts scatter into whichever file happened to be open when each one was written. Name yours **in** the step-0 artifact rather than before it, and write each step's artifact there as you produce it. Bind your tracker to the reviewer's word: a step is done when the human clears its gate, never when the artifact merely appears. A saved preference may pre-set these choices (location, one file or many, commits); where that preference lives is the human's call — a personal memory, or committed project config for a team — so honour it as the default and confirm, don't re-ask.

**Two setup choices — the human's call, never yours; put them at gate 0, not ahead of it.** Name your defaults, produce step 0, and hand over both questions beside the artifact so one reply settles all three. Blocking before step 0 spends a round-trip and gives the human nothing to review. _One file or many:_ one file means every step appends under its own heading and the record reads top to bottom in the order it was decided; many means each step gets its own file and the directory listing is the index — converting halfway loses that order, which is the only thing the record has that the code does not. _Per-gate commits:_ if wanted, commit each step's artifact _after_ its _proceed_ (never before), so the file's history is the step-level trail — but add no "approved-by" line, since the agent authors the commit and could forge it: the approval is the _proceed_, not a field. (The step-4 commit is the corrected artifacts plus the read-through notes, never the notes alone.)

## The steps

- **0 — the brief.** The request in your own words: what is being asked, which parts of the repo it lands in, what would have to be true for it to be worth doing, and what you do not yet know. Write the unknowns as questions with names attached, not as a shrug. A brief nobody disputes is a brief nobody read. **Gate.**
- **1 — the vocabulary.** Every noun the change introduces, spelled once and spelled that way everywhere afterwards. Names and nothing else — no behaviour, no shapes, no structure hiding inside a name. A name you cannot define in one clause is two names you have not separated yet. **Gate.**
- **2 — the inventory.** Everything the change touches that you did not write: callers, config keys, dependencies, environment variables, fixtures. Quote each one with the version or value actually in play here, taken from the file it came from and **never from memory**, because memory is where the stale value survives. **Gate.**
- **3 — the walkthrough.** The change narrated end to end in the order a reader meets it, in prose, using the names from step 1 and inventing **nothing** past them. If a hop cannot be narrated without a name or a caller you never listed, the inventory is short an entry: go back and add it. **Gate.**
- **4 — the read-through: read the neighbourhood, correct the record upstream, note what you leave alone.** Read the code the change lands in — the file itself and the ones nearest it — and hold every line of what you read against what the record already claims:
  - **Read the neighbours, not the diff.** The file you are about to change, the file that calls it, and the file it calls. A change that reads correctly alone and wrongly in company is the ordinary case here, not the exotic one, so **never stop at the file you came for**.
  - **Read what the code says about itself.** Comments, doc strings, error strings, log lines, test names: the prose already in the file is the previous author's record of the same neighbourhood, and where it disagrees with the code, that disagreement is yours to write down rather than quietly resolve.
  - **Follow every name from step 1 into the code.** A name that already means something else two files over is not a name you get to reuse — rename it now, while the only cost is an edit to step 1 and a gate to re-clear.
  - **Quote exactly; never paraphrase a string.** Error text, config keys, flag names, route paths, table names: character for character, copied from the file. A paraphrased string is a wrong string that reads right, and it will never be caught by reading.
  - **Read the tests as documentation.** The suite states what the code currently promises, in the only form nobody can round off. A promise this change breaks is a decision for the human at the gate, never a test you update on the way past.
  - **Write down what you are deliberately leaving alone.** The dead branch, the duplicated helper, the odd import, the file that clearly wants deleting. Unrecorded, every one of them reads later as something you missed rather than something you weighed and left.
  - **Correct the record in place.** Every surprise is a thing an earlier artifact got wrong: a wrong premise fixes 0, a wrong name fixes 1, a missing entry fixes 2, a wrong order fixes 3. Fix it where it lives, and if that changes what the step asserted, its gate re-opens — re-clear it before you carry on.
  - **Output = corrected artifacts + the read-through notes**, never a verdict that it all looks fine: per file read, the lines that mattered and the wording quoted from them. Notes carry **structure and quoted code, never real data** lifted out of a running system. **Gate.**
- **5 — the message.** The commit message and the changelog line, written **now, before the change exists**. A change that will not fit one honest sentence is a change carrying a second change inside it — say so here, where separating them still costs an edit rather than a revert. **Gate.**
- **6 — make the change.** Make it with the record open beside you, and write every departure from the walkthrough back into the record as it happens rather than afterwards. A name you have to invent here, or a caller you meet here for the first time, is a defect in step 1 or step 2: stop, go back, and re-clear that gate — never patch over it here. Done when the change matches the walkthrough line for line. **Gate.**
- **7 — the handover.** Read the record back the way the next person will read it: cold, in order, with no memory of having written it. Ship only when all three hold — the record explains the change without you in the room, the exact strings in it match the code as shipped, and the message from step 5 still describes what was actually done. **Gate.**

## What each gate is handed

Hand each gate something _another person could read_ — a file, a list, a quoted line — never a description of the record you intend to write later. The artifact's **form** differs by step, so don't default every step to a paragraph of prose:

**0** the brief · **1** the names · **2** the inventory table · **3** the walkthrough · **4** corrected artifacts + read-through notes (per file, the lines quoted) · **5** the commit message and changelog line · **6** the change itself · **7** the cold read-back.

A step whose artifact is a file (2, 4, 5) is **not** satisfied by a sentence promising the file. If you cannot point at it and read it back, the step isn't done, however clearly you described it at the gate.

## Where it goes wrong

- **Writing the record afterwards** — reconstructing at step 7 what you should have written at step 2. What you write then is only what you remember, and what you remember is the version that worked, not the two that didn't.
- **The record nobody reads** — length mistaken for care. A reader who gives up two screens in got nothing at all, so an artifact that fits on one screen and is exact beats one that is complete and never read.
- **Renaming after step 1** — a name changed downstream leaves the old one alive in the artifacts, the comments and the tests. Change it at step 1 and re-clear that gate, or **do not change it at all**.
- **Paraphrasing an exact string** — an error message or a config key written the way you would say it rather than the way the file spells it. The record then reads correct and matches nothing, which is worse than an obvious gap because nobody goes looking.
- **Self-clearing** — the agent declaring a gate cleared. **Only the human clears a gate.**
- **Racing ahead** — starting a later step while an earlier one is still open. Seeing the next step is not licence to begin it; each step produces only its own artifact.
- **Stopping at the diff** — the change shipped and step 7 never happened, so the record ends one step before the only step that checks whether anyone else can use it.
