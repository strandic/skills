## Review lane 3a (adversarial): skills-5w5c, run wave 3

All work is in `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/4223d73b-665c-4520-bc14-c05fe749bdb1/scratchpad/review3a/` (called R3A below). No repo tree was touched.

**Copies:**
- `base/` is 1f961fb, taken with `git archive`.
- `head/` is the worktree's mod folder at db50198.
- `head_i/` is head plus one instrumentation line.
- `headcopy/` is head plus a second copy of the module, `register2.tsx`.

**How to reproduce any line:** run `R3A/run.sh <variant> <part.tsx> <name>`. The script builds `tests/x.test.tsx` from `../attack2/helpers2.tsx`, `../attack/common.tsx` and the part file, then runs `claude plugin test` with the full binary path. Outputs go to `R3A/out/<name>.out`. Each probe prints one line that starts with `PROBE <id>`.

**Implementation against the sketch:** I re-checked it. The +/- lines of `git diff origin/main --relative=mods/shawarma-companion` equal those of sketch.patch (`diff` printed `SAME`). So I did not re-run the `enumerate:` rows K1, K4, K4a, L1 and L5.

### Attacks: control (base) and head readings

The parts are `a.part.tsx` (A1–A5), `c.part.tsx` (C1) and `r0.part.tsx` / `r0b.part.tsx` (R0). The A file ran twice on each variant, and the readings were identical both times. Its timing differed once: head 24 s against base 10 s. A rerun read 6.6 s against 11.4 s, so that was noise.

| id | probe | base | head | verdict |
|---|---|---|---|---|
| A1 | Liveness control: a long subagent call, an eviction (a main turn end and 64 writes), then the own marker written mid-call | `main-1`, `1 run in another worktree` | `main-1`, `other tree: wt-7` | Live. Only head passes. |
| A2 | A finite long call, an eviction, then another session's marker during the call. Then the call ends, a second eviction, and another 15 s check. | Never claimed. Store `claims:sess-1` = `["/repo"]`. | Claimed during the call (`other tree: other-1`). Still claimed after the call ended and after the second eviction. Store = `["/repo","/repo/.worktrees/v"]`. | Head-only reading. See O1. |
| A2r | Resume: a fresh load seeded with A2's store | `1 run in another worktree` | `other tree: stale: other-1` | The over-claim survives into the resumed session. See O1. |
| A3 | Own run `wt-7` claimed. Then a long call, an eviction, and 3 other sessions' markers during the call. | `main-1`, `other tree: wt-7`, `3 runs in other worktrees` | `main-1`, `other-3`, `other-2`, `other-1`, `wt-7`, in that order | Head-only reading. The own run is now the 5th row. See O2. |
| A4 | Hostile marker times during an open, evicted call: far future (+10 years) and `Infinity` | not claimed | claimed (`other tree: stale: other-1`) | Head-only. It matches the README ("a new marker another session adds … is claimed too"). Nothing threw. Holds. |
| A4 | Hostile marker times: `NaN`, `0`, `-Infinity` | not claimed | not claimed | Equal to the control. No verdict (liveness failure). Nothing threw. |
| A4 | A marker dated 10 s back | claimed | claimed | Equal to the control: it fell inside the eviction writes' own spans. No verdict. |
| A5 | README claim: a hook above answers first, the call beneath never ends, no eviction, then another session's marker | `other tree: other-1` | `other tree: other-1` | Base = head. The README sentence is false here (listed S1). |
| C1 | Doc comment "`windows` and `turnWindows` keep their own copy": the identity of the span objects (`head_i`) | n/a (no set on base) | `{"inWindows":true,"inTurn":true,"to":"Infinity"}` | The same object sits in all three, not a copy. See O3. |

**§3 error surface: holds.**
- No probe threw on base or head: 11/11 pass ×2 on each, NaN and ±Infinity times included.
- `readonly signal: AbortSignal` is in every bundled d.ts (2.1.325, 2.1.329, 2.1.330).
- `plugin.json` declares no engine floor. An engine with no `next.signal` would throw after `openWindows.add` and before `next(e)`, which would leave the span open for good. That case is NOT RUN: no engine older than 2.1.325 is available.

### Findings

