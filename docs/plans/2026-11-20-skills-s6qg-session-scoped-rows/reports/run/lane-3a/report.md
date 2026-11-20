## Lane 3a report: skills-s6qg session-scoped rows (HEAD 0288b4a)

I ran 21 kit tests and 13 real-engine `-p` runs. I changed nothing in the worktree. I added two hooks to the scratch copy of the test world: `hold`, which can stall or replace any engine answer, and `after`, which keeps a tool call open.

Files:
- Tests: `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-3a-run/mod/tests/lane3a.test.tsx`
- Raw run: `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-3a-run/run4.txt` (`3 pass / 18 fail`; each test asserts what the contract wants, so a fail is a finding)
- Real-engine output: `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-3a-run/real/`

Every oracle is a hand-written literal or the store file read directly.

### One line per attack (raw reading)
1. **Worst impact, own run folded:** four ways found, executed (X1, X2, X3, X8 below; X2 also on the real engine). Store growth: one entry is about 187 bytes for a 2-tree session. The 4 MiB cap is about 22,400 entries kept 30 days, so about 750 sessions a day. Every `-p` run, `/clear`, `--fork-session` and session outside any repository adds one (X9).
2. **§3 error surface:**
   - Hangs: `session.id`, `session.root`, `store.get`, `store.keys`, `store.set` and `store.delete` that never answer each leave the Bash call unanswered after 62 s of engine clock (X6: `Expected: true / Received: false` ×7). `session.cwd` does the same; it is the control and also hangs on the base.
   - Odd shapes: `store.keys` answering null, `{}` or a string means the entry is never written (X7). `session.id` answering undefined writes the key `claims:undefined` (X7b).
   - The store is never written for an id whose entry failed to read: holds, as S24 shows.
3. **NOT RUN lines re-tried:**
   - P6 EnterWorktree: works now with `--allowedTools … EnterWorktree`. Store `claims:815e32e4…` = `['real/p6','real/p6/.claude/worktrees/p6x']`. Holds.
   - P6 `/clear`: works through `--input-format stream-json` with the messages spaced out. Id `2716f3ce…` had `['real/clr','real/clr/.worktrees/wt']`; after `/clear` the new id `843a0391…` has the same two trees. Holds.
   - `--resume` twice: same id both times, entry kept, `at` rewritten. Holds.
   - `--fork-session`: loses the claims (finding F5).
   - m16, claim interleave: holds (X4 pass, entry `[ROOT,V,WT]`). Store writes landing out of order lose a tree (F6).
   - Hot reload on the real engine: no reload happened (see NOT RUN).
   - B2, clock jumping back: emulated (X11).
4. **Hostile corpus:** a path with spaces, and a unicode path that git spells NFC while the working directory is NFD (real path NFD): holds (X10 pass). Many worktrees: F4. Marker names and store contents were covered by A4 and B6 and not repeated.

`enumerate:` rows A2, A3, B2, C2: the code is the same as the sketch, so not re-run.

### Findings

**F1 (own). A new marker absorbed by the 15 s check while the writing call is still running is never claimed. Reproduced on the real engine.** The marker is added to `lastSeen` with no span recorded yet, so the call's own refresh skips it.
- Kit, X2: `{during: 1, rows: ["main-1 · trivial", "1 run in another worktree"]}`. The control X2c (no check in between) passes.
- Real engine: in a repository with a row drawn, `printf 'x1\ntrivial\n' > .worktrees/wt/.shawarma/active-x1; sleep 25` stores `claims:9f10339a…` = `['real/long']`.
- Controls: `sleep 1` gives `['real/ctl','real/ctl/.worktrees/wt']`. `sleep 25` with no row drawn (so no check) gives `['real/nocheck','real/nocheck/.worktrees/wt']`.
- The worst impact: the session's own run shows only as "1 run in another worktree". A Wave 0 Bash call that writes the marker and then keeps running more than about 15 s triggers it whenever any row or the more-row is drawn.

