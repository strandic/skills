I ran every attack line. Four separate sequences hide one of the session's own runs under "other worktrees", and each one lasts (A9a, A9b, A9c, A9d/h). Below are raw readings, then findings, then flags.

Setup: the mod copy and the attack-only copy are in `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-attack/` (folders `mod` and `moda`). The test file is `moda/tests/attack.test.tsx` (round 2). The round-1 copy is `attack1.tsx`, and its output is `attack-run.txt`; round 2 is in `attack-run2.txt` and `attack-run3.txt`. The sketch suite on the copy reads `231 pass 0 fail`, and `tsc` on the sketch prints no errors. L0 check: module variables do not leak between tests (a fresh world with `claimed: []` read `[M, '1 run in another worktree']` after a test that claimed WT).

In the lines below, M = `main-1 · trivial · since 14:00` and W1 = `wt-1 · trivial · since 14:00`.

## Attack lines
- **A1** → rows at each step:
  - Step 1: `[M,"1 run in another worktree"]`
  - Step 2 (cwd WT): `[W1,"other tree: "+M]`
  - Steps 3, 4 (/clear) and 5: `[M,"other tree: "+W1]`
  - Store: `claims:id-1` and `claims:id-2` both hold `["/repo","/repo/.worktrees/w"]`.
  - All match my hand-written literals.
- **A2** → store `claims:sess-1` matched the hand-written list in 15 of 19 cases (cd relative or absolute, root move, Write and Edit absolute, Write relative, Write with `..` escapes, `//`, a link to WT or to SIB, NotebookEdit, Bash absolute, subagent call with `agentId`). It differed in 4 cases:
  - Bash `changedFiles` holding `/repo/x/../.worktrees/w/a` → `["/repo"]` (WT missed).
  - `WT/../../../sib/a` → `["/repo","/repo/.worktrees/w"]` (claims WT, the wrong tree; SIB missed).
  - `/repo//.worktrees/w/a` → `["/repo"]`.
  - A link-spelled path to a file that does not exist → `["/repo"]`. With the file present (A2b) → `["/repo","/sib"]`.
- **A3** → every malformed shape (absent, null, string, number, `{}`, an object, `[]`, `['']`, relative, non-strings): 3 resolve stats (the tree roots only), store `["/repo"]`. `['/']`: 4 stats, 1 outside a tree. 1000 outside folders: 11 stats (8 outside), 45 ms. 1000 outside plus a SIB path spelled directly: SIB claimed. 8 outside folders plus a link-spelled SIB (A3b): `["/repo"]`, because the cap drops SIB.
- **A4** → no uncaught error in any case.
  - Own entry with one non-absolute tree, `at` NaN, or `at` a string: the whole entry is dropped; rows `[M,"1 run in another worktree"]`; the entry is overwritten with `["/repo"]`.
  - 10 000 trees: rows `[M,"other tree: "+W1]`, 10 001 trees written back, 89 ms.
  - `at` −1 or 8.64e15: restored.
  - Other sessions' entries: NaN, −1 and string are deleted; the far-future one (`claims:fut`) is kept, so it is never pruned.
  - 5 000 keys: 2 500 deleted, 721 ms in the first tool call.
  - `store.get` throwing every time: seed `[WT]` overwritten with `["/repo"]`.
  - `store.set` rejecting: rows are drawn and the store is unchanged.
  - `store.delete` throwing: rows kept.
- **A5** → the drawn other-tree row, and whether it contains `skills-x`:

  | columns | stale | earlier session |
  |---|---|---|
  | 10 | `other tre…` — no | `other tre…` — no |
  | 20 | `other tree: stale: …` — no | `other tree: earlier…` — no |
  | 30 | `other tree: stale: skills-x ·…` — yes | `other tree: earlier session: …` — no |
  | 40 | `other tree: stale: skills-x · run W1 · …` — yes | `other tree: earlier session: skills-x ·…` — yes |

  The README says "No row runs wider than the window. The ticket stays at the start of the row." The label (up to 29 characters) pushes the ticket out below about 30–40 columns.
- **A6** → fs counts, as list/read/stat/run:
  - W=3, M=2, all claimed: start 16 (bound ≤16), changed 11 (≤11), steady 7 (≤7), check 5 (≤5). None claimed: 11/7/5/4.
  - W=6, M=4, all claimed: 32/22/14/10, each exactly at its bound. None claimed: 17/10/8/7.
  - Store operations: 3 at start, 0 afterwards. The Q6 counter `fsCalls` does not count store operations or `run`.
- **A7** → session A: `[M,"1 run in another worktree"]`. Session B: `[W1,"1 run in another worktree"]`. Store: `claims:A=["/repo"]`, `claims:B=["/repo/.worktrees/w"]`.
- **A8** → on an other-tree row the pane reads `"other tree: **wt-1** · trivial\n\nOther tickets: main-1\n\nTrivial run: no brief."`. With only the more-row it reads `"No row drawn: 1 run in another worktree"`. The README's pane section names only `stale:` and `earlier session:` as labels, and says nothing about other trees or folded runs.
- **A9** → below.

