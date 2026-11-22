## Attack lane report: skills-oz54 (bound every `$.session.*` call)

**Setup.** I made a scratch tree (`.worktrees/oz54-attack`) from f1ed7f4 with sketch.patch applied, and a base control tree (`.worktrees/oz54-attack-base`) from f1ed7f4. I removed both at the end. The oz54-spike tree and all tracked files are untouched.

Probes and raw outputs are in `/Users/jonathan/Documents/strandic-skills/docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/attack/`:
- probe sources: `probe.tsx`, `probe2.tsx`
- generator: `gen.py`
- logs: `run-patched.txt`, `run-base.txt`, `run2-*.txt`, `run3-*.txt`, `run-V-on-base.txt`, `sub-*.txt`

Probes measure in engine-clock steps of 200 ms (probe.tsx) or 100 ms (probe2.tsx). A reading of `ms=-1` means still not settled at the cap (60 s, or 30 s / 40 s where noted). A `ranAt`, `toolRanBy` or A5 `doneAt` value is the start of the step in which the event happened, so the true time is up to one step later.

**Plain suite on the patched tree:** `295 pass`, `0 fail`, `Ran 295 tests`. No end-of-file line.

### About the "(fail) the file ran to its end" line
This line comes from **existing tests, not from the change**. I appended 4 tests to each tree that only wait 4 s of real time. Both trees then printed the line, with the same text:

`a rejection nothing handled: environment 488/490/492/496: $.state.get refused: no hooks module of that name is loaded`

- Files: `sub-pad-patched.txt` and `sub-pad-base.txt`.
- So any run that goes on long enough after those tests shows it. That is why it appears with A1, A2, A6 and A7 on the patched tree.
- A5 run alone: no line, in 2 of 2 repeats.
- Likely source (not verified): `watch`'s `void stale($).catch(() => update(...))`. The `update` inside the catch can reject, and nothing handles that.
- In base runs, A7 / A7d / A7e / A1x tests that never answer hit the kit's 5 s real-time test timeout. That is the kit artefact you described.

### A1: one call made to never answer, alone (patched ms / base ms)
In the patched tree, every reached site settles in **2000 ms**, which is one give-up.

