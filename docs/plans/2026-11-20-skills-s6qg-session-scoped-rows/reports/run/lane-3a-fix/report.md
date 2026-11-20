## Lane 3a, review-round fix (HEAD d5ce6ef): report

I made no changes to the worktree. All work is in `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-3a-fix/`. Every oracle is a hand-written literal or the store file read directly.

Files:
- My tests: `…/lane-3a-fix/own/fix.test.tsx` (the band.test.tsx world plus A1–A10).
- Kit output on d5ce6ef: `…/lane-3a-fix/own-post2.txt` and `…/lane-3a-fix/own-post3.txt`.
- The same tests on 0288b4a, as a control: `…/lane-3a-fix/own-pre2.txt`.
- Real-engine runs: `…/lane-3a-fix/real/` (`runall.sh`, `runall2.sh`, `p6.sh`, `read.py`, and the `*.json` / `clr.out` outputs).

### Call sites (hooks/register.tsx)
- `claim`: defined :206. Called by `snapshot` :534 and `stale` :609.
- `restore`: defined :281. Called from `claim` :211.
- `scanned`: defined :501. Called by `discover` :367, `snapshot` :531, `stale` :605.
- `bounded`: defined :173. Used at :208 (`session.id`), :218 (`session.root`), :258 (`store.set`), :283 (`store.get` own key), :289 (`store.keys`), :293 (`store.get` other keys), :295 (`store.delete`).
- `within`: defined :161. Used by `bounded` :174, `run` :181, `realOf` :187, `isPlanInside` :448, the pane :791.
- `storedFor`: declared :27. Read :250, set :259, reset :646 (session.start).
- `storedCount`: declared :29. Read :250, set :260. session.start does not reset it; this does no harm, because `storedFor = null` already forces a write.
- Call-span objects: `turnWindows` :50, `windows` :60. Read in `claim` :241. Pushed at :668–669 as `{from, to: Infinity}`. `to` is set in `finally` at :670. `turnWindows` is cleared at :696 (main turn end).
- The `tool.call` hook: :661–683.

### Attack 1: re-running F1–F8 on d5ce6ef
- **Kit, Q6-1 to Q6-10 in band.test.tsx:** all pass. The whole file passes: 276/276.
- **Kit, the original lane3a.test.tsx (X1–X11):** 18 pass, 3 fail.
  - X1 (F3) fails: `["main-1 · trivial","1 run in another worktree"]`. Accepted as W3-D1.
  - X6 with `session.cwd` hanging fails: `Received: false`. Accepted as W3-D3.
  - X11 (F9) fails: `["claims:sess-1"]`. Accepted as W3-D4.
  - X2, X3, X4, X5, X6 (id, root, store.\*), X7, X7b, X8 and X10 pass. Raw output: `…/lane-3a-fix/run1.txt`.
- **F1 on the real engine:** `printf x1 > wt/.shawarma/active-x1; sleep 25` stores `claims:840e40e7` = `['f1','f1/.worktrees/wt']`. Holds: on 0288b4a this run gave `['real/long']` only.

### Attack 2: the round's new lines
Each line gives what I expected, what I got on d5ce6ef, and what the same test gives on 0288b4a.

- **A1, another session's marker during a long call, listed by the 15 s check:**
  - d5ce6ef: rows `["main-1 · trivial","other tree: other-1 · trivial"]`, store `["/repo","/repo/.worktrees/w"]`.
  - 0288b4a: holds (not claimed).
  - Real engine: another process wrote `wt/.shawarma/active-o1` 22 s into the session, during `echo start; sleep 45`.
    - d5ce6ef: `claims:a881d410` = `['oc','oc/.worktrees/wt']`.
    - 0288b4a: `claims:b2b4d324` = `['ocpre']`.
- **A2, a subagent call that never ends; another session's marker 10 min later, seen by the check:**
  - d5ce6ef: `["main-1 · trivial","other tree: other-1 · trivial"]`.
  - 0288b4a: holds.
- **A3, a long subagent call that outlives a main turn end and 64 main Writes, and writes its marker at its end:**
  - d5ce6ef: `["main-1 · trivial","1 run in another worktree"]`.
  - 0288b4a: passes (`other tree: wt-7`).
- **A4, A's `store.set([ROOT,WT])` given up on at 2 s, B lands `[ROOT,WT,V]`, then A lands late, then 3 more calls:**
  - d5ce6ef: `afterB [ROOT,V,WT]`, then `final ["/repo","/repo/.worktrees/w"]`.
