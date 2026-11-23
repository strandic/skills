## Fix review 5 (3a adversarial) for skills-oz54: control 3132753 against fix 1bfa021

**Result:** The fix closes round 4's F1, the race between a lost turn end and the 15-second check. A5 at offsets 2.2, 2.4, 2.6 and 2.8 s reads `1 run in another worktree` on 3132753 and `other tree: k` on 1bfa021 at all three reads. V19 fails on 3132753 (319/1) and passes on 1bfa021 (320/0). Every other A1–A6, G1, G2, G3 and G1w reading equals 3132753's. The rewrite of `stale` changes no reading: B1 and the sweep give 0 differences across 6 572 runs. I found one new outcome, F1 (`own`, low). `isPlaced` is set only after the whole `snapshot` ends, not right after `claim` ends. So a turn end whose claim placed the folders, but whose `session.usage` call then gives up, keeps the turn's lists. The next turn then claims a worktree that only another session wrote, which 3132753 does not do. If `usage` fails at every turn end, the lists are never emptied, up to MAX_TURN = 4096 each. A candidate fix closes F1 and keeps the suite green (320/320). The fix also behaves better than the control in two other races (N2, N3). The change adds no session call. "At most eight … 16 seconds" holds. The README sentences at :36, :38 and :40 and the CHANGELOG 0.3.4 entry are true on 1bfa021. The one caveat is F1, which touches :36.

### How I ran it
- Scratch copies: `git archive <sha> mods/shawarma-companion` under `scratchpad/fr5/` (pre = 3132753, fix = 1bfa021, try = fix + `try.diff`). Each copy ran with `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test <copy>`. The scratch folder has been removed. I made no commit, no stash, no checkout and no edit to a tracked file. `git status` is clean.
- All files are in `docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview5/`:
  - Runners: `run.sh` (both sides), `try-run.sh` (the candidate; with no arguments it runs the suite), `job.sh` and `enum-run.sh` (8 processes at a time). All are copied from fixreview4 with the new paths and sides.
  - Probes: `header.tsx`, `a4.tail.tsx` and `l.tail.tsx` are reused unchanged. `a5.tail.tsx` holds my new attacks N1–N3.
  - Readings: `l-*.txt`, `a4-*.txt`, `a5-{pre,fix,try}.txt`, `sweep-*.txt`, `b1-*.txt`, `suite-{fix,try,pre-with-v19}.txt`. Short forms are in `summary.txt`, `summary-l-a4.txt` and `summary-a5.txt`.
  - Grader: `classify.py` → `classified.txt`.
- **Oracle check:** No grader shares code with the mod. The truth is written by hand. The first row must name the folder the session is in (m = /repo). A worktree the session wrote (X or X2, marker k) must read `other tree: k`. A worktree only another session wrote (Y, Z) must not. The second oracle is the all-instant run of the same sequence. `classify.py` reads the expected folder from the test's own `dir`.
- **Load note:** While my probes ran alongside the enumeration, 10 control shards timed out at the kit's 5 s per test (3 sweep, 7 B1). I re-ran those 8 shards alone and they all passed. The tables below use the clean re-runs.

### Liveness (control 3132753 first, then the fix-only probe)
`./run.sh l.tail.tsx l` and `./run.sh a4.tail.tsx a4`: 24/0 and 45/0 on each side. Short form: k = `other tree: k`, 1run = `1 run in another worktree`.

| probe | 3132753 r1/r2/r3 | 1bfa021 r1/r2/r3 |
|---|---|---|
| A5 off=2.2, 2.4, 2.6, 2.8 (log `cwd#1@0, cwd#2@2000, cwd#3@<off>, root@<off+1000>`, doneAt 4000) | 1run ×3 at each offset | **k ×3** at each offset |
| A5 off=0 (all instant) and off=3.2–3.8 | k ×3 | k ×3 |
| V19 (suite) | fail (`suite-pre-with-v19.txt`: 319 pass, 1 fail) | pass (`suite-fix.txt`: 320 pass, 0 fail) |

Only the fix passes. A1–A4, A6, G1, G1w, G2 and G3 read the same on both sides (`summary-l-a4.txt`, every row `SAME`). Those readings match round 4's fix side: G1 and G1w read k for reject and never, A4 reject/never reads y (skills-k6zu), A2's s1 and s2 are `[]`.

