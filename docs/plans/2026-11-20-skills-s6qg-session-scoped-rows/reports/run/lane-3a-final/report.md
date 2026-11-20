## Lane 3a final (HEAD 88fdb36, control d5ce6ef): report

I made no changes under the repo, and the worktree is still clean. All work is in `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-3a-final/`.

Files:
- Test file: `…/lane-3a-final/own/final.test.tsx`. It is the prior lane's `fix.test.tsx` (its world, plus A1–A10 unchanged), followed by my B, H and P tests (`own/new.part.tsx`, `own/b8.part.tsx`).
- Mod copies holding only that file: `…/head-x/shawarma-companion` (88fdb36) and `…/ctrl-x/shawarma-companion` (d5ce6ef).
- Raw kit output: `…/head-run3.txt` and `…/ctrl-run3.txt`. The earlier runs are `-run1` and `-run2`. In run1, `drive` waited too briefly, so the first call of a world counted one extra advance; run2 and later fix that.
- Full suite on a HEAD copy: 277 pass, 0 fail. This matches the baseline.

**Oracles.** Every oracle is a hand-written literal, or the store Map read directly. My first run showed a measurement artifact in my own `drive` helper, which I fixed. The P1/P2 probe confirms that module state (`isStoreUncertain`) does not carry over from one test to the next: P2 passes, with 1 own-key get.

### Call sites of the changed lines (HEAD)
- `isStoreUncertain`: declared at :31, read at :253 in `claim`, set at :272 in `store.set`'s rejection handler. Nothing resets it, `session.start` (:658) included. Once set, it stays set for the life of the process.
- N2 read-back: `within($, store.get(claimKey(id)))` at :254, inside `claim`.
  - `claim` (:208) is called by `snapshot` :550 (every tool call, turn end and session start) and by `stale` :625 (the 15 s check).
- N3 prune read: `within($, store.get(key))` at :307, inside `restore` (:294). `restore` is called from `claim` :213, once per new session id.
- N1: `remember(windows|turnWindows, [span], …, a === b)` at :689–690, in the `tool.call` hook's `finally` (:677). The spans are read at :243 `[...windows, ...turnWindows]`. `turnWindows` is cleared at :717 at a main turn end. `remember` is defined at :86.

### Re-runs of A1–A10 (HEAD | control d5ce6ef)
- A1, another session's marker during a long call: `other tree: other-1`, store `[ROOT, WT]` | same. This is an over-claim, accepted as W3-D5.
- A2, a call that never ends: `other tree: other-1` | same. W3-D5.
- A3, a long subagent call's marker at its end, after a turn end and 64 writes: passes (`other tree: wt-7`) | fails (`1 run in another worktree`). N1 is fixed for this shape.
- A4, a late `store.set` landing: `final [ROOT, V, WT]`, passes | fails, `final [ROOT, WT]`. N2 is fixed for this shape.
- A5, 100 hung other-key gets: passes, `{advances: 1, others: 100}` | `{advances: 100, others: 0}`. N3 is fixed for this shape.
- A6, a marker past the 50-tree cap: `["main-1 · trivial", "6 worktrees not scanned"]` | same. Accepted as W3-D6.
- A7, the same tree reached by a Write: the first refresh misses it, the next shows `other tree: far-1` | same. The gap lasts one refresh, as before.
- A8, `/clear` during a paused claim: passes | passes.
- A9, a call whose tool throws: rows hold, `1 run in another worktree`. The test fails only on its thrown-text oracle, which was wrong in the prior lane (`HooksError: no implementation for tool.call`).
- A10, `store.set` always rejects: 10 sets over 10 calls | 10. A10c, sets that land: 1 | 1.
- Q7-1 to Q7-3 in band.test.tsx pass on HEAD. They are the same tests as A3–A5, which fail on the control.

### Attacks of my own (each variant after its control)
- **B1c (control, the Q7-1 shape): a marker at the end of a long call.** Expected `other tree: wt-7`. HEAD: passes. Control: `1 run in another worktree`.
- **B1d (variant): turn end only, the 15 s check lists a mid-call marker.** Expected claimed. HEAD: passes. Control: passes.
- **B1 (N1): a long subagent call writes its marker mid-call.** Before that, a main turn end and 64 main writes have dropped its span. A 15 s check lists the marker, then the call ends.
  - Expected `other tree: wt-7`, both during and after.
  - HEAD: `["main-1 · trivial", "1 run in another worktree"]`, during and after. Control: the same.
- **B8c (control): a marker dated 1.999 s after a closed span.** Claimed on HEAD and on the control.
- **B8 (B2 enumerate, re-remembered span): a marker dated 2.001 s after a 10 s call closed.** Not claimed on HEAD and on the control. N1 does not widen the span bounds.
- **B2c (control, the Q7-2 shape).** Expected `[ROOT, V, WT]`. HEAD: passes. Control: `[ROOT, WT]`.
- **B2 (N2 and `/clear`): a write for id1 is given up on; B lands `[ROOT, WT, V]` for id1; `/clear` moves to id2; then the old write lands.** Followed by 3 calls and a 15 s check.
  - Expected: id1 = `[ROOT, V, WT]`.
  - HEAD: id1 = `[ROOT, WT]`, id2 is full. Control: the same.
