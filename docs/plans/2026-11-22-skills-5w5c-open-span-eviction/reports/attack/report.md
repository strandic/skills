## Attack lane report: skills-5w5c (open spans nothing evicts), plan time

All work was done in scratch copies under `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/4223d73b-665c-4520-bc14-c05fe749bdb1/scratchpad/attack/` (called ATK below). `base` is the mod at 1f961fb. `head` is a copy of the spike worktree. Repo trees were not touched.

To reproduce any line: copy `ATK/base` or `ATK/head`, delete its `tests/*.test.tsx`, put the named file in `tests/`, then run `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test <copy>`. Each test prints its raw readings on a line that starts with its id.

### Controls (they match the planner's readings)
- head with band.test.tsx: 308 pass, 0 fail.
- base with the new tests: 305 pass, 3 fail (V1, V2, V5).
- Format probe (`ATK/probe0.test.tsx`), same on both: `["main-1 · trivial","other tree: wt-7 · trivial","2 runs in other worktrees"]`.
- The kit loads a fresh module for each test. A call left open in one test does not carry into the next (P0b, then P0c reads "1 run in another worktree" on head).

### Research report rows I relied on
- D:5892-5893, 17841-17842, 8349-8350, 6758-6762, 6393, 14727-14728, 396-405, 5954-5955, 159-161, 21584-21586, 21268-21276, 21664-21666 and R:122: **verified** (same file under all three bundle hashes, same md5).
- "past it the hook is absent (its `.catch` asked, else `next(e)` run on its behalf)": **verified, but at D:6742**, not D:6745-6746.
- D:4201-4206 (`now` has no documented failure mode): **verified** (D:4201-4205).

### K1: the ways `next(e)` ends
File: `ATK/attack.test.tsx`. Each ending runs after a long subagent call, a main turn end, 64 writes, an own marker written mid-call, then a 15 s check. Then the call ends that way, there is or is not a second eviction, and another session's marker appears 60 s later.

| Ending | How `next(e)` settled | base | head |
|---|---|---|---|
| normal | resolves | during `[main-1, "1 run in another worktree"]`, after `[main-1, "2 runs in other worktrees"]` | during `[main-1, "other tree: wt-7"]`, after `[main-1, "other tree: wt-7", "1 run in another worktree"]` |
| isError | resolves | same as normal | same as normal |
| deny | resolves | same as normal | same as normal |
| reject | rejects (checked through a store probe) | same as normal | same as normal |
| clock.now rejects in the finally | — | same as normal | same as normal |
| clock.now never answers in the finally | call stays pending | same as normal | same as normal |

- Each ending was run with and without the second eviction. The readings are the same both ways.
- Verdict: head passes all 12, and the "during" reading is one only head passes. The base reading is the under-claim (the bug).
- Sync throw: a Write with a numeric `file_path` makes the world's own synchronous handler throw. The caller gets `HooksError: no implementation for tool.call`. Base and head both read `[main-1, "1 run in another worktree"]`. This case has no mid-call window, so there is no head-only probe. Liveness comes from the other K1 cases.
- K1b (`ATK/k1b.test.tsx`): the same endings with **no eviction at all**.
  - normal, isError, deny, reject: base = head = `[main-1, "other tree: wt-7", "1 run in another worktree"]`. This is the contract.
  - clockReject and clockHang: **base = head = `[main-1, "other tree: other-1", "other tree: wt-7"]`**. This is an over-claim after the call ended. See F2.