### Findings

**F1 (`own`, low): a turn end whose `claim` finished, but whose `session.usage` call then gave up, keeps the turn's lists. 3132753 empties them.**
- **Cause:** `isPlaced = at.isFromGit === true` runs only after `await snapshot(...)` returns (register.tsx :638–640). `snapshot` calls `bounded($, $.session.usage())` after `claim` whenever a row is picked. If that call rejects or gives up, `snapshot` throws after the folders and spans were already placed against a git list. `isPlaced` stays false and `turn.complete` keeps `turnFolders` and `turnWindows`. In 3132753 the guard `!isCwdLost && lastTrees.isFromGit` held, so the lists were emptied.
- **Kept forever?** They are kept until a turn end whose whole `snapshot` finishes. If `usage` fails at every turn end, the lists are never emptied. They grow to MAX_TURN = 4096 each. The spans then cover every call of the session, so any marker another session writes during any of them is claimed. A good turn end still empties them: in N1 below, Z is not claimed. Wall-time growth is **NOT RUN** because the kit stops each test at 5 s.
- **Reproduction:** `a5.tail.tsx` N1. In `who=other`, another session writes `Y/.shawarma/active-y` during this session's Bash call 1. In `who=own`, this session writes `X/.shawarma/active-k` at call 1. Then come 70 Writes, each into its own folder. Then K turn ends whose `session.usage` rejects or never answers. Then git lists the tree, followed by a good turn end, a Bash and a 15 s check. Last, another session writes Z during the next turn's call 1, 70 writes follow, a good end, Z is listed, a good end, a Bash.
- **Readings** (`summary-a5.txt`; r1 / r2 / after; "2" = `2 runs in other worktrees`):

  | run | 3132753 | 1bfa021 | try |
  |---|---|---|---|
  | instant, any who, K=1,3 (control) | 1run / 1run / 2 | 1run / 1run / 2 | 1run / 1run / 2 |
  | reject or never, other, K=1,3 | 1run / 1run / 2 | **y / y / y+1run** | 1run / 1run / 2 |
  | reject or never, own, K=1,3 | 1run / 1run / 2 | k / k / k+1run | 1run / 1run / 2 |

  - Truth for `other`: Y must read 1run. The fix claims Y, which is wrong and is the skills-k6zu outcome reached by a new trigger (a `usage` give-up, not a lost cwd).
  - Truth for `own`: k. The fix reads k and the control reads 1run. But the all-instant run also reads 1run there, because X is listed only after a turn end that did place. README :38 promises the claim only within the same turn, so the control's 1run is the documented limit, not G1.
- **Candidate fix (`try.diff`):** `refresh` passes `mark = { isPlaced: false }` to `snapshot`, which sets `mark.isPlaced = trees.isFromGit === true` right after `claim` returns. `refresh` returns `mark.isPlaced`.
  - try readings: N1 equals 3132753. A5 (as on 1bfa021), N2 and N3 equal 1bfa021.
  - Suite on try: 320 pass, 0 fail (`suite-try.txt`), including V19.
- **Scope:** only `usage` (and `$.clock.now`) can throw after `claim` inside `snapshot`. `claim` catches its own session and store calls, and row failures are caught one row at a time. So the trigger is one `usage` give-up at a main turn end while a row is drawn.

**Not findings: the fix behaves better than the control.**
- **N2:** a main turn end lists by the fallback because git rejects after 0.5 s. A subagent Bash starts 0.1 s in, lists by git after 1 s, and sets `lastTrees` to a git list. All of this happens while the turn end's `claim` waits 3 s on `session.root`. The session wrote k into a sibling-folder worktree `/side/x`, which the fallback cannot see and git lists only later. Log: `git#1@0, git#2@100, root#1@500, root#2@1100`, doneAt 2500.
  - r3: 3132753 reads 1run. It emptied the lists on the subagent's `lastTrees`.
  - r3: 1bfa021 reads **k**, which matches the truth. The all-instant run reads 1run on both sides, as A1 does.
- **N3:** a main turn end places against git. The 15 s check fires 1 s in and its cwd read rejects, so `isCwdLost` is true when the turn end returns. Another session wrote y into Y during call 1. Log: `cwd#1@0, root#1@0, cwd#2@1000, cwd#3@1000`, doneAt 2000.
  - r3: 3132753 reads **y**. It kept the lists and claimed Y, which is wrong.
  - r3: 1bfa021 reads 1run, which matches the truth and the all-instant run.