**F2 (own). A parallel call's refresh absorbs the marker the same way.** X3: a long Bash call writes the marker at t+10 s. A Write in another tree at t+14 s (outside the 2 s slack) refreshes first. Result: `["main-1 · trivial", "1 run in another worktree"]`. Parallel subagents or tool calls do this.

**F3 (own, close to B5/C5). The first listing after the mod loads never claims a new marker.** Its code is `if (seen === null …) continue`. X1: the first event writes `mark WT wt-7` and the result is `["main-1 · trivial", "1 run in another worktree"]`. S23, which runs `bash true` first, passes. On the real engine `session.start` lists first, so only a hot reload (no `session.start`) exposes this.

**F4 (own). A claimed tree that is not the current one, past `MAX_TREES` = 50 in git's order, is never scanned.** X8 has 56 worktrees. After cd into t54 and a marker written there: `['far-1 · trivial','other tree: main-1 · trivial','6 worktrees not scanned']`. After cd back to ROOT: `["main-1 · trivial", "6 worktrees not scanned"]`. The own run is gone, only counted. `scanned()` puts the current tree first but no other claimed tree. D8 and C6a cover only the link-spelled case.

**F5 (own, real engine). `--resume <id> --fork-session` gives a new id in a new process, so neither the stored claims nor `lastClaims` carry over.** The parent `399a8007…` holds `['real/ctl','real/ctl/.worktrees/wt']`, and that conversation wrote `wt/.shawarma/active-x1`. The fork `62b72a2b…` holds `['real/ctl']`, so its run in wt is folded.

**F6 (own; real engine ordering unknown). Store writes landing out of order lose a tree for good.** X5: call A's `store.set([ROOT,WT])` is held while call B's `store.set([ROOT,WT,V])` lands. A's then lands, and the entry stays `["/repo","/repo/.worktrees/w"]`. Later refreshes see no growth and an id equal to `storedFor`, so they never rewrite it. A `--resume` would then fold V. This needs the engine to reorder `store.set` calls, which I could not observe.

**F7 (own). No 2 s bound on the new engine calls.** `restore` and `claim` await `session.id`, `session.root` and every `store.*` call without `within()`. A slow store blocks every writing tool call's answer for as long as the store takes (X6). `process.run` and stat are raced; these are not. §3 names "slow (past 2 s)".

**F8 (own, low).**
- X9: a session in no repository stores `["claims:sess-1", { trees: [], at: … }]`. Every session writes an entry, which feeds the growth arithmetic above.
- X7: if `store.keys` breaks its contract, nothing is stored for the session.
- X7b: `claims:undefined` would be one key shared by every session.

**F9 (listed B2).** X11: an entry another session wrote while this machine's clock read 31 days ahead (the same state as a clock jumping back) is deleted as future-dated. Received `["claims:sess-1"]`, so that session loses its `--resume` claims. This is D5's rule behaving as written; I note the consequence.

### NOT RUN
- **Hot reload on the real engine (B5, C5):** in a `-p` run, editing the mod copy's `hooks/model.ts` (`claims:`→`claimz:`) mid-session caused no reload. No `claimz:` key appeared, and the entry `claims:5caaa0ff…` has `['real/reload2','real/reload2/.worktrees/wt']`. Missing: an interactive session where the engine reloads mods. F3 is the kit stand-in.
- **A real clock jump:** the kit refuses a negative advance, and moving the system clock needs admin rights. X11 emulates it.
- **Real-engine `store.set` ordering (F6):** no way to delay the engine's store.

### Housekeeping
My runs left 11 `claims:` keys in `~/.claude-personal/plugins/store/shawarma-companion_inline-745bc5609816.json`. Their trees are under `…/lane-3a-run/real/`. I did not delete them because another session may be writing that file at the same time; they are pruned after 30 days. The two keys that were there before are untouched.
