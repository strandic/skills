## Fix review 6 (3a adversarial) for skills-oz54: control 1bfa021 against fix e0afed3

**Result:** The fix closes round 5's F1. N1 (a turn end whose `session.usage` gives up after the claim) reads `other tree: y` on 1bfa021 and `1 run in another worktree` on e0afed3, in all 4 "other" runs. V20 fails on 1bfa021 (320 pass, 1 fail) and passes on e0afed3 (321 pass, 0 fail). e0afed3 equals round 5's candidate `try.diff`, apart from two comments. Every reading of L, A1–A6 (A5 at all 9 offsets), G1, G1w, N2 and N3 equals the control's: 67 of 67 rows in L and A4, and 16 of 16 rows in A5 outside N1. `snapshot` has one caller, `refresh`, so the default `mark` changes nothing. I found two new outcomes. Both come from one step: when a turn end's `usage` call gives up, the fix now empties the turn's lists, where the control kept them. Neither is a new mechanism, because the all-instant run or a slow file read reaches the same reading on the control.
- **F1 (`listed`, low):** a turn end whose listing of a tree's `.shawarma` folder fails still counts as placed. The session's own marker there is then lost after 64 calls. This happens on both sides when `usage` answers. The fix adds the case where `usage` gives up.
- **F2 (`own`, low):** a subagent call that runs during the slow tail of a main turn end has its span and folders removed without being placed. On the control a slow file read already does this. The fix adds a `usage` give-up as a trigger. A candidate fix closes F2 and keeps the suite green (321/321).

No session call is added. "At most eight … 16 seconds" holds. README :36, :38 and :40 and CHANGELOG 0.3.4 are true on e0afed3. F2 is a caveat to :36's "Subagents' calls count" and applies on both sides.

### How I ran it
- **Scratch copies:** `git archive <sha> mods/shawarma-companion` under `scratchpad/fr6/`. pre = 1bfa021, fix = e0afed3, try = e0afed3 + `fixreview6/try.diff`, prev20 = 1bfa021's code with e0afed3's `band.test.tsx`. Each ran with `CLAUDE_CONFIG_DIR=$HOME/.claude-personal /Users/jonathan/.local/bin/claude plugin test <copy>`. The scratch folder has been removed. I made no commit, no stash, no checkout and no edit to a tracked file. The reports folder is gitignored (`.gitignore:15`).
- **Fix against round 5's candidate:** I applied `fixreview5/try.diff` to 1bfa021 and compared the result with e0afed3's `register.tsx`. Only the two comment lines (591 and 632) differ.
- **Files** in `docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview6/`:
  - Runners: `run.sh` (both sides), `suite.sh` (fix suite, and the control code with V20), `try-run.sh` (with no arguments it runs the suite on try).
  - Probes: `header.tsx`, `l.tail.tsx`, `a4.tail.tsx` and `a5.tail.tsx` (N1–N3) are reused unchanged. `a6.tail.tsx` holds my new attacks P1 and P3.
  - Readings: `{l,a4,a5,a6}-{pre,fix}.txt`, `{a5,a6}-try.txt`, `suite-{fix,pre-with-v20,try}.txt`.
  - Short forms: `summary-l-a4.txt` and `summary-a6-a5.txt`, made by `python3 -I summarize.py <probes> <sides>`.
  - Candidate: `try.diff`.
- **Oracle check:**
  - The truth is written by hand in each test. The session wrote k, so k must read `other tree: k`. Only another session wrote y, so y must not.
  - The second oracle is the all-instant run of the same sequence (P1 `instant`, P3 `instant`, N1 `instant`).
  - `summarize.py` only shortens text; it shares no code with the mod.
  - I did not use `classify.py` because no enumeration ran.
- **Load:** I ran the probes one at a time and the suite alone. No test timed out.

### Liveness (control 1bfa021 first, then the fix-only probe)

| probe | 1bfa021 r1 / r2 / after | e0afed3 r1 / r2 / after | truth |
|---|---|---|---|
| N1 reject\|never, other, K=1,3 (`./run.sh a5.tail.tsx a5`) | y / y / y+1run (4 of 4) | **1run / 1run / 2** (4 of 4) | 1run |
| N1 instant (all-instant oracle) | 1run / 1run / 2 | 1run / 1run / 2 | 1run |
| V20 (`./suite.sh`) | fail: `suite-pre-with-v20.txt` 320 pass, 1 fail ("Expected: [m · trivial · since 14:00, 1 run in another worktree]") | pass: `suite-fix.txt` 321 pass, 0 fail | – |