**Other attacks (no finding):**
- **When `isPlaced` is true or false:**
  - A turn end listed by the fallback gives false and keeps the lists, as before (A3 is the same on both sides).
  - A subagent turn end never empties the lists on either side (A2 is the same).
  - A lost turn end gives false (G1, G1w and A1 are the same as 3132753).
  - A refresh that throws before `snapshot` gives false.
  - No path empties the lists after a failed placing: `isPlaced` turns true only after a finished `claim` against `isFromGit`. F1 is the only path that keeps them after a good placing.
- **Callers of `refresh`:**
  - `session.start` and `tool.call` ignore its return value.
  - `turn.complete` uses it.
  - In `stale`, `return refresh(...)` → `{ await refresh(...); return }` still resolves after the refresh, with void. `refresh` never throws, so the check's `.catch(() => failed($))` path is unchanged.
  - `watch` is unchanged and is still called inside `refresh`.
  - The enumeration shows no reading changed.

### Holds
- `git diff 3132753 1bfa021 -- mods/shawarma-companion/hooks | grep '^+.*\$\.session'` prints nothing, so no session call is added.
- A6, every session call never answering from the turn end on: context off and on, both sides, n = 2 (`cwd@0`, `cwd@2000`), doneAt = 4000 ms. A5, N2 and N3 end at 4000, 2500 and 2000 ms. All are within "at most eight … 16 seconds".

### Enumeration (re-run only where the diff can change it: sequences with a main turn end)
Runner: `./enum-run.sh`, then the 8 timed-out control shards again via `job.sh`. Grader: `python3 -I classify.py`.

| set | side | runs (pass/fail) | reads | differs from 3132753 | wrong label, unlike control | wrong label, equal to control | absences | unhandled |
|---|---|---|---|---|---|---|---|---|
| sweep | 3132753 | 1 708 (1 708/0) | 8 540 | – | 62 | 371 | 944 | 0 |
| sweep | 1bfa021 | 1 708 (1 708/0) | 8 540 | 0 | 62 (all equal to 3132753) | 371 | 944 | 0 |
| B1 | 3132753 | 4 864 (4 864/0) | 29 184 | – | 0 | 625 | 20 928 | 0 |
| B1 | 1bfa021 | 4 864 (4 864/0) | 29 184 | 0 | 0 | 625 | 20 928 | 0 |

The 3132753 readings equal fixreview4's fix-side readings on the same keys (sweep: True, 1 708; B1: True, 4 864). Neither set has a `usage` fault at a turn end, so F1 cannot show in them.

### Docs on 1bfa021 (README and CHANGELOG are unchanged from 3132753)
- **README :36**, "a marker in it was written during one of the session's own … Bash calls … This catches a marker a Bash command writes into another worktree": **true**. G1 bash 70 reads k, and A5 now reads k at every offset; it read 1run at off ≤ 2.8 on 3132753. "A marker another session writes at that same moment is claimed too" is **true**, and on 1bfa021 it also holds across turn ends whose `usage` gave up (F1: N1 other reads y).
- **README :38**, "It checks the folders of the last 64 files … so a worktree made and written in the same turn is claimed once git lists it": **true**. G1w reject/never 70 reads k, and A5 reads k.
- **README :40:**
  - "a call that gives up claims nothing that update": **true**. G1 and A1 claim k only at later updates.
  - "draws nothing until the working directory is read again …": **true**. A2 s1 and s2 are `[]`.
  - "It then finds the worktrees again from the folder it reads": **true**.
  - "at most eight … 16 seconds": **true** (A6: 2 calls, 4000 ms).
- **CHANGELOG 0.3.4**, "draws nothing until it has the folder again … takes it from a session start; it then finds the worktrees from that folder": **true**. A1, A2 and A3 match round 4, and the diff does not touch this path. The entry does not mention W3-R5 or F1.

### Not executed
- Wall-time growth to MAX_TURN 4096 under F1: **NOT RUN** (the kit's 5 s per-test limit).
- The full enumeration (sequences without a main turn end): **NOT RUN**. The diff touches only `turn.complete`'s guard, `refresh`'s return value and `stale`'s return form. The check path through `stale` is exercised inside the turn-end sequences, and none of their readings changed.