### K2: `/clear` mid-call
The test raises `session.end` with reason 'clear', then switches the id to sess-2, while a long subagent call runs.
- With eviction before `/clear`:
  - base: during and after read `[main-1, "1 run in another worktree"]`. Store: `claims:sess-1=[/repo]`, `claims:sess-2=[/repo]`.
  - head: during and after read `[main-1, "other tree: wt-7"]`. Store: `claims:sess-2=[/repo, /repo/.worktrees/w]`; sess-1 stays `[/repo]`.
  - Follow-up (another session's marker 60 s after the call ended): head reads `[..., "1 run in another worktree"]`, so not claimed.
- Without eviction: base = head = the head reading above, with the tree under sess-2.
- Verdict: head passes. A span survives `/clear` on base too, so this is not new. The tree lands under the new id.

### K3: a main-loop long call
- Subagent turn end plus 64 subagent writes: base = head = `[main-1, "other tree: wt-7"]`.
- Subagent turn end plus 64 main writes: base = head = claimed.
- Both readings equal the control, so they show nothing alone. The subagent turn end correctly keeps `turnWindows`.
- Head-only probe, a main turn end plus 64 subagent writes: base `[main-1, "1 run in another worktree"]`, head claimed. Head passes.

### K4: every length-3 sequence starting with S
File: `ATK/k4.test.tsx`. I ran each sequence as is, plus once with a trailing C and once with a trailing O: 108 runs. The oracle is a contract function written apart from the mod; rows are compared sorted.
- head: 108 of 108 match the contract.
- base: 104 match. **It differs only on STWC, STWO, SWTC and SWTO**: it reads "1 run in another worktree" where the contract says claimed.
- No pure length-3 sequence differs from base. Both T and W must come before the marker, which needs length 4.

### K5
- Hot reload: **NOT RUN.** The kit has no reload. I searched the `claude-code/testing` module for reload, fresh and module: nothing. The kit only gives a fresh module per test (P0b/P0c). Per R:122, a reload starts with empty lists, so it could only under-claim. That was already true on base.
- `session.start` mid-call, then T, W, C: base `[main-1, "1 run in another worktree"]`, head claimed.
- S, `session.start`, E, then O 60 s later: base = head = not claimed.
- Verdict: head passes.

### K6: cost
- Setup: n=800 hanging subagent calls, one main turn end, then 20 checks. Each check lists m=200 new markers dated before every span, so `spans.some` scans every span. That is 864 spans on head and 64 on base. The fs list counter read 22, so every check ran.
- Process CPU (user+sys), two runs each:

| | n=800 | n=0 |
|---|---|---|
| base | 2.34 s, 2.08 s | 0.75 s, 0.72 s |
| head | 2.28 s, 2.19 s | 0.77 s, 0.71 s |

- In-test wall time at n=800: base 894 / 511 ms, head 545 / 461 ms.
- Verdict: no measurable difference.

### K7: hostile inputs
- K7a: the same event object dispatched twice at once. The kit allowed it, and each dispatch got its own span.
  - base: during `[main-1, "1 run in another worktree"]`, after "2 runs in other worktrees".
  - head: during `[main-1, "other tree: wt-7"]`, after `[..., "1 run in another worktree"]`.
  - Verdict: head passes. A reused span object cannot be reached from outside, because the hook builds the span itself.
- K7b: a long Read or Glob call, with another session's marker written during it. Base = head = `[main-1, "1 run in another worktree"]`. The non-writer claims nothing, unchanged from base. Head-only probe, the same with Bash: base not claimed; head `[main-1, "other tree: other-1"]` (the accepted over-claim while a call runs).
- K7c (`ATK/k1b.test.tsx` and `ATK/k7c2.test.tsx`): see F1.

### Findings
- **F1: an over-claim that may fall outside the ruling.** A plugin above answers the call after 5 s while the call beneath never answers. The caller gets `{result: "answered above"}`, so the call has ended for the engine. But our `next(e)` never settles, so the `.finally` never runs.
  - The span stays in `openWindows` with `to = Infinity`.
  - After an eviction, another session's marker 60 s later reads: base `[main-1, "1 run in another worktree"]`, head `[main-1, "other tree: other-1"]`.
  - The same happens when the call beneath is held by `clock.sleep`, a wait the kit says it drops when the dispatch aborts.
  - Each such call adds one span that is never removed, so the set has no bound.
  - A candidate fix: also delete the span when `next.signal` aborts (`ATK/head_sig`). It passes all 308 tests and fixes K7c/K7c2.
  - The trade-off: it under-claims if the tool beneath really keeps writing.
  - What is not known: whether the real engine settles `next(e)` in this case. That is the research gap at D:6758-6762. The evidence above comes from the kit only.
- **F2 (pre-existing, same on base): a failed end-time clock read keeps the call's span open.** If `$.clock.now` rejects or never answers in the finally, `span.to` stays Infinity. The span stays in `windows` and `turnWindows` until a main turn end and 64 writes. So another session's marker 60 s after the call ended is claimed (K1b clockReject and clockHang, base = head).
  - The sketch's comment "a clock read that fails or never answers cannot keep it open" holds only for `openWindows`.
  - The research (row 1f) proposed setting `span.to` synchronously first; the sketch does not.
- **F3: V3 checks nothing.** It passes on base. It passes the planner's three mutants. It also passes my mutant that releases only when the call resolves (`ATK/mut_then`: 308 pass).
  - The reason: `openWindows` holds the same object that the finally closes (`span.to = now`). A span left in the set is therefore harmless whenever the clock read succeeds (checked with a store probe in `ATK/instr2`).
  - Only V4 tells the order of the release apart. Rule 3 (a FAIL reading) fails for V3.

### Spike-rule flags
- **Rule 3, class words:** "cannot keep it open" is contradicted by K1b (F2). "Nothing evicts one" holds.
- **Rule 3, FAIL reading:** V3 has none (F3). V4 passes on base, but it has a mutant FAIL reading.
- **Rule 2, cases with no test in the sketch:** a sequence enumeration (K4), `/clear` (K2), a main-loop call through a main turn end (K3), `session.start` mid-call (K5), and a hook above settling first (K7c).
- **Rule 5, follow the state:** a span leaked by F1 is never removed and has no size bound. Nothing in the sketch follows it.
- **cost.md:** run as K6. No change found.

### Test expected values
V1–V5 hold hand-written strings in the README's row format. They agree with the base-observed format in P0a. I found no value computed by the mod's own code. I cannot prove where they came from.

### Ticket items with no test or follow-up
- The ruling says the never-ending-call limit is to be "stated in the PR".
  - The sketch has no CHANGELOG entry under 0.3.3.
  - The README's claim section says nothing about the over-claim for a call that never ends.
- The research's two suggested backstops are not ruled on or noted: setting `span.to` synchronously, and releasing on `next.signal`. They relate to F2 and F1.
- B1 from the ticket is covered by V1.

### NOT RUN
- K5 hot reload: the kit cannot reload a module within a test, and has no reload API.
- Planner mutants: not re-run. I re-ran only the controls and my own then-only mutant.
