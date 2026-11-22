I ran every line, L1 to L6. The sketch does what it says inside `openWindows`: it fixes F1 (K7c and K7c2 now pass), and in my runs it never hides the session's own run where the contract says to claim it. One new finding: after a call is abandoned, the span still counts until a main turn end and 64 writes have both happened. The sketch's doc comment and README imply otherwise.

## Setup
- Scratch folder: `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/4223d73b-665c-4520-bc14-c05fe749bdb1/scratchpad/attack2/`. All paths below are inside it.
- Copies:
  - `base/` is 1f961fb (from git archive).
  - `head/` is the spike worktree's mod folder.
  - `r1/` is `head` minus the two `next.signal` lines.
  - `head_i/` is `head` with store-logged instrumentation.
  - `m_noab/` is `head` with only `addEventListener` (no already-aborted check).
  - `h2/` is a candidate fix (see F1).
- Tests are `helpers2.tsx` + `../attack/common.tsx` + `*.part.tsx`. `helpers2` is round 1's `helpers.tsx` with one change: the `hold` callback also receives `next`.
- The round 1 report is not at `docs/plans/2026-11-22-skills-5w5c-open-span-eviction/reports/attack/report.md`; the folder holds only `research/`. I took round 1's readings from `../attack/*.out`.

## Kit facts found while building the probes
- An inline plugin runs from its own source in its own environment. A closure over a test variable is undefined there, so the hook throws and is skipped without notice. Round 1's ABOVE pattern with a literal delay works.
- The user interrupt cannot be expressed in the kit:
  - `$.turn.abort` does not exist on the test `$` (P0b: "is not a function").
  - From a plugin it reaches the test's bottom hook ("no implementation for turn.abort") and aborts nothing (P0d: the call stays pending, the signal beneath is not aborted).
  - The research report says a real interrupt settles `next(e)` with `isError`. Round 1's K1 `isError` row covers that ending.
- "A hook beneath overruns its budget": an append-tier plugin holding a clock wait is let go after 10 s of real time.
  - Its own signal aborts.
  - The mod's signal does not abort. Its `next(e)` resolves normally through the test hook, so the mod sees a normal end.
  - The same let-go also stops the mod's 15 s check. After it, nothing is listed until the next tool call (seen in L1 B-b and in L4 at 10 000 writes). This is a kit artifact on every variant.

## L1: ways the signal aborts × marker before or after the abort
Oracle: rows written by hand from the contract. "Ended for the engine" = the moment the hook above answered.
- OWN7 = `main-1 · trivial`, `other tree: wt-7 · trivial`
- NOT7 = `main-1 · trivial`, `1 run in another worktree`

Readings are base / r1 / head. Repro: `l1.test.tsx`, outputs `L1_{base,r1,head}.out`.

| Case | Oracle | base | r1 | head |
|---|---|---|---|---|
| A-a never: marker listed before the abort; beneath never settles | OWN7 | NOT7 (the bug) | OWN7 | OWN7 |
| A-a later: same; beneath settles later | OWN7 | NOT7 | OWN7 | OWN7 |
| A-b never, evict=true: marker after the abort, a main turn end and 64 writes | NOT7 | NOT7 | OWN7 (over) | NOT7 |
| A-b later, evict=true | NOT7 | NOT7 | OWN7 | NOT7 |
| A-b never, evict=false | NOT7 | OWN7 | OWN7 | OWN7 (over on all) |
| A-b later, evict=false | NOT7 | OWN7 | OWN7 | OWN7 (over on all) |
| A-b soon, evict=true or false: beneath writes, then settles before any listing | NOT7 | OWN7 | OWN7 | OWN7 (over on all) |
| B-a: marker listed while the hook beneath is held | OWN7 | NOT7 (the bug) | OWN7 | OWN7 |
| B-b, evict=true or false: marker after the call ended | NOT7 | NOT7 | NOT7 | NOT7 |

- **Head under-claims against the contract:** none.
- **But against reality:** in A-b evict=true the marker comes from this session's own tool, which is still running beneath. Head shows "1 run in another worktree" there, which is the bug's symptom; base does too, and r1 claims it. The contract allows this. In the real engine it needs a tool that outlives the abort; `backgroundedByTurnAbort` in the d.ts suggests a Bash command moved to the background by a turn abort could. I could not reproduce that in the kit.
- **Liveness:** only head passes both A-a never and A-b never evict=true. Base fails A-a; r1 fails A-b.
- **Cases not run:** the user interrupt (not expressible, see above). "This hook ran out of budget" for the mod's own hook (20 minutes of its own time, not counted while `next` runs; not reachable).

## L2: signal already aborted when the listener is added
Setup: the mod's `session.cwd` read is held; the hook above answers meanwhile; then cwd answers. After that: an eviction and another session's marker. Oracle: `main-1 · trivial`, `1 run in another worktree`. Repro: `l2.test.tsx`.
- base: pass. r1: FAIL (`other tree: other-1`). head: pass. m_noab: FAIL (claimed).
- head_i logs `instr:abortedAtStart:long = true`, so the branch was reached.
- Head's reading equals base's. Liveness comes from m_noab failing; only the `aborted` check makes the difference.

## L3: round 1's tests rerun on the new sketch
Oracle: round 1's contract function and readings. Output: `L3_head.out`.
- K1: 13/13 pass. Unchanged from r1; base 1/13.
- K4: 108/108 match the contract. Unchanged from r1; base 104.
- K1b: 4 pass; `clockReject` and `clockHang` still fail.
  - That is the same over-claim on base, r1 and head: `after` includes `other tree: other-1`.
- K7c and K7c2 changed:
  - r1: FAIL (`other tree: other-1`, the F1 over-claim).
  - head: PASS (`1 run in another worktree`, `answered above`), equal to base.