## Findings (own run hidden)
1. **A9a: a worktree created in the same turn.** `git worktree add` followed by a Write of `.worktrees/n/.shawarma/active-n-1` is never claimed. The per-turn `worktrees` cache does not list NEW yet, so `ownTree` puts the written path under ROOT and the path is used up.
   - Readings: in the turn `[M]`; after the turn ends and later `[M,"1 run in another worktree"]`; store `["/repo"]`.
   - Shawarma's Wave 0 does exactly this: it creates the worktree with a plain git command, not EnterWorktree, then writes the marker. It is also the ticket's open question 1.
   - Repro: test `A9a` (git.trees is an array the test pushes NEW into).
2. **A9b: a sibling worktree written while `git worktree list` fails** (it times out, then answers). The fallback misses siblings, and the written path is dropped for good. Readings: `after: [M,"1 run in another worktree"]`, store `["/repo"]`.
3. **A9c / A4b: one failed `store.get` on resume overwrites the stored claims.** `restoredFor` is set before `restore` runs, so the restore is never retried, and the next write replaces `[ROOT,WT]` with `[ROOT]`.
   - Readings: both refreshes `[M,"1 run in another worktree"]`; entry `{"trees":["/repo"]}`.
   - Repro: `HostileStore` with `fails={get:1}`.
4. **A9e / A9h: concurrent refreshes lose an update.** `claim` reads `held`, awaits, then writes `() => all` without merging what another refresh wrote in between.
   - Parallel Bash cd into WT plus a Write into V → store `["/repo","/repo/.worktrees/w"]`, rows `…,"1 run in another worktree"`.
   - A subagent Write into V racing `turn.complete` → same reading.
   - Subagents and turn-end refreshes do run concurrently with tool calls.
5. **Bash `changedFiles` paths are not normalized** (A2): `..` and `//` give a missing or wrong claim. Write paths do go through `resolvePath`, so the two paths behave differently.
6. **MAX_RESOLVE drops a later link-spelled tree path** (A3b). This needs 8 or more outside folders in one refresh.
7. **Not run against the real engine: a Bash write of the marker may never claim.** The shawarma skill writes `.shawarma/.gitignore` holding `*`. The `d.ts` says `bashEditDiff` is a "diff of the working-tree changes". The probe repo had no `.gitignore`, so a git-ignored marker written by Bash was never probed. It needs a live session.
8. **Not the worst direction, but wrong:**
   - A9i: `/cd` moves the root with no tool call; the 15 s check does not claim, so the WT run stays folded until the next tool call or turn end.
   - A9g: during a subagent call (it reads its own cwd), the main tree's rows read `other tree: main-1`.

## Research report sources
All quotes are verified, with these exceptions:
- Line numbers are off: `keys()` is at 3624 (not 3632), the JSON line at 3659 (not 3657), `bodyRows` at 11423 (not 11418–11421), NotebookEdit's result `notebook_path` at 23344 (not 23328).
- The `bashEditDiff` quote is paraphrased: it leaves out "working-tree changes" and "at most 200; cut when shorter…", which bear on finding 7.
- The WorktreeCreate sentence "doesn't run for a worktree Claude adds through Bash" is not in the `d.ts` (it comes from the hooks doc, which I did not check).
- The reference quotes at 201, 202, 261 and 263–264 are verified.

## Flags
**(a) Spike checklist rules the diff triggers but the sketch does not apply:**
- **Bound every amplifying probe (cost.md):** the prune loop over `store.keys()` has no cap (721 ms at 5 000 keys). The claims list grows without bound and is rewritten whole each time. The Q6 bounds do not count store operations.
- **Persisted state, sequences of length 3 with an interrupt and an outside writer:** no store-failure sequence, no concurrent writer, no reload in the middle of a sequence (findings 3 and 4).
- **A predicate run over the healthy population:** the claimed/unclaimed classifier was never run over the old fixtures. The fake's default `claimed: 'all'` seeds every tree the fixture names, so the 212 earlier tests never exercise it.
- **Unfollowed state:** S11 seeds the store by hand. No test follows a stored value from a write through the next start, or through a failed write.

**(b) New-test expectations that are not independent:**
- S10's `expect(before).not.toBe('')` can never fail (`JSON.stringify` never returns `''`).
- The `claimed: 'all'` default takes its claims from the same fixture lists the code scans, so the older tests check nothing about claims.
- The other expected values are hand-written literals.

**(c) Ticket items with no test, no follow-up and no stated reason:**
- Item 3 (CwdChanged).
- Item 5, "The pane still lists them": not done; the pane only shows the count.
- Item 6, the `scope: session | repo` option.
- Open question 1: the write claim fails exactly in that case (finding 1).
- The decisions log's Q3 reason, "can only fail towards claiming less (today's behaviour)", is wrong: claiming less now hides runs, while today's behaviour shows them all.
- The README is unchanged: it still says "It writes nothing", and it has no `other tree:`, no new more-row text, and no claims section.