Only the fix passes. V18 and V19 pass on both sides.
- N1 own (reject or never) reads k on 1bfa021 and 1run on e0afed3. The all-instant run also reads 1run there, which is the documented limit (round 5 says the same).
- N2 race reads k on both sides, and N3 race reads 1run on both sides. That is unchanged from 1bfa021.

### Findings

**F1 (`listed`, attack 1: a claim that ran without seeing the marker; low).**
- **What happens:** a main turn end that lists by git counts as placed even when the listing of one tree's `.shawarma` folder failed. `markersOf` turns the failure into "no markers" (`lister` maps any rejection to null), so `claim` never sees the marker. The lists are emptied anyway. The marker then enters `lastSeen` at the next update with only the last 64 spans left to match it.
- **What this diff changes:** on 1bfa021 the same thing already happens when `usage` answers. When `usage` gives up, 1bfa021 keeps the lists by accident and later claims k. e0afed3 now empties them.
- **Reproduction:** `a6.tail.tsx` P1, run with `./run.sh a6.tail.tsx a6` (10 of 10 pass on each side).
  1. This session's Bash call 1 writes k into X, which git does not list yet.
  2. 70 Writes follow, so call 1's span leaves the last 64.
  3. git lists X.
  4. A main turn end runs. Its `fs.list X/.shawarma` rejects (fail) or answers (ok), and its `usage` answers (instant), rejects or never answers.
  5. A Bash, a 15 s check, a good turn end and a Bash follow.
- **Readings** (r1 / r2 / r3):

  | run | 1bfa021 | e0afed3 | truth |
  |---|---|---|---|
  | instant ok (all-instant oracle) | k / k / k | k / k / k | k |
  | reject or never, ok | k / k / k | k / k / k | k |
  | instant fail | 1run / 1run / 1run | 1run / 1run / 1run | k |
  | reject or never, fail | k / k / k | **1run / 1run / 1run** | k |

- **Verdict:** e0afed3 equals the all-instant run of the same sequence, so this is not a regression against the oracle. The gap (a failed `.shawarma` listing still counts as placed) is pre-existing and not ticketed. It is close to skills-3hy6 (a failed `.shawarma` listing empties the band), but it has a different effect: a lost claim.
- **Candidate fix (unexecuted):** count the turn end as placed only if every scanned root's `.shawarma` either listed or is missing (ENOENT). This needs `lister` to tell "missing" from "failed", because today both are null. A bare `answered.size === roots.length` would never empty the lists while any tree has no `.shawarma` folder.

**F2 (`own`, low): a subagent call that runs during the slow tail of a main turn end loses its span and folders.**
- **What happens:**
  - `claim` copies `turnWindows` and `turnFolders` when it runs.
  - `turn.complete` then empties both lists completely (`splice(0)`), including entries added after the claim.
  - A subagent call that runs in that gap has its span removed without the span ever being placed. The span still sits in `windows`, so it is lost only after 64 more calls.
- **What this diff changes:** on 1bfa021 a slow step after the claim already opens this gap (a file read in `rowOf`: P3 read-slow). A `usage` give-up opened it too, but 1bfa021 then kept the lists. e0afed3 now empties them after a `usage` give-up, which adds up to 2 s of gap per turn end.
- **Reproduction:** `a6.tail.tsx` P3.
  1. A main turn end runs.
  2. 0.5 s in, a subagent Bash (`agentId: 'a1'`) writes k into X, which git does not list yet.
  3. The turn end's tail is slow: `usage` never answers, `usage` rejects after 1.5 s, or the first `fs.read` waits 1.5 s.
  4. Next turn: 70 Writes, git lists X, a good turn end, a Bash, a 15 s check.
  Log: `usage@0, subk@500, usage@500`, doneAt 2000 (never) or 1500 (reject, read-slow).
- **Readings** (r1 / r2):

  | trigger | 1bfa021 | e0afed3 | try | truth |
  |---|---|---|---|---|
  | instant (all-instant oracle) | k / k | k / k | k / k | k |
  | usage-never | k / k | **1run / 1run** | k / k | k |
  | usage-reject | k / k | **1run / 1run** | k / k | k |
  | read-slow (1.5 s fs.read after claim) | 1run / 1run | 1run / 1run | k / k | k |

