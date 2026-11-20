## cm2l attack lane: sketch on 1eed2e3 compared with the base

**Setup.** I made two throwaway worktrees at 1eed2e3: `attack-wt` with the sketch applied, and `base-wt` unpatched. Both have since been removed.

**Probes.** The probe file is `tests/attack.test.tsx`: harness lines 1–222 of band.test.tsx, plus the probes in the planner's scratch folder (`probes-kept.tsx`, local only). Each probe prints `R|id|json`.

**Commands.** Every run used `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion`.
- Committed suites without my file: sketch 283 pass / 0 fail, base 277 pass / 0 fail.
- With my file: every probe passed except A10, which failed on a double pane mount; I split A10 into three tests and reran.

**Two limits on what I could inject:**
- A `state.get` or `state.set` hook that throws falls through to core. bean skills-0wsk notes the same. So `read` and `update` of atoms cannot be made to reject.
- In the fake world, `fs.read` of a missing file returns `''`, not an error. A7 uses `hold` to make it reject instead.

### Readings

**A1 (one failure inside a check pass, then the error clears).** Band during the failure → band one pass after.

| await | base | sketch |
|---|---|---|
| marker read | `[]` → `[]` | `shawarma: skills-x: could not be read` → `… · 2 decisions` |
| plan.md read | `[]` → `[]` | same pattern as marker read; after shows the new title |
| decisions.md read | `[]` → `[]` | same pattern as marker read |
| `exists` after a failed list | `[]` → `[]` | same pattern as marker read |
| usage, clock.now in snapshot | `[]` → `[]` | `[]`, pane `Shawarma state could not be read.` → full row |

**holds.** On the base the check stops, which reproduces the ticket's bug. Pane on the sketch: `shawarma: skills-x: could not be read (/repo/.shawarma/active-skills-x)`.

**A1+ (probe `A1+ list once` / `A1+ stat once`): finding, not fixed by the sketch, identical on both.**
- One failed `list DIR`, or one failed stat (`stat once DIR`), during a pass gives: `skills-x · 202… · run W1 · since 14:01 · 0 decisions · plan dir not readable: …/2026-10-16-skills-x-thing`.
- It is still drawn after 15 s and after 60 s, with every call answering again.
- Each later pass only calls `exists DIR`. The answer is `true`, which equals "not readable", so no refresh starts and recovery waits for a tool call.
- `0 decisions` is shown while decisions.md holds 2: a wrong count.
- Reproduction: write the marker, set a new decisions.md time, `fail.add(\`list ${DIR}\`)`, advance 15 s, `fail.clear()`, advance 60 s, read the band.

**A2 (labels on an unreadable row): holds.**
- No label: `shawarma: u: could not be read`.
- Other tree: `other tree: shawarma: u: …`.
- Stale: `[dim]stale: shawarma: u: …`.
- Earlier session: `[dim]earlier session: shawarma: u: …`.
- Other tree and earlier session: `[dim]other tree: earlier session: …`.
- All match `labelOf`. The pane shows the same text plus `(marker path)`. Base: `[]` and `1 marker could not be read.`

**A3 (each uncaught await in `stale()` throws once).**
- `$.clock.now` at the end of `stale()` (holds):
  - sketch: band `[]`, pane failed, more-row gone; after one pass, the row and `1 run in another worktree` are back (6 fs calls).
  - base: during `["[dim]1 run in another worktree"]` (bean skills-0wsk reproduced), after: more-row only, 2 fs calls.
- NOT RUN: `read` of rowsAtom/hiddenAtom/claimsAtom, the `update` calls in `refresh()` and at the end of `stale()`, `claim`'s `update`. These hooks fall through to core.

**A4 (failed() itself refused): NOT RUN** for the refusal (`state.set` cannot be made to reject). Partial reading with clock.now failing for good: sketch 11 fs calls in 60 s, no unhandled rejection; base 3. The `.catch(() => undefined)` covers it by reading the code.