- **O1 (own; §6 and the PR wording).** Worst impact covers more than §6 says. §6 names a call that never ends (V5) and S1. But a *finite* long call also over-claims: another session's new marker, listed after an eviction while the call runs, is claimed on head and not on base (A2). The claim does not end with the call. Claims only grow, so it stays after the call ends, a turn end and 64 writes. It is also written to `claims:<id>` in the store, so a resume restores it (A2r; CLAIM_TTL_MS is 30 days). By K2's reading it also carries over a `/clear`.
  - This follows the README's existing "same moment" rule and Q1's design, so it is not a code defect.
  - But §6's "for the rest of the session" and S1's "for one turn and 64 writes" describe how long the exposure window lasts, not how long the wrong claim lasts.
  - Reproduction: `run.sh head a.part.tsx X` against `run.sh base a.part.tsx X`; read the `PROBE A2` and `PROBE A2r` lines.
- **O2 (own; §6).** An over-claimed row can push this session's real run out of view. Rows sort own tree first, then newest first (`order`, model.ts:188-190). Another session's markers are newer, so they sort above this session's own run in another worktree. In A3 the own run `wt-7` is the 5th of 5 rows. With `maxRows` 4 the band scrolls (d.ts:13576-13577), so `wt-7` falls below the fold. On base it is the 2nd row. §6 says "the change cannot hide a call the engine still runs". It does not hide a call, but it can hide a real own row. The mechanism existed on base; the change widens the window in which it can happen. Reproduction: the `PROBE A3` line, base against head.
- **O3 (own; doc comment wording).** register.tsx:70 says "`windows` and `turnWindows` keep their own copy as before". They hold the same object by reference (C1). Attack round 1 F3 depends on exactly this: the `finally`'s `span.to = now` closes all three entries at once. Suggested words: "hold the same span, as before". Reproduction: `run.sh head_i c.part.tsx C1`.
- **S1 (listed).** README 2d says "A call counts until the engine ends or abandons it". It reads false for an abandoned call before any eviction: the span still claims through `windows` and `turnWindows` (A5, base = head). It is the same on base and the D3 ticket covers it, but the new README sentence states the opposite. Reproduction: `PROBE A5`.
- **D2's cost (listed).** It is not re-run. Only L1 can reach it, and that row is unchanged.

### NOT RUN lines (tried again)

**K5 hot reload: NOT RUN.** What I tried:
- R0a: the test `$` has no reload noun (`pluginKeys: []`, `engineKeys: []`).
- R0d: I loaded a second copy of the module (`hooks/register2.tsx`) as an inline plugin, `{ name: 'copy2', register }`. The kit refused the load: `HooksError: copy2: hooks module did not load: … $ is passed to "refresh", which is not a function declared at the top of this file …`. An inline plugin is built from its own source alone, so a module with many top-level functions cannot be loaded twice.

Missing resource: a kit reload API, or a way to load a second copy of a whole hooks module. What the d.ts says, unexecuted (d.ts:4194-4196): at a reload "the old copy's in-flight hooks settle". So the old copy's `finally` and its post-call `refresh` run in the old environment, and the new copy starts with an empty set, as on base.

**L1 user interrupt: NOT RUN.** What I tried:
- R0a: the test `$.turn` has only `start`, `step` and `complete`; there is no `abort`.
- R0b: I raised `$.session.stop({})` (the Stop event) on the test `$` while a call was held beneath. It answered `{"isTurnRunning":true}`, the call stayed `pending`, and the signal beneath stayed unaborted (`beneathAborted: false`).
- R0c: an inline prepend plugin called `$.turn.abort` while the call ran. The answer was `HooksError: no implementation for turn.abort`; nothing was aborted.
- Planner re-run: these repeat attack2's P0b and P0d, and the results are the same.

Missing resource: a kit way to abort a dispatch's chain signal other than a hook above settling first (V3).

### Call sites of the changed symbols (whole tree, `git grep -w`)

- `openWindows`: only `mods/shawarma-companion/hooks/register.tsx`. Declared at :72 (doc comment :64-71). Read at :251. Added to at :752. Deleted from inside `release` at :753.
- `release` (the new per-call function): register.tsx :753 (defined), :754 (already aborted), :755 (abort listener), :759 (first statement of the `finally`, comment :758). The other `release` names in `tests/band.test.tsx` (:2851-2896, :3026-3038, :3448 onward) are unrelated local gate functions. No other file has the symbol.
- `spans`: register.tsx :251 (built) and :256 (the only reader, in `claim`). The s6qg sketch.patch has the old copies of these lines (:342, :347). The skills-oz54 sketch.patch changes the `tool.call` hook next to them, which is a rebase concern only.