- **Verdict:** e0afed3 differs from the all-instant run here, and it reads wrong where 1bfa021 reads right. The cause is pre-existing (read-slow is wrong on both sides). It is a sibling of skills-5w5c: there a long call's span is open across the turn end; here a short call falls inside the turn end's tail.
- **Candidate fix (`try.diff`, executed):**
  - `snapshot` records the entries of `turnFolders` and `turnWindows` before `claim` runs, in `mark.folders` and `mark.windows`.
  - `refresh` returns the whole `mark`.
  - `turn.complete` removes only those entries, so a later entry is kept. An open span that is removed is put back by its own `finally`, which calls `remember`.
  - try readings: P3 reads k for all four triggers. P1 equals e0afed3. A5 (N1–N3) equals e0afed3 on all 16 rows, so N1 other still reads 1run.
  - Suite on try: `suite-try.txt` 321 pass, 0 fail, V20 included.

**Other attacks (no finding):**
- **Paths where `mark.isPlaced` turns true:**
  - The only assignment is right after `claim` returns. An earlier throw (`discover`, the `isCwdLost` check) leaves it false. `markersOf` cannot throw, because `lister` catches.
  - `claim`'s own failures (`session.id`, `session.root`, `restore`, `store.get`, `store.set`) are caught inside it and give the same value on both sides. They differ only when combined with a throw after the claim, which is the F1/F2 class. A `read` or `update` of `claimsAtom`, or `$.clock.now` before `store.set`, can make `claim` throw; that leaves `mark` false on both sides.
  - The MAX_RESOLVE skips and an unresolved folder count as placed on both sides when `usage` answers. That limit is pre-existing.
  - Trees given by the caller: only `stale` passes `trees`, and it ignores the return value.
  - A subagent turn end has `isMain` false, so it empties nothing on either side (A2 equal).
- **Callers:** `git grep "snapshot(" e0afed3 -- mods/` finds only the definition and `refresh`'s call. The default `mark` is never used.

### Holds
- `git diff 1bfa021 e0afed3 -- mods/shawarma-companion/hooks | grep -c '^+.*\$\.session'` prints 0, so no session call is added.
- A6 (every session call never answers from the turn end on), with context off and on, on both sides: `n: 2, doneAt: 4000, log: [cwd@0, cwd@2000]`.
- The longest other turn ends: P3 2000 ms, N2 2500 ms, A5 4000 ms. All are within "at most eight … 16 seconds".

### Enumeration: NOT RUN, because the diff cannot change it
- `mark.isPlaced` differs from 1bfa021's `isPlaced` only when `snapshot` throws after `claim` returns. That needs `usage` or `$.clock.now` to fail; `pick` is pure.
- B1 (`review3a/b1r.tail.tsx`) and the sweep (`fixreview3/sweep-*.tail.tsx`) fault only `session.cwd`. `grep -n "usage\|clock.now"` over both finds nothing. `snapshot` makes no cwd call after `claim`: the refresh throws before `snapshot` when the cwd is lost, and `claim` reads the cwd before it returns.
- So every B1 and sweep reading must equal round 5's fix side.

### Docs on e0afed3 (README and CHANGELOG are unchanged from 1bfa021: `git diff` prints 0 lines)
- **README :36**, "a marker … written during one of the session's own … Bash calls … This catches a marker a Bash command writes into another worktree": **true**. G1 bash 70 and A5 (every offset) read k.
  - "A marker another session writes at that same moment is claimed too": **true**, and no longer stretched across a `usage` give-up (N1 other reads 1run).
  - Caveats on both sides: F1 (a failed `.shawarma` listing at the turn end) and F2 ("Subagents' calls count" fails for a subagent call in a slow turn end's tail).
- **README :38**, "the last 64 files … a worktree made and written in the same turn is claimed once git lists it": **true** (G1w reject, never and instant at 70 read k).
- **README :40:**
  - "a call that gives up claims nothing that update": **true** (A1, G1).
  - "draws nothing until the working directory is read again": **true** (A2 reject/never s1 and s2 are `[]`).
  - "finds the worktrees again": **true**.
  - "An update that cannot learn when the session started draws nothing": **true** (N1, P1: the reading right after the `usage`-fault turn end is `[]`).
  - "at most eight … 16 seconds": **true** (A6).
- **CHANGELOG 0.3.4:** **true**. A1–A3 are equal on both sides, and the diff does not touch that path. It does not mention W3-R5 or W3-R6.

### Not executed
- B1 and sweep enumeration: NOT RUN (reason above).
- F1's candidate fix: unexecuted.
- Wall-time growth of the lists under F1 or F2: NOT RUN (the kit stops each test at 5 s).
