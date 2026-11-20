## Attack lane report: skills-bnbu (with skills-6y0d)

I changed nothing in the repo or its worktrees. All work is in /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/218a355e-cdd3-44c2-abd8-54702ab71064/scratchpad/bnbu/attack/

- **Trees.** `base/` is `git archive 2e63362`. `sketch/` is the same with sketch.patch applied (`git apply --directory=mods/shawarma-companion`).
- **Full suites.** Base reads 277 pass / 0 fail. Sketch reads 283 pass / 0 fail.
- **Attack copies.** `base-a/` and `sketch-a/` are the mod with band.test.tsx removed. Each holds `tests/attack.test.tsx`, which is band.test.tsx lines 1–222 (`world()` and helpers) followed by `attack.tsx`.
- **Command.** `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test <dir>-a`. Both read 41 pass / 0 fail. Raw output is in `base-run.txt` and `sketch-run.txt` (lines starting `READING`).
- **Python oracles.** `py/fnv.py` is an independent FNV-1a over UTF-16 code units plus a rotation simulation. `py/quotes.py` checks the research report's quotes.
- **How I measured.** Held ms is engine time on the mock clock, advanced in 100 ms steps (1 s steps after 30 s). Delays use the kit's `clock.sleep(ms)` inside `hold`; probe P1 confirmed it resolves in order. A=answers at once, slow=answers in 1.9 s, rej=rejects, never=never answers.

**Oracle caveat (applies to A1–A6, A9 and D1–D6).** The held-ms instrument is the same mock clock that drives the mod's deadline. The store Map is the same fake `world()` that the sketch's own tests use. So these oracles share an environment with what they grade. I ran them anyway, because no independent clock exists. The hand bounds and hand key sets are independent.

### A3: each store call × each answer mode (store: own fresh entry, f1–f3 fresh, e1–e3 expired, u1 future, m1 malformed)
| row | base held ms / deleted | sketch held ms / deleted |
|---|---|---|
| keys A | 0 / e1,e2,u1,m1,e3 | 0 / same |
| keys slow | 1800 / same five | 1800 / same five |
| keys rej | 0 / none | 0 / none |
| keys never | 1900 / none | 1900 / none |
| get A | 0 / five | 0 / five |
| get slow | **15100** / five | **1900** / e1 |
| get rej | 0 / none | 0 / none |
| get never | 1900 / none | 1900 / none |
| delete A | 0 / five | 0 / five |
| delete slow | **9400** / five | **1900** / e1 at return, e1+e2 after 10 s more |
| delete rej | 0 / none | 0 / none |
| delete never | **9900** / none | **1900** / none |

- **Verdict: holds.** The sketch never exceeds the hand bound of 2 100 ms. No fresh entry is deleted in any row.
- **Liveness.** 10 of 12 rows equal the control, so they do not probe the change. Only "get slow" and "delete slow/never" separate base from sketch.

### A1: two passes at once for a new id (session.start and Write, reads answering in 1.9 s)
- Base: held [17000, 17000], 18 gets, 10 deletes. All five expired entries deleted. f1–f3 kept; `claims:new-1` written as [/repo].
- Sketch: held [3800, 3800], 6 gets, 2 deletes. Only e5 deleted, by both passes. f1–f3 kept; `claims:new-1` written as [/repo].
- **Verdict: holds.** The hold is under 4 000 ms, the live entries are kept, and the new entry is written.
- **Note.** Two passes for the same id start at the same offset (pruneStart('new-1', 8) = 7, by Python). So the second pass repeats the first one's read and delete. It is harmless but makes no extra progress.

### A2: /clear (id a → b) one second into a pass
- Base: held [8400, 9400, 0, 0].
- Sketch: held [2800, 3800, 0, 0].
- Final store in both: `claims:a` and `claims:b` both [/repo], f1 kept. The sketch keeps e2 and e3 (it deletes less).
- **Verdict: holds.**

