# 3b code review: skills-bnbu (store clean-up bounded per pass), head 3f5c376

I found no code defect on the lines this PR adds. All 7 mutants predicted to die did die. One prose claim is wrong: the "about 4 seconds" bound is really about 6 s. Two wordings are loose, and one predicted red set is off.

Scratch: /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/218a355e-cdd3-44c2-abd8-54702ab71064/scratchpad/bnbu-run/3b. This report is saved verbatim as report.md there. The repo was not touched.

**Control** (unpatched head copy): `285 pass` / `0 fail` / `Ran 285 tests across 1 file.` (control.txt). **Lint:** `plugin validate` gives `✔ Validation passed`.

## Mutant table

Each mutant was patched alone into a fresh copy of head, and the full suite was run.
- Outputs: mutants/<name>.txt
- Patches: mutants/<name>/patch.diff
- Runner: scripts/run_mutant.sh

| mutant | predicted red | observed red | result |
|---|---|---|---|
| m1-no-skip (failed read: return) | U3 + kit file-end check | U3 only (`Received: { bad: true, old: 25 }`); 284 pass / 1 fail | kill. The predicted file-end check did not go red. |
| m2-start-0 | U4 | U4; 284/1 | kill |
| m3-late-continue | U1 ×2, U7 | U1 ×2, U7; 282/3 | kill |
| m4-delete-late-continue | U2, gets 3 | U2 (`Received: { atMost2: true, gets: 3 }`); 284/1 | kill |
| m5-undefined-judged | U6 | U6; 284/1 | kill |
| m6-no-cap | S30, U4 | S30, U4; 283/2 | kill |
| m8-start-offby1 | U4, U5 | U4, U5; 283/2 | kill |
| m7-keys-own-bound | none (equivalent) | none; 285/0 | survives the suite. Killed by my own test K7 (event count only, see finding 4). |
| m9-no-cancel | none (no observable output) | none; 285/0 | survives the suite. Killed by my own test K9 (see finding 4). |

## Findings

### 1. The "at most about 4 seconds for the store" claim is false. The real bound is about 6 s.

- **Where:** two sentences, both added by this PR:
  - README.md:40: "So the first update waits at most about 4 seconds for the store: 2 for the session's own entry, 2 for the clean-up"
  - CHANGELOG.md:11: "so the first update waits at most about 4 seconds for the store"
- **What is wrong:** the same first update also saves the session's claims with `bounded($, $.store.set(...))` (register.tsx:266, existing code). That save has its own 2 s limit. It runs whenever the session claims a tree, which is the normal case (the cwd's tree). So the store can hold the first update for up to 2 + 2 + 2 = about 6 s.
- **Reproduction:** test P1 in scripts/probes.tsx, appended to a head copy (probe-head/). Every `store.get` and `store.set` answers in 1 900 ms. The store holds 100 fresh other entries.
- **Command:** `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test <scratch>/probe-head/mods/shawarma-companion`
- **Output** (probe-head.txt):
  - `P1 READING heldMs=5700 calls=["get claims:sess-1","get claims:o37","get claims:o38","set claims:sess-1"] stored={"trees":["/repo"],"at":1792152123900}`
  - `(fail) 3b probes > P1 ...` (the test asserts ≤ 4 100 ms)
- **Fix:** the code is fine; only the prose is wrong. Write "at most about 6 seconds: 2 for the session's own entry, 2 for the clean-up, 2 to save its claims", or "the clean-up adds at most 2 seconds".

### 2. "reads as empty" covers more than the code does. The code skips only an unset value (`undefined`).

- **Where:** two sentences, both added by this PR:
  - CHANGELOG.md:12: "An entry that reads as empty is skipped too, not deleted"
  - README.md:40: "The mod skips an entry it cannot read, or that reads as empty"
- The code comment at register.tsx:329 is accurate: "A key listed but unset reads as `undefined`".
- **What is wrong:** entries stored as `null`, `""`, `{}`, `[]` or `0` are still judged malformed and deleted. A reader can take any of those as "empty".
- **Reproduction:** test P3 in scripts/probes.tsx on head.
- **Output** (probe-head.txt): `P3 READING kept=["claims:undef"]`. All five of those entries were deleted. Only the entry whose read answered `undefined` was kept.
- **Severity:** low. Suggested wording: "an entry that reads as unset (no value)".

### 3. "once per session id, at its first update" is not exact.