- tool.call main, no start:
  - 708 (cwd#1): tool ran 1800–2000. Base: -1, and the tool never ran.
  - 721 (cwd#2): 2000 / -1
  - 587 (usage): 2000 / -1
  - 210 (id) and 220 (root): 2000 / 2000. These were already bounded in the base, so the equal reading is expected, not a liveness failure.
- tool.call after start: 708, 721 and 587 are 2000 / -1.
- tool.call subagent: 708 is 2000 / -1. 397 (root#1) is 2000 / -1.
- cwd outside every tree: 419 (root#1) is 2000 / -1.
- turn.complete: 739 is 2000 / -1 (with or without a start). 587 is 2000 / -1.
- session.start: 587 is 2000 / -1. session.start makes no cwd call.
- 15 s check: 651 is 17000 / **30000**, and 587 is 17000 / 30000. The base does **not** hold past 60 s here: the next 15 s tick recovers it. So the oracle's base premise is false for the check path.
- ui.render with context on: 767 is 2000 / -1 (pending).
- Sites 398, 219 and the subagent fallback to cwd are reached only after another session call failed, so "alone" cannot be run for them. I ran each paired with an earlier rejection:
  - 398 never: 2000 / held
  - 219 never: 2000 / held
  - subagent 398 never: 2000 / held

Hand-counted bounds, all calls answering: a main tool.call makes 5 session calls, so a 10 s bound. The measured single-hang hold is 2 s, inside every bound.

### A2: cwd, root and usage answering at 1999 ms and 2001 ms
Field diffs are against the instant answer (at 1999) and against the rejection (at 2001).

- **cwd**
  - 1999: band and claim trees are equal to instant. `claims.at` is 1792152123998 vs 1792152120000.
  - 2001: band `[]` and claims `null`, equal to reject. Took 6000 ms (3 cwd calls).
  - Base at 2001: rows drawn, 4200 ms, so the control differs.
- **root**
  - 1999: equal to instant, except `at`.
  - 2001: band `["w…","1 run in another worktree"]` and claims `[w]`, equal to reject except `at` (+2000).
  - The base gives the same reading, because the site this scenario reaches (220) was already bounded. This reading is not binding on the change.
- **usage**
  - 1999: equal to instant.
  - 2001: band `[]`, claims unchanged, equal to reject.
  - Base at 2001: drawn.

### A3: rejecting vs never answering, 39 site pairs
- Band: equal in every pair.
- Claim trees: equal in every pair.
- `claims.at`: differs in 13 pairs. Never gives 1792152122000, reject gives 1792152120000, because the write lands 2 s later.
- Call counts: equal in every pair.

### A4: a late cwd (3 s) after moving to the worktree WT — wrong output
- seeded=none, late:
  - s1 to s3 (bash done; +3 s, when the late answers land; a 15 s check while still late): band and claims are unchanged. The late value changes nothing ✓.
  - s4 (a check that answers at once): claims grow to `[/repo, WT]`.
- **seeded=all, late, patched:** at s1–s4 the band reads `["m · trivial · since 14:00","other tree: w · trivial · since 14:00"]`. The session's working directory is WT the whole time. This persists even after s4's check, which got WT.
  - Instant-answer control: `["w …","other tree: m …"]`.
  - Base: the same as the control, after waiting 6000 ms.
  - So the band falsely labels the current tree "other tree:".
  - Reproduction: probe.tsx, test `A4 seeded=all late=true`.
  - Persisting past s4 is a pre-existing gap: `stale()` updates `mainCwd` but does not re-discover `own`.

### A5: two writing calls in parallel plus the 15 s check, cwd never answering
- Bash and Write each settled between 3800 and 4000 ms. Hand-counted bound: 4 s (708 + 721).
- The check settled within 2000–2200 ms after it fired. Hand-counted bound: 2 s (651).
- No end-of-file line on the patched tree (A5 run alone, twice).
- Base: all three settle times are -1.

### A6: another hook refuses clock.after, cwd never answering
- My first attempt failed. Registering a second `on('clock.after')` hook was refused with "registered twice", so those readings are void.
- Redo, replacing the handler:
  - Patched: refused=1, ms=-1 (still held at 30 s).
  - Base: ms=-1.
  - With cwd answering: patched refused=11, ms=0.
- This matches README:40 ("holds the update").

### A7: holds when calls never answer, context on
| Variant | cwd | start | Write | tool ran by | turn end | draw |
|---|---|---|---|---|---|---|
| a: all session + store never | /repo | 6000 | 10000 | 1800–2000 | 8000 | 200 |
| a | /elsewhere | 6000 | 10000 | 1800–2000 | 10000 | 0 |
| b: id answers, rest never | /repo | 6000 | 10000 | 1800–2000 | 8000 | 0 |
| b | /elsewhere | 6000 | 10000 | 1800–2000 | 10000 | 0 |
| c: id + store.get answer | /repo | **8000** | 10000 | 1800–2000 | 8000 | 0 |
| c | /elsewhere | 6000 | 10000 | 1800–2000 | 10000 | 0 |

In every variant the band is `[]` and the base is held.

Two more cases break README:40's numbers:
- **A7d, the 15 s check with all session calls never answering:** it settled **12 000 ms** after firing. It made 6 session calls (cwd 1, id 2, root 2, usage 1).
- **A7e, worst case** (cwd outside every tree, no start, 721 never, the rest answering at 1999 ms):
  - Write: **16 000 ms**, with **8 session calls** (cwd 4, root 2, id 1, usage 1).
  - With store calls also at 1999 ms: **22 000 ms**.
  - The tool ran by 1900–2000 ms.

Awaited bounded calls on each path (register.tsx lines in the patched tree):
- **Write:** 708, 721, then discover (only if the per-cwd cache misses: git run, one stat per scanned root, 419 if `own` is unknown, 398 if `mainCwd` is null), then 210, restore 295 (only until it succeeds), the prune deadline, 219 if `mainCwd` is null, 220, folder stats (up to MAX_RESOLVE), 254 if the store write is in doubt, 266 if claims grew, 587.
- **Turn end:** 739, then the same refresh.
- **Check:** 651, claim (210, 220), then refresh (210, 220, 587).
- **Render:** 767.

### A8: README "one update asks the session at most five things"
Hand counts of session calls, maximum per path:
| Path | Max calls |
|---|---|
| main tool.call | 8 (708, 721, 398, 419, 210, 219, 220, 587) |
| subagent tool.call | 7 (708, 397, 398, 419, 210, 220, 587) |
| main turn end | 7 |
| subagent turn end | 6 |
| session.start | 4 (6 if `e.cwd` is missing) |
| 15 s check | 6 (8 if `mainCwd` is null) |
| render | 1 |

The claim is false. Measured counterexamples: A7d (6 calls, 12 s) and A7e (8 calls, 16 s).

### A9: clock.after(2000) dispatches, every call answering at once
| | 1st Bash | 2nd Bash | turn end | render (context on) |
|---|---|---|---|---|
| patched, no start | 11 | +5 | +7 | +1 |
| base, no start | 8 | +2 | +5 | +0 |

- With a session start: the start makes 9 (base 8), then +5 / +5 / +7 / +1.
- These match the hand counts: a 1st Bash makes 708, 721, git run, 2 stats, id, store.get, prune, root, store.set, usage = 11.
- None fired after 10 s, in either tree.
- Cost note: every band render with context on now adds one timer dispatch and one cancel. Renders run at the redraw rate.

### A10: research quotes checked against the 2.1.330 d.ts
- 47 of 48 are verified at the cited lines.
- `d.ts:5060` ("On the terminal a new row is blank…") is verified but starts on line 5059, so the citation is off by one.
- The `d.ts:3132` "time limit" hit exists as described.

### A11: band row with context on, usage late
- Usage at 2.5 s:
  - Base draws the row at 2.6 s.
  - Patched returns `next(e)` at 2 s and draws **no row**.
- Usage at 25 s or never: patched draws none at 2 s.
- Per d.ts:5054 ("A repaint reuses the answer; a clock invalidates") and :5059-5061, a usage that answers between 2 and 30 s now turns a row that would be drawn into **no row**. That empty answer is reused on repaints until the next state write, props change or invalidate. My probe's next render did draw the row again.
- This is an absence, not false text. For a usage that never answers, the end state is the same in both trees: the base is blank for up to 30 s and then the hook is skipped; the patched tree is blank for 2 s and then returns `next(e)`.

### Other wrong output, pre-existing (the base gives the same reading)
A subagent call with no claims, where claim's root (220) fails, shows "1 run in another worktree". The marker is in the session's own tree. Reproduction: probe.tsx, test `A1 tool.sub.nostart root#2:never` (or `:reject`).

### Spike rules the sketch triggers but does not apply
- **Rule 3, class words:** README's "every 2-second limit", "each update", "at most five", "about 10 seconds" have no enumerate row. A7d and A7e are counterexamples.
- **Rule 3, FAIL reading:** **V7 passes on the base** (`run-V-on-base.txt`). Its `fired.length === 0` has no non-zero precondition such as "dispatched > 0", so it grades nothing. V1–V6, V8 and V9 do fail on the base.
- **Rule 2, partition:** there is no V test for these factor pairs:
  - a failed call followed by later slow-but-in-time calls (A7e)
  - the session.start hook
  - the check with several session calls (A7d)
  - a cwd move combined with a late answer (A4)
- **Rule 5, follow the state:** the stale `mainCwd` (A4 label) and `watch(false)` after a usage give-up are not followed. `watch(false)` stops the 15 s check until the next hook; this is the same as on a rejection.

### V tests and ticket coverage
- Expected values in V1–V9 are hand counts or the README rule, not copied from the sketch's output. V9's `cwdCalls: 4` matches my count.
- V1's title says "by 6 s" while its assertion is `held <= 4`. Its `held` count starts after a 2 s advance, so the two agree.
- Ticket items: every site has a test (V1, V2, V3, V4, V5, V6, V8, V9). The README's new numbers have no test, and they are false (A7d, A7e).
