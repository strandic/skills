## Round 2 attack lane: the round-2 sketch

The round-1 reproductions now give the right readings. I found three new ways the session's own run gets hidden as "in another worktree" (B7a, B4a2, B2e). D1 makes a lasting false claim on a long Bash call (B2a).

**Setup**
- Test file: `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/lane-attack-r2/modb/tests/attack2.test.tsx`. It contains band.test.tsx's `world()`, extended with `clockRef` (file times follow the mock clock) and `onCall(e, files, move)` (moves the mock clock during a call).
- Command: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test …/lane-attack-r2/modb`.
- Output: `…/lane-attack-r2/run4.txt` reads `111 pass 2 fail` (both failures are NOT RUN, see B2). Readings are the same as in `run2.txt`.
- tsc with `…/lane-attack-r2/tsc/tsconfig.json`: one error, test-only (`console`).
- Oracles: every reading is compared with hand-written literals or read straight from the store Map. No test calls `ownTree`, `labelOf` or `parseClaimed`.
- Shorthand: M = `main-1 · trivial · since 14:00`, W1 = `wt-1 · trivial · since 14:00`.

## Readings

- **B1, A1 sequence:**
  - Rows: `[M,"1 run in another worktree"]`, then `[W1,"other tree: "+M]`, then `[M,"other tree: "+W1]` three times.
  - Store: id-1 and id-2 both hold `["/repo","/repo/.worktrees/w"]`.
- **B1, A9a (worktree made in the same turn):**
  - During the turn: `[M]`.
  - After the turn ends and later: `[M,"other tree: n-1 · trivial · since 14:01"]`.
  - Store: `["/repo","/repo/.worktrees/n"]`.
- **B1, A9b (sibling written while git fails):**
  - While git fails: `[M]`.
  - After: `[M,"other tree: sib-1 · trivial · since 14:01"]`; store `["/repo","/sib"]`.
- **B1, A9c (failed read of stored claims):** same reading with the round-1 fail set and with HostileStore `get` failing once.
  - First refresh: `[M,"1 run in another worktree"]`, store still `[/repo, WT]`, not overwritten.
  - Second refresh: `[M,"other tree: "+W1]`.
- **B1, A9d, A9e, A9h (parallel writes and races):** all three read `[M,"other tree: v-1…","other tree: wt-1…"]`, store `[/repo, V, WT]`.
- **B1, finding 5 (Bash paths with `..` and `//`):**
  - `..` and `//` give `["/repo","/repo/.worktrees/w"]`.
  - `WT/../../../sib/a` gives `["/repo","/sib"]`.
- **B1, A9g (subagent call reading its own cwd):** `[M,"other tree: "+W1]`.
- **B1, A9i (`/cd` with no tool call):** both the root-move and the cwd-move variants give `[M,"other tree: "+W1]`, store `[/repo, WT]`.
- **B2, D1 false claims:**
  - **B2a:** another session's marker written halfway through our 10-minute Bash call. Store `["/repo","/repo/.worktrees/w"]`, rows `[M,"other tree: wt-9 · trivial · since 14:07"]`.
  - **B2b:** span [T0, T0+10]; marker time is to+offset. Claimed for offsets −2, −1.5, −1, −0.5, 0, 0.5, 1 and 1.0001. Not claimed for 1.5 and 2.
    - 1.0001 is claimed because a double at 1.8e12 ms resolves to about 0.24 µs, so the time rounds to to+1.
    - Before the span: from−1.5 gives `["/repo"]`; from−1 gives `[/repo, WT]`.
  - **B2c:** our `find -exec touch` rewrites another session's marker (no changed-files list). WT is claimed: `[M,"other tree: wt-1 · … 14:02"]`.
  - **B2d (clock jumps back):** NOT RUN. The kit's `clock.advance` refuses a negative value: "advance(ms): a finite, non-negative number of milliseconds".
  - **B2e:** our own WT marker written by Bash on a filesystem with 1-second file times (time floored to the second, call 400–450 ms into it). Store `["/repo"]`, rows `[M,"1 run in another worktree"]`.
- **B3, D1 cost** (50 trees × 20 markers):
  - 64 spans × 1000 markers = 64 000 comparisons per refresh.
  - One refresh with 64 spans: 17 ms, `{list:50, read:20}`.
  - Same with 2 spans: 37 ms, `{list:50, read:20}`.
  - D1 adds no fs call.
- **B4, folders:**
  - **B4a:** WT claimed, then 70 writes into other folders. WT is still claimed: `[M,"other tree: "+W1]`.
  - **B4a2:** worktree made in the same turn, its marker written by Write, then 70 writes elsewhere before the turn ends. Rows `[M,"1 run in another worktree"]`, store `["/repo"]`.
  - **B4a3:** the same with 62 writes: claimed.
  - **B4b:** 100 folders outside every tree over 3 turns.
    - `stat … resolve` per refresh is 1 per new folder and 8 at each refresh just after a turn end. The maximum per refresh is 8.
    - Per turn: 42, 68, 96. Total: 206.