- The K4 file reports "a rejection nothing handled: The operation was aborted" 110 times. The count is the same on base and r1, so it comes from the test side.

## L4: listener left on signals of calls that ended normally
Oracle: CPU and max RSS, head vs base and r1; the set's size through `head_i`. Repro: `l4.test.tsx`, `l4b.test.tsx`.
- 2 000 sequential writes, two runs each (user CPU s / max RSS MB):
  - base: 6.55 / 346.6 and 5.20 / 345.5
  - r1: 6.43 / 344.9 and 6.19 / 344.8
  - head: 6.29 / 347.3 and 5.75 / 351.0
  - head_i: `openSize` 0, `maxOpen` 0. Rows correct on all.
- 10 000 writes (user CPU s / max RSS MB):
  - base: 20.7 / 441.0 and 23.2 / 439.9
  - r1: 21.4 / 445.8
  - head: 22.6 / 442.7 and 22.4 / 437.1
  - Rows at 10 000 are wrong on all three (kit artifact, see above).
- **Verdict:** no measurable cost or growth; the differences are noise. Retained listeners cannot be observed directly in the kit.

## L5: claims in the README and the `openWindows` doc comment
Each oracle is the sentence read literally. Repro: `l5.test.tsx`.
- Live control L5p: a call that never ends, an eviction, then a new marker from another session. Oracle: claimed.
  - base `1 run`; r1 and head `other tree: other-1`. Live.
- "every marker another session writes is claimed too": FALSE on head.
  - L5a, another session rewrites its marker that the last check listed: `1 run in another worktree`.
  - L5b, a marker dated before the call began (a copy that keeps its time): `1 run in another worktree`.
  - L5c, a marker in a 51st worktree: `2 worktrees not scanned`.
  - Base and r1 read the same in all three.
- "a long subagent call claims the marker it writes partway through": FALSE for a rewrite.
  - L5d, the long call rewrites a marker the last check listed: `1 run in another worktree` on all three. The cause is the existing lastSeen rule (C3).
- "A call that never ends keeps counting": contradicted by the sketch's own V3. There the call beneath never ends, it is abandoned, and it stops counting.
- Doc comment, "so does the call being abandoned": true only for `openWindows`. The span keeps `to = ∞` in `windows` and `turnWindows`, so it still counts (F1).
- Doc comment, "cannot drop the span of a call that may still write its marker": an abandoned call beneath may still write (L1 A-b evict=true).
- The comment lists two abort causes; the d.ts lists a third, "this hook ran out of budget".

## L6: the d.ts rows the change relies on
- `next.signal` at lines 8349–8355: **verified**. Text: "Aborts when the call this dispatch belongs to is abandoned: the user interrupted, a hook above settled first, or this hook ran out of budget." It also says it is "an AbortSignal of the plugin's own environment, driven by the chain's".
- Present on `tool.call`'s `next`: **verified**.
  - `Events` (line 6390) gives every event that is not streaming `next: Next<E>`.
  - Only `turn.step` and `process.spawn` stream (line 16356), and `StreamNext` keeps `signal` (line 16374).
  - Executed too: P0a shows the mod's signal aborting when a hook above answers.
- The budget is 20 minutes for `tool.call`, not counted while `next(e)` runs (lines 6727–6733): **verified**.

## Findings
- **F1 (new; outside the ruling; the same on base and r1).** After a call is abandoned, any marker another session writes is still claimed, until both a main turn end and 64 writes have happened. That is an over-claim after the call has ended for the engine. Head releases only `openWindows`; `windows` and `turnWindows` keep the span with `to = ∞`.
  - Repro: `k4a.test.tsx`, which is K4 with an abandon unit A added (147 sequences).
  - Results: base 123 pass, r1 127, head 127. In head's misses, a marker placed after an A (SAC, SAO, SATC, SAWC, SAEC, …) is claimed.
  - At length 3, head reads exactly like r1. Head's release only shows from length 4 (S A T W C, as in L1 A-b evict=true).
  - Nearest fix, `h2/`: on abort, also set `span.to` to the clock time.
    - K4a: 147/147 match the contract; only the file-end rejection notice fails.
    - L1: all rows pass except A-b soon: after the abort, the N1 re-remember reopens the span to the call's end.
    - Full suite: 308/308 on a second run. The first run failed Q6-4 (store write order) once, which I read as a flake.
- **F2.** The README's two new sentences overstate the behaviour (L5a–d and the V3 contradiction). Suggested wording: "a call the engine has not ended or abandoned", and drop "every" (rewrites, back-dated markers, the 50-tree cap).
- **F3 (pre-existing, unchanged).** In K1b, when the end-time clock read rejects or never answers, the span stays open: over-claim on all three variants.

## Flags
- **Spike rules the change triggers but the sketch does not apply:**
  - Rule 2, sequences: "an interrupt … among the kinds". K4 had no abort unit, and the planner's tests have no A×T×W ordering. K4a above fills it and finds F1.
  - Rule 3: "every" in the README needs an enumerate row. L5 is that row, and it fails.
  - Rule 5, state left behind: the listener on a call that ended normally. L4 finds no effect.
- **Test expected values tied to the sketch:** none. V1–V5 use hand-written literals and the test's own `rows` helper.
  - V3 binds only against r1, and only after an eviction. With no eviction head would fail it (F1); no test pins that.
  - V3 and V4 pass on base.

## Not run
- The user interrupt: not expressible in the kit (P0b, P0d).
- The mod's own hook running out of budget: not reachable.
- A Bash command moved to the background by a turn abort: not expressible.
- Retained listeners: no heap view in the kit; only RSS was measured.