- **Where:** README.md:40, added by this PR.
- **What is wrong:**
  - If the read of the session's own entry fails, `restore` throws before `prune`. `restoredFor` stays unset, so the clean-up runs at a later update instead.
  - `session.start` also resets `restoredFor` (register.tsx:689), so the same id is cleaned again after a reload or resume.
- **Reproduction:** scripts/probe-p5.tsx on head (probe5-head/), with the world's `store.get once` failure set.
- **Output:** `P5 READING oldAfterFirstUpdate=true oldAfterSecondUpdate=false`
- **Severity:** low. The behaviour is sensible; only the wording overstates it. Suggested wording: "at the first update that reads the session's own entry".

### 4. m7 and m9 survive the suite, but tests that watch clock events kill them.

The brief predicts no red test for either, and that holds for the suite. But each one changes something a hook can observe.

- **K9 (kills m9):** it wraps the `clock.after` handler and counts 2 s timers that resolve after the first Bash call and a 10 s advance. Head gives 0, m9 gives 1. The timer the mutant leaves uncancelled still dispatches and resolves.
- **K7 (kills m7):** it records the `clock.after` waits asked between the own read answering and the key listing answering. Head gives `[2000]`, m7 gives `[2000, 2000]`.
- **Test file:** scripts/kill-tests.tsx, appended to copies of head, m9 and m7 (kill-*/).
- **Command:** `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test <scratch>/kill-<v>/mods/shawarma-companion`
- **Output:**
  - head: `287 pass` / `0 fail`
  - m9: `(fail) ... K9 ...` `Expected: 0` `Received: 1`; `286 pass` / `1 fail`
  - m7: `(fail) ... K7 ...` `Expected: [2000]` `Received: [2000, 2000]`; `286 pass` / `1 fail`
- **Meaning:** m7 still does the same thing in what the mod produces (rows, store, time held). Only the number of dispatches differs. m9 leaves one extra timer that fires 2 s later and does nothing.
- **Severity:** a test gap, not a defect. Adding K9 is optional. It would pin the cancel in the `finally` at register.tsx:338, a line this PR adds.

### 5. The brief's predicted red set for m1 is wrong.

§7 predicts m1 also turns the kit's file-end check red. It does not: only U3 goes red (mutants/m1-no-skip.txt: `284 pass` / `1 fail`, no file-end failure). The kill holds; only the brief's prediction needs correcting.

## Claims and invariants checked and found true (executed)

- **"held the first update ... for up to about 400 seconds"** (CHANGELOG.md:11, about the base). True.
  - On a base copy (scripts/probe-p2b.tsx), with reads and deletes both slow: `ms=1900 n=10 heldMs=39900`, `ms=1900 n=20 heldMs=77900`, `ms=1990 n=20 heldMs=81590`.
  - The hold grows linearly: 1.99 + n × 3.98 s, so about 400 s at n = 100.
  - A direct n = 100 run hit the test's 120 s real-time limit, so I did not use it.
- **"stops 2 seconds after it starts":** true. U1, U7 and U2 pass on head, and in P1 the pass ended 2.0 s after the own read.
- **"usually start at different entries"** (CHANGELOG:12, README:40, model.ts:53): true for real store sizes, weak for very small ones. No finding. scripts/fnv.py measured how often two random UUID ids get the same start:

  | keys | same start |
  |---|---|
  | 2 | 0.504 |
  | 5 | 0.196 |
  | 20 | 0.048 |
  | 151 | 0.007 |

- **§3 contract for `pruneStart`** (model.ts:55-63): it matches the brief's constants and steps (`0x811c9dc5`, `0x01000193`, `Math.imul` then `>>> 0`, `charCodeAt`, `% count`, 0 when `count <= 0`). fnv.py independently gives `[6, 26, 36, 1, 0, 0]`, the same values U5 expects.
- **Signatures** match §3: `prune($, id, now): Promise<void>` and `pruneStart(sessionId: string, count: number): number`.
- **Error surface:**
  - A rejected key listing deletes nothing, the call still answers, and the next call does not retry (P4: `old=true lists=1 answered=true`).
  - A rejected read skips its entry (U3).
  - An `undefined` read skips its entry (U6, P3).
  - No answer by the deadline ends the pass (U2, U4).
- **Prune never throws:** every store call goes through `race`, which catches rejections. If `$.clock.after` threw inside the Promise executor, every race would read `failed` and the pass would end with no delete. I found no executed path where `prune` throws.
- **Code comments** at register.tsx:290-292, 303-310, 327 and 329 match the behaviour above.
- **Known and ruled, not re-reported:** the read-then-delete race (skills-hybo) and a refused clock timer (skills-vmhr).