- **B5, store and session sequences:** all 64 sequences of length 3 over {G store.get fails, S store.set fails, C /clear, T turn end}.
  - Rows: `other tree: W1` is still drawn after every step.
  - Store: the entry for the current id lacks WT only in GSC and SGC, after the C step (`id-2:-`). The next claim retries the write.
  - Hot reload: NOT RUN. The kit cannot drop module variables while keeping `$.state`.
- **B6, pane:**
  - 25 unclaimed tickets, no row: `"No row drawn: 25 runs in other worktrees\nIn other worktrees: t-00, … t-19"` (20 listed).
  - With a drawn row: `"**main-1** · trivial\n\nIn other worktrees: t-00, … t-19\n\nTrivial run: no brief."` Five tickets are dropped and no count says so.
  - Hostile ticket names (Markdown pane, B6d): `"…In other worktrees: **bold**, a b, c [31mred, ls x, n\nl, r r, tab t, x\n### Fake heading, z z…"`.
    - Bidi, ESC, NUL, CR, tab and U+2028 become spaces.
    - A newline inside a ticket name survives, so `### Fake heading` renders as a heading and `**bold**` renders bold.
    - With a chosen row (B6e) the same list sits under `Other tickets: main-1`.
    - My two names containing `/` could not be file names in the fake, so they were left out.

## Findings (own run hidden)

1. **B7a: git spells the roots through a link.** git lists `/lnk` and `/lnk/.worktrees/w`, with `/lnk` linking to `/repo`. The cwd is real (`/repo/.worktrees/w`) and there is no write.
   - Reading: rows `["2 runs in other worktrees"]`, store `[]`.
   - Control with no link: `[W1,"1 run in another worktree"]`.
   - Cause: `claim` places the cwd and root with `ownTree(path, trees.roots)`, a text match. Its own comment says the cwd and root are real paths. `trees.reals` exists but is used only for written folders.
   - B7b shows the same cause: under git's spelling the main checkout's run was folded (`["other tree: "+W1,"1 run in another worktree"]`).
   - Real case: on macOS, `/tmp` is a link to `/private/tmp`, and git keeps a worktree's path as it was typed.
2. **B4a2: more than 64 writing calls between the marker write and the turn end.** In a worktree git made in the same turn, this drops both the folder and the time span, so the run is never claimed. Shawarma's run turn includes every subagent call, so this is likely.
3. **B2e: D1 assumes file times match the engine clock to ±1 ms.** File times rounded to the second (1-second filesystems, NFS clock skew) give no claim when a Bash write leaves no changed-files list.

## Findings (wrong, but not the worst direction)

4. **B2a, B2c: lasting false claims.** Another session's marker that is rewritten during any of our last 64 writing calls gets claimed and stored. A 10-minute test run is one such call. Shawarma rewrites its marker at every step.
5. **B7f: first event after a reload is a subagent call.** With `mainCwd` still null, a subagent call with cwd WT gives `[W1,"other tree: "+M]` and stores WT for good. A settings change re-registers the module without a session.start.
6. **B7d: worktree removed and re-added at the same path.** It stays claimed, so if another session re-adds that path it is claimed too.
7. **B7e: fallback-only discovery.** Reading: `inSib: []`. This depends on the fake: SIB has no `.git` file there.

## Flags

**Spike checklist rules the new lines trigger but the sketch does not apply:**
- **Predicate over the healthy population:** D1 is a classifier, and nothing counts its false positives with concurrent sessions or long calls (B2a).
- **Blind partition:** no case covers file-time precision (fractional, 1 s), clock jumps, the clock and the filesystem disagreeing, windows at 1 versus 64, or folders past 64 in one turn.
- **Sequences with an interrupt:** there is no hot-reload case. `windows`, `folders` and `mainCwd` are lost on a reload (B7f).
- **Bound every amplifying probe:** the real-path stats for written folders are re-asked every turn, up to 64 per turn, and no bound is stated (B4b: 206 stats for 100 folders).
- **Write what cannot be seen:** a newline is kept in pane text, and ticket names reach Markdown unescaped.

**Expected values in S20–S32 that are not independent of the sketch:**
- **S23:** the fake's `mark` sets the file time to `git.now ?? STARTED+120_000`, which is exactly the mock clock D1 reads, and the span is zero-length. It passes by construction, and no test checks a marker outside a span.
- **S30:** the `51` depends on the order of the fake Map's keys (`claims:future` inserted first). That is the only reason the future entry is examined.
- **S22:** passes through `folders`, never D1 (Write's file time is the fake's `tick`, not the clock). It does not cover more than 64 calls.
- **The older tests:** the `claimed: 'all'` default from round 1 still applies to them.
- S20, S21, S24–S29, S31 and S32 use hand-written literals.

**NOT RUN:**
- B2d: no negative clock advance in the kit.
- Hot reload in B5: the kit has no module reload that keeps `$.state`.