- **B4a (N2): the old write lands after the session's last claim, with no refresh after.** Expected `[ROOT, V, WT]`. HEAD: `[ROOT, WT]`. Control: `[ROOT, WT]`.
- **B4b: as B4a, then one 15 s check.** Expected full. HEAD: passes (the check's read-back repairs it). Control: `[ROOT, WT]`.
- **B3c (control): own-key reads hang after `restore`, with no write given up on.** 2 s advances per call: `[0, 0, 0, 0, 0]` on HEAD and on the control.
- **B3 (N2 cost): one write given up on, later writes land, own-key reads hang after `restore`.**
  - Expected 0 advances per call.
  - HEAD: `[1, 1, 1, 1, 1]`, with 6 own-key reads. Control: `[0, 0, 0, 0, 0]`, with 1 read.
- **H, hostile corpus on the read-back: the own entry is replaced after a write given up on.** Expected: the next call's entry holds every claim.
  - The values: deleted, `'x'`, `[]`, `null`, `{trees: 'x'}`, `{trees: [1]}`, `{trees: ['rel']}`, `at: NaN`, no `at`, 10 000 trees with V missing, 10 000 trees with all present.
  - HEAD: all 11 pass. Control: 10 fail; only "all present" passes.
  - Hc, control with no write given up on: `'x'` stays `'x'`, on HEAD and on the control.
- **B5c (control): 100 fresh other entries, gets answer at once.** 0 extra advances on HEAD and on the control. (In run1 this read 1; that was the `drive` artifact noted above.)
- **B5 (N3): the same 100 entries, each get answering in 1.9 s.**
  - Expected: the first call held 4 s or less.
  - HEAD: held 190 000 ms of engine clock, 100 kept. Control: the same.
- **B6c (control): 5000 keys, none failing, three session ids in turn.** 297 expired deleted on HEAD and on the control.
- **B6 (N3): the same 5000 keys, but the first other key's get rejects; the other 4999 are expired.**
  - Expected: 297 expired deleted.
  - HEAD: 0 deleted, `old: 4999`. Control: `old: 4700`, and the bad key was deleted.
- **B7 (prune delete, a line this round did not change): 100 expired entries, `store.delete` hangs.**
  - Expected 2 advances or fewer.
  - HEAD: 100 advances (200 s). Control: 100.

### Findings
- **F1 (own, worst impact under §6; N1's fix is incomplete; not a regression).** A long call's span is dropped while the call is still open: a main turn end clears `turnWindows`, and 64 newer writing calls push it out of `windows`.
  - If a refresh (here, the 15 s check) lists the call's marker during that time, the marker goes into `lastSeen` without being claimed.
  - Re-remembering the span at the call's end comes too late. The marker is now "seen", so it never claims its tree.
  - The session's own run reads "1 run in another worktree" for the rest of the session.
  - Needs: a background subagent's long call that writes the marker partway through, while the main session ends a turn and makes 64 writes.
  - Reproduction: B1 (fails on HEAD and on the control). B1d shows that the turn end alone is not enough.
  - A possible fix, for the owner to weigh: keep open spans in a list nothing can push out, until the call closes them.
- **F2 (own, low; N2 residual).** The read-back only guards the current id. A write given up on under id1 that lands after `/clear` leaves id1's entry short for good. A later `--resume` of the conversation from before the `/clear` would fold V's run. This is not W3-D7, which is about the new id's entry. Reproduction: B2 (same on HEAD and on the control).
- **F3 (own, low; N2 residual, timing).** A write given up on that lands after the last refresh leaves the entry short (B4a). On HEAD, the 15 s check repairs it within 15 s while a row or the more-row is drawn (B4b). It stays short if the session ends first, or if nothing is drawn.
- **F4 (own, low; new cost from N2).** Once one write is given up on, `isStoreUncertain` is never cleared. Every `claim` after that does one more `store.get`, on every tool call, turn end and 15 s check. If the store answers reads slowly while writes land, each refresh waits 2 s. Reproduction: B3 (`[1, 1, 1, 1, 1]` on HEAD, `[0, 0, 0, 0, 0]` on the control).
- **F5 (own; error surface; N3 residual, not a regression).** The bound is per read, not per pass. With reads answering just under 2 s, the first writing call, or the session start, is held about 100 × 1.9 s = 190 s. During that time no row is drawn. The Q7 reason cites "200 s of slow reads"; that wait is still possible. Reproduction: B5 (the same on the control).
- **F6 (own, low; follows from the Q7 rule "stops at the first late read").** One other key whose get always fails or runs late, if it sorts first, stops every session's prune. Expired entries are then never deleted, and the store grows without bound. There is no §6 impact. Reproduction: B6 (0 of 4999 deleted over three ids).
- **F7 (own; error surface; pre-existing line :311, unchanged).** With `store.delete` hanging, the prune of 100 expired entries holds the first writing call 200 s. Reproduction: B7 (the same on the control).
- **No new finding** on: the hostile store values (H), span bounds after N1 (B8), and A8's `/clear` interleave.

### NOT RUN
- **Real-engine runs** (P6 EnterWorktree, P6 `/clear`, and a store write that lands out of order): not run this round.
  - The engine's store cannot be slowed or reordered.
  - P6 held on d5ce6ef in the prior lane, and this round's lines do not touch the EnterWorktree path.
  - The `/clear` interaction with N2 was run in the kit instead (B2, A8).
- **Hot reload (B5/C5)** and **a real clock jump (B2)**: still not run. The kit cannot drop module variables, and it refuses a negative advance.
- **C5a/C5a2** (seeding the rows atom): the kit cannot do it.
- **"Planner re-run"**: lanes.md does not define it further. I took it to mean re-running the earlier reproductions (A1–A10, Q7-1 to Q7-3, the B8 bounds). No separate planner sketch was re-run. The sketch is only a patch (`sketch/sketch.patch`).
- **`enumerate:` rows**: only B2 has lines changed this round (N1). I re-ran it as B1, B1d and B8. A2, A3 and C2 have no changed lines, so I did not re-run them.

### Housekeeping
- I made no real-engine runs, and added no keys to `~/.claude-personal/plugins/store/`.
- Everything is in the scratch dir above. I deleted nothing.