### A4: a delete held 2.5 s that then lands; in the "rewrite" variant, the entry's owner rewrites it fresh 1 s into the hold
- Without a rewrite: base deletes e1 and e2; the sketch deletes e2, and that delete lands after its deadline. Neither deletes a live entry.
- **Finding, present in base and sketch.** With the rewrite, base deletes 2 freshly rewritten live entries (e1, e2). The sketch deletes 1 (e2).
  - This is the read-then-delete race. The store has no compare-and-set, and a late delete still lands after the pass returns.
  - It errs in the forbidden direction (deleting a live entry). The sketch neither introduces it nor fixes it. The plan should state it as an accepted residual risk or address it.
  - Reproduction: `A4 rewrite=true` in attack.tsx.

### A5: the deadline timer never fires (`hold['clock.after']` returns never, or throws)
- How I checked that the kit can refuse a timer: the hold was called (afterDispatches = 7 on base, 6 on sketch).
- With a hanging read: base >60000 ms, sketch >60000 ms, for both "never" and "throws".
- Control without a hanging read: both 0 ms.
- **Finding (liveness: the sketch reading equals the control).** The sketch adds no bound when `clock.after` is refused or dropped. Every RUN_MS bound in the mod has the same weakness. The README and CHANGELOG say "stops 2 seconds after it starts" without that condition.

### A6: key lists (per-key diff after one call)
- Both versions read the same on: [], own key only, 1 other, 100 mixed, a string, an array-like object, null, an array with non-strings (e1 and e2 deleted, f1 kept), keys without the `claims:` prefix (only `claims:e1` deleted), and duplicates or absent keys (e1 deleted).
- 101 mixed (every third key fresh): base 66 deleted, sketch 67. Python predicts 67 from start 94.
- 5000 mixed: base 66 deleted (k1…k98), sketch 67 (k3137…k3236). Python predicts start 3137, 67 deleted, the same first and last keys.
- No fresh or unprefixed key was deleted in any case. Gets ≤ 100 in all cases.
- **Verdict: holds.** Only the 101 and 5000 rows probe the change.

### A7: pruneStart against an independent Python FNV-1a over UTF-16 code units
- Ids: '', 'a', a 10 000-char id, 'a😀b' (code units 97, 55357, 56832, 98), sess-1/2/a, b, c.
- Counts: 0, 1, 2, 151, 2^31, 51, 152, 5, 8.
- All 81 values match Python exactly. All are integers in [0, n), and 0 when n = 0.
- Base reading: pruneStart is undefined.
- **Verdict: holds.**
- **Side notes.** pruneStart('a', NaN) returns NaN. A fractional count can give a fraction. Neither is reachable, since the count is always `keys.length`.
- **Finding (docs).** Ids can share a start: pruneStart('sess-1', 151) = pruneStart('a😀b', 151) = 6. "Each session starts at a different entry" (README and CHANGELOG) overclaims. Suggest "usually a different entry".

### A8: rotation (one never-answering key inserted first, 150 expired, 50 ids in turn)
- Base: 150 left after every one of the 50 ids.
- Sketch: [100, 33, 12, 1, 0 × 46]. Max held 1900 ms. The hanging entry is kept.
- The Python simulation gives the same 50 counts, one by one. It includes each id's own entry being appended to the store.
- **Verdict: holds.**

### A9: 5000 fresh other keys, fast answers
- Base: 100 gets, 0 deletes. Sketch: 100 gets, 0 deletes.
- **Verdict: holds.** It equals the control, so it is a regression check only, not a probe.

### A10: research report quotes, sections 1–3
- **Verified at the cited lines:** store get/set/delete signatures and the get doc; "where it lives" (4106–4110); key order (4131–4133); size limit (4122–4125); the `'store.get'` event at 8821; HookBudget (6289–6292); `now` (4189–4194); `after` and `every` (4210–4224); the 2.1.329 reload sentence (4183–4186); ref L262–264; ref L264 "is made again"; `next.signal` (7908–7913); lingerMs (6316–6324); session end (14277–14279); register.tsx@a70d50c:598 and :663; the validate line (re-run: "gating hook without .catch: tool.call").
- **Verified, at slightly different lines:**
  - `keys: () => Promise<string[]>` is at d.ts:4135, cited 4112–4134.
  - "a timer after the hook returned" is at 3865–3866, cited 3866.