- **A5, 100 other `claims:` keys whose `store.get` never answers:**
  - d5ce6ef: `{advances: 100, others: 0}`, where I expected `{advances: 1, others: 100}`.
  - 0288b4a: hangs, `{advances: 400, others: 100}`.
- **A6, 56 trees, a Bash call from ROOT writes a marker into tree #55 (no cd):** `["main-1 · trivial","6 worktrees not scanned"]`. 0288b4a gives the same.
- **A7, a Write into tree #55 from ROOT:** after that call, `["main-1 · trivial","6 worktrees not scanned"]`. After the next call, `[…,"other tree: far-1 · trivial",…]`. So the gap lasts one refresh only.
- **A8, the id changes (`/clear`) while call A is paused inside `claim`:** holds. `claims:id2` = `[ROOT,WT]`.
- **A9, a call whose tool throws closes its span; another session's marker 60 s later:** rows hold, `["main-1 · trivial","1 run in another worktree"]`. My oracle for the thrown text was wrong: the kit says `HooksError: no implementation for tool.call`. The call still threw, and the span still closed.
- **A10, cost when `store.set` always rejects:** 10 sets over 10 calls. With sets that land, 1. The shape is the same as before the round; with a hung store, each writing call pays 2 s.

### Findings
- **N1 (own; a regression from this round; worst impact).** The span is now pushed at the call's start. A long call's span is therefore the oldest in `windows`, and 64 newer writing calls evict it. A main turn end clears `turnWindows`. After both, the marker the long call writes at its end claims nothing, and the session's own run reads "1 run in another worktree". This takes a background subagent's long Bash call running across a main turn end. Reproduction: A3, which passes on 0288b4a.
- **N2 (own; F6 fix incomplete; worst impact after `--resume`).** A store write that the 2 s race abandoned can still land later. Its `.then` never runs, so `storedCount` keeps the larger, newer write's size (3). The entry stays `[ROOT,WT]` for good, and a `--resume` would fold V. Reproduction: A4.
- **N3 (own; from the new line :293).** When another session's `store.get` runs past 2 s, the timeout reads as a malformed entry, and that session's live claims are deleted. With all 100 hung, the first writing call took 100 × 2 s = 200 s of engine clock and deleted all 100 entries. The bound is per call, not per `restore`. Reproduction: A5.
- **N4 (listed as B2a; this round widens it, executed on the real engine).** A span open from the call's start claims any new marker another session writes during the call, even when an earlier listing saw it. A call that never ends (A2, own) does this for the rest of the session. This is an over-claim, the safe direction under §6. Reproductions: A1, A2, and the real-engine `oc`/`ocpre` pair.
- **N5 (own; F4 residual; not from this round).** A Bash call writes a marker into an unclaimed tree past the 50-tree cap without a cd. That tree is never scanned, so it is never claimed, and the session's own run shows only in "6 worktrees not scanned". Reproduction: A6.

### NOT RUN lines
- **P6 EnterWorktree, re-run on d5ce6ef:** `claims:12298555` = `['p6','p6/.claude/worktrees/p6x']`. Holds.
- **P6 `/clear`, stream-json with the messages spaced out:** the id before (`e8620487`) and after (`633403f1`) both hold `['clr','clr/.worktrees/wt']`. Holds.
- **m16, two claims interleaved:** Q6-3 and X4 pass, and A8 passes. Run.
- **Still NOT RUN:**
  - A hot reload (B5/C5): no reload happens in `-p`, and the kit cannot trigger one. F3 is accepted as W3-D1.
  - A real clock jump (B2): needs admin rights, and the kit refuses a negative advance. With an open span, a jump back behaves like file times more than 2 s behind the clock, which D8 accepts.
  - Real-engine `store.set` reordering (N2): there is no way to delay the engine's store.
  - Two real processes writing the shared store file at once: not tried.
  - A planner re-run: not done.
- **`enumerate:` rows:** B2 was run as A1 and A2, because it is the only row whose code this round changed. A2, A3 and C2 have no changed lines, so I did not re-run them.

### Housekeeping
My real-engine runs added 8 `claims:` keys to `~/.claude-personal/plugins/store/shawarma-companion_inline-745bc5609816.json`, which now holds 21. Their trees are under `…/lane-3a-fix/real/`. I deleted nothing.