**A5 (a failed refresh with no check running): holds.**
- Tool call 0, turn end 0, `band:false` 0 fs calls in 60 s, on both.
- This reading is the same on both, so I ran the nearest wrong fix: drop `&& check !== null`. It reads 8 and 8, and G1 fails. So G1 does have power.

**A6 (reload with an unreadable row in state): holds.**
- First draw `shawarma: skills-x: could not be read`. After one pass: full row when the files read (8 fs calls), the unread row when they still fail. Base after the pass: `[]`.

**A7 (marker deleted between its listing and its read): holds.**
- Pass 1 shows the problem row; the `stale:` label is only because my probe dated the marker in the future. Pass 2: `[]`. Base: `[]` on both passes.

**A8 (decisions.md read hangs, 120 s): pre-existing finding, identical on both.**
- 1 row and 20 rows give the same reading: 8 passes, 8 hung reads (one more each 15 s, no limit), 24 fs calls.
- The band keeps the old `1 decision` while the read is pending. That is a value from before a read that never finishes.
- The sketch adds no hung calls.

**A9 (cost, fs calls per pass).**

| unreadable markers | sketch | base |
|---|---|---|
| 1 | 2 | 0 |
| 5 | 6 | 0 |
| 20 | 21 | 0 |
| 40 | 21 (20 rows + `+20 more not shown`) | 1 |

**holds.** The bound is 1 + 120.

**A10 (the pane): holds.**
- Opened by the command: `shawarma: a: could not be read (/repo/.shawarma/active-a)\nOther tickets: b (earlier session)`.
- Pressing row a: the same text.
- Pressing row b: `earlier session: shawarma: b: could not be read (/repo/.shawarma/active-b)\nOther tickets: a`.

**A11:**
- **a. A refused `clock.every` period** (`hold['clock.every']` rejects once): finding, pre-existing, identical on both.
  - 0 fs calls in the next 60 s, and the band keeps `run W1` after the marker changed to W2. That is out-of-date content.
  - `check` stays non-null, so the `watch(true)` call on each draw never restarts it.
  - The research report (F:3710) says a refused period ends the interval.
- **b. "Runs forever."** With clock.now failing for good and the marker present: sketch 83 fs calls in 600 s with an empty band; base 3. After the marker is gone: 0 calls (the check stops). This matches the Q3 ruling.
- **c. decisions.md unreadable at a tool-call refresh:** sketch `shawarma: skills-x: could not be read`, base `[]`. **holds.**

### Flags

**Spike rules the diff triggers that the sketch's tests do not apply:**
- Bound every repeat (cost.md): Q2 re-reads without limit, and no test bounds calls per pass over n. A9 supplies the reading.
- Blind partition / enumerate: Q1 says "never a value read earlier", but only the decisions.md read is tested inside the check. There is no test for the marker read, plan.md read or `exists` (A1 rows), for labels (A2), or for the command opening the pane (A10).
- Unfollowed state: an unread row kept in state across a reload has no test (A6).
- Every rule needs a FAIL reading: G1 reads the same on the base (0 = 0). It has power only against the wrong fix in A5.

**Expected values that may not be independent of the sketch:**
- C3's regex `/^skills-x · 2026-1… · run W1 · .*plan dir not found/`: the truncation `2026-1…` looks copied from the sketch's output.
- The `21 markers` test: the order u-20…u-01 and the pane's `Other tickets` list look copied from output, though the order agrees with Q6 (newest first).
- R3-2 and R2 ×2 follow the existing `problemLine` format, so they are independent.

**Ticket items with no test:**
- bean skills-cm2l (one failed check empties the row): the "a single fs error" class is not covered for a failed plan-dir list or stat (A1+), which still leaves a degraded row until the next tool call. There is also no test for the marker read or plan.md read failing inside the check.
- bean skills-0wsk (a throwing check keeps the more-row): covered by C4.