- **Paraphrased** (shortened or re-punctuated, meaning kept):
  - 7494: the original continues "budget, so this is how a hook bounds the completion".
  - 3335: "directory; keep the value…".
  - 4199–4200 (sleep): the quote stops mid-sentence.
  - 6321: the original starts "Past it the hook is reported…" and ends "…without it when the signal aborted."
  - 4845–4846: the original adds "answers a wrong shape" and "or its last `next` result stands".
  - 8583: the `store.get` event is multi-line (`'store.get': {\n key: string;\n}`).
  - ref L259–262: the quote ends with a full stop where the original continues "`$.clock.after`, whose timers…".
- **Paraphrased and out of context:** ref L266, "the process is exiting (… in a `session.end` hook after a SIGTERM: nothing runs)". It describes `$.ui.notify`'s `no-surface` reason, not session end in general.
- **Paraphrased:** the skill sentence "A reload runs `register` and `session.start` again … the module's own variables start over." The loaded skill text reads "A reload is a fresh load of the module: `register` runs again and `session.start` fires again. … the module's own variables start over." It exists only in session transcripts, not in a file on disk.
- **2.1.325 sentence:** verified at 2.1.325 d.ts:3675–3676 (/private/tmp/claude-502/bundled-skills/2.1.325/fe24984dd019d08e1e8f2f14d06e241d/plugin-authoring/types/claude-code.d.ts).
- No quote was not found.

### My own attacks (deadline and skip rule)
- **D1, every other read rejects, 300 expired.** Base 0 ms, 1 get. Sketch 0 ms, 100 gets. Nothing deleted in either. Holds.
- **D2, a live entry's read rejects once, then reads fine in the next session.** Kept both times, in both versions. Holds.
- **D3, a read answering exactly at the deadline.** Base 3900 ms, both expired entries deleted. Sketch 1900 ms; the timer wins the tie, so nothing is deleted. Holds.
- **D4, every read rejects after 1.9 s, 50 expired.** Base 1800 ms, 1 get. Sketch 1900 ms, 2 gets. Nothing deleted. Holds.
- **D5, a get answers undefined for a live entry.** Deleted in both, because undefined parses as malformed. Finding, present in both, not introduced: a hook or fault that answers none for a listed live key deletes it.
- **D6, two session.starts plus a Bash call at once (a reload).** Base [7500 ×3]. Sketch [3800 ×3]. f1 and the own entry kept. Holds.

### Spike-rule flags
- **Repeats over input are bounded.** The loop runs at most min(n, 100) times; the key filter is O(n); pruneStart is O(length of id).
- **Persisted state carried through the next calls holds** (A2, A4, A8).
- **A second pass is idempotent but repeats the first.** Same id gives the same offset, so the same keys are read and deleted again (A1).
- **A late delete still lands** after the pass returns (A3 delete slow; A4).

### Independence of U1–U5
- U5 [6, 26, 36, 1, 0, 0], U4 [50, 16, 0] and S30's "pruneStart('sess-1', 151) = 6" all match my independent Python. I cannot tell from the files whether the plan derived them by running the sketch.
- U1's counts (5 and 3) follow from the hand count in its comment.

### Ticket items with no test in the sketch
- bnbu: the hold at **session start**. U1 and U2 drive only Bash. My A1 and D6 cover it (sketch 3800 ms, base 17000/7500 ms).
- 6y0d: the B6 scale (4999 entries over three ids) is not reproduced. U4 uses 150.
- CHANGELOG "it now stops 2 seconds after it starts": the first call is actually held up to about 4 s (the own read's 2 s plus 2 s; U1 reads 3.9 s; A1 3800 ms), and has no bound when the timer is refused (A5). The wording should say this.
