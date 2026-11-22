## Fix review 4 (3a adversarial) for skills-oz54: control 29f8f15 against fix 3132753

**Result:** The fix closes G1 on the path it was written for. G1, G1w, V18's sequence, and my new sequences A1 to A3 (several lost turn ends in a row, a lost turn end followed by a subagent turn end, a lost turn end followed by fallback listing) now read `other tree: k` on the fix. 29f8f15 reads `1 run in another worktree` on all of them. I found two new outcomes, both `own`. **F1:** G1 still happens by a second path, a race with the 15-second check. The fix and 29f8f15 give the same reading there. A candidate fix closes it and keeps the suite green (319/319). **F2:** after a lost turn end, the fix can claim a worktree that only another session wrote, when the control would not. That claim follows the README's own documented rule, so it is low severity. B1 and the sweep, re-run on every sequence that has a main turn end, give identical readings on both sides: 0 differences and no new wrong labels. The change adds no session call. A lost turn end makes 2 session calls and waits 4 s on both sides, so the "eight … 16 seconds" limit holds. Docs: the README sentences the previous lane called false are now true in my readings, except under F1's race. The CHANGELOG 0.3.4 entry is true.

### How I ran it
- I made scratch copies of each commit with `git archive <sha> mods/shawarma-companion` under `scratchpad/fr4/` (pre = 29f8f15, fix = 3132753, try = fix + `try.diff`). I ran `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin test <copy>`. The scratch folder is removed. I made no commit, no stash, no checkout and no tracked edit. `git status` is clean.
- All files are in `docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview4/`:
  - Runners: `run.sh` (both sides), `try-run.sh` (the candidate), `job.sh` and `enum-run.sh` (the enumeration, 8 processes at a time).
  - Probes: `header.tsx` (copied from fixreview3), `a4.tail.tsx` (my attacks A1–A6), `l.tail.tsx` (liveness: fixreview3's G1, G2, G3 and G1w).
  - Readings: `a4-{pre,fix,try}.txt`, `l-{pre,fix,try}.txt`, `sweep-*.txt`, `b1-*.txt`, `suite-try.txt`. `summary.txt` puts them in short form, made by `summarize.py`.
  - Grader: `classify.py`, output in `classified.txt`.
- **Oracle check:** each probe is graded by a hand-written truth that shares no code with the mod. The first row must name the folder the session is in (m = /repo). A worktree the session wrote (X, marker k) must show `other tree: k`. A worktree only another session wrote (Y, marker y) must not. The all-instant run of the same sequence is the control. `classify.py` reads labels from the test's own `dir`, not from mod code.

### Liveness (control 29f8f15 first, then the fix)
`./run.sh l.tail.tsx l`; 24 pass and 0 fail on each side. Short form: k = `other tree: k`, 1run = `1 run in another worktree`.

| probe | 29f8f15 r1/r2/r3 | 3132753 r1/r2/r3 | all-instant |
|---|---|---|---|
| G1 reject/never calls=70 bash | 1run ×3 | k ×3 | k ×3 |
| G1w reject/never calls=70 | 1run ×3 | k ×3 | k ×3 |
| A1 reject/never, lost=1..3, mid/late (12 runs) | 1run on every r | k on every r | see A1 note below |

Only the fix passes. This covers V18's sequence, which is the same as G1w with reject.

### Findings

**F1 (`own`): G1 still happens through a race with the 15-second check. The fix and 29f8f15 give the same reading.**
- **Cause:** the clean-up tests the global `isCwdLost` and `lastTrees` after the refresh. It does not ask whether this turn end's own refresh placed the folders. The sequence:
  1. The turn end's cwd read gives up at +2 s, and its refresh's `discover` waits on a second cwd read.
  2. Meanwhile the 15-second check fires, and its cwd read answers. That sets `isCwdLost = false` and `lastTrees` to a git list.
  3. The check's refresh is still waiting in `claim` (here on `session.root`) when the turn end's refresh fails at +4 s.
  4. The clean-up sees `!isCwdLost && isFromGit` and empties `turnFolders` and `turnWindows` before anything placed them.
- **Reproduction:** `a4.tail.tsx` A5. The session sits in /repo. A Write puts the marker in X, then 70 writes go into their own folders, and then git lists X. The turn end's two cwd reads never answer. The check fires `off` seconds into the turn end. Its cwd read answers 1 s later, and its `session.root` answers 3 s after it is asked. Probe log: `cwd#1@0, cwd#2@2000, cwd#3@2200, root@3200`; the turn end ends at 4000.
- **Readings** (r1 after the next Bash, r2 after a 15-second check, r3 after a later instant turn end):

  | off | 29f8f15 | 3132753 | try |
  |---|---|---|---|
  | 0 (all instant) | k | k | k |
  | 2.2, 2.4, 2.6, 2.8 | 1run | **1run** | k |
  | 3.2, 3.4, 3.6, 3.8 | 1run | k | k |

  The fix equals the control at off ≤ 2.8, which is a liveness failure for "G1 closed". It is lasting: r3 still reads 1run.
- **Scope:** it needs a lost turn-end read, the check firing inside a 1–2 s window, and a second slow session call. That is rare but real.
- **Candidate fix (`try.diff`):** `refresh` returns `isPlaced`, which is true only when its own `snapshot` (and so `claim`) finished against a list where `isFromGit` is true. `turn.complete` does `const isPlaced = await refresh(...)` and `if (isMain && isPlaced) splice`. The three `return refresh(...)` lines in `stale` become `{ await refresh(...); return }`.
  - try readings: A5 gives k at every offset. Every other A1–A6, G1, G2, G3 and G1w reading equals the fix's.
  - Mod suite on try: 319 pass, 0 fail (`suite-try.txt`), including V18.

**F2 (`own`, low; follows README :36's documented rule): after a lost turn end, the fix claims a worktree only another session wrote. The control does not.**
- **Cause:** kept `turnWindows` keep call spans older than the last 64 calls past the turn end. A marker that another session wrote during one of those spans claims its tree once git lists it.
- **Reproduction:** `a4.tail.tsx` A4. During this session's Bash call 1, the test writes `/repo/.worktrees/y/.shawarma/active-y` with the call's time. Y is not listed yet. 70 Bash calls follow, then a turn end, then git lists Y, then a Bash call.
- **Readings** (r1 / r2 / r3):

  | run | 29f8f15 | 3132753 |
  |---|---|---|
  | turn end reject or never | 1run / 1run / 1run | **y / y / y** |
  | turn end instant (control) | m / m / 1run | m / m / 1run |
  | no turn end, instant | r3 = y | r3 = y |

  Truth: Y was not written by the session, so it should show 1run. The no-turn-end run shows the mod already makes this claim inside one turn, as README :36 says ("A marker another session writes at that same moment is claimed too"). The fix stretches that window across lost turn ends. The try candidate reads the same (y). Its turn end did not place, so it must keep the spans for G1's sake.
- **No fix proposed.** This is the cost of keeping spans. It could be noted in the README, or accepted.

**Other attacks (no finding):**
- **A1** (1–3 lost turn ends in a row, then a good one; X listed mid-way or late): the fix claims k in all 12 lost runs. The all-instant control reads 1run in all 6 of its runs, because X is listed only after the turn that wrote it ended. So the fix claims more than the control and is right by the truth oracle. Whether k is claimed now depends on whether that turn end's read failed. That is not a wrong label.
- **A2** (lost main turn end, then a subagent turn end and/or a subagent Bash): s1 and s2 are `[]` on both sides, because nothing is drawn while lost. After the next main Bash: 29f8f15 1run, fix k.
- **A3** (lost turn end, then git fails, so the fallback lists for a Bash and a turn end; then git answers): fix k at every read; 29f8f15 1run.
- **Labels after a move:** `turnFolders` and `turnWindows` are read only in `claim` (register.tsx :236, :251). They add to `held` and never to `trees.own`, so kept entries cannot change which folder a row is labelled with. The enumeration (below) agrees.
- **Growth:** the turn lists are capped at `MAX_TURN` = 4096, not 64. The 64 cap is for `folders` and `windows`, which carry over. A single 4096-write turn already reaches 4096 on 29f8f15. The fix only lets the lists stay full across lost turn ends. A good turn end that places them still empties them (A1 r3). Per refresh, `claim` still asks at most `MAX_RESOLVE` = 8 real paths. Those are file calls, not session calls. The wall-time growth probe (3 × 400+ writes) is **NOT RUN**: the kit stops each test at 5 s, and lost=3 with 70 writes per turn already timed out.

### Holds
- The diff changes only the condition, so it adds no session call.
- **A6** (every session call never answers from the turn end on; `context` off and on):

  | side | calls at the turn end | time to end |
  |---|---|---|
  | 29f8f15 | 2 (`cwd@0`, `cwd@2000`) | 4000 ms |
  | 3132753 | 2 (`cwd@0`, `cwd@2000`) | 4000 ms |

  Both are within "at most eight … 16 seconds". A5 also ends at 4000 ms on all three sides.

### Enumeration (re-run only for sequences with a main turn end)
Runner: `./enum-run.sh`; grader: `python3 -I classify.py`.

| set | side | runs | reads | differs from 29f8f15 | wrong label, unlike control | wrong label, equal to control | absences | fail / unhandled |
|---|---|---|---|---|---|---|---|---|
| sweep (1 708 runs) | 29f8f15 | 1 708 | 8 540 | – | 62 | 371 | 944 | 0 / 0 |
| sweep | 3132753 | 1 708 | 8 540 | 0 | 62 (all equal to 29f8f15) | 371 | 944 | 0 / 0 |
| B1 (4 864 runs) | 29f8f15 | 4 864 | 29 184 | – | 0 | 625 | 20 928 | 0 / 0 |
| B1 | 3132753 | 4 864 | 29 184 | 0 | 0 | 625 | 20 928 | 0 / 0 |

- The 29f8f15 readings equal fixreview3's fix-side readings on the same keys (sweep: True, 1 708; B1: True, 4 864).
- No difference was expected. These sequences write no file and their markers are older than every span, so kept lists cannot claim anything. The run confirms it.

### Docs on 3132753
The brief's README :35 and :37 are lines :36 and :38 in this file.

- **README :36**, "a marker in it was written during one of the session's own … Bash calls … This catches a marker a Bash command writes into another worktree": **true** (G1 bash 70 reads k). It is **false under F1's race** (A5 off ≤ 2.8 reads 1run). "A marker another session writes at that same moment is claimed too" is true, and A4 shows it now holds across lost turn ends (F2).
- **README :38**, "It checks the folders of the last 64 files … so a worktree made and written in the same turn is claimed once git lists it": **true** (G1w reject/never 70 reads k). It is **false under F1's race** (A5).
- **README :40:**
  - "a call that gives up claims nothing that update": **true**. G1 and A1 claim k only at later updates.
  - "draws nothing until the working directory is read again …": **true**. A2 s1 and s2 are `[]` until the main Bash.
  - "It then finds the worktrees again from the folder it reads": **true**.
  - "at most eight … 16 seconds": **true** (A6).
- **CHANGELOG 0.3.4** ("draws nothing until it has the folder again: it reads it at … or takes it from a session start"): **true** in A1, A2 and A3. This fixes the previous lane's wording point about session start. The entry does not mention F1 or F2.

### Not executed
- The wall-time growth probe (NOT RUN, 5 s per-test limit).
- The fix's own full suite. The brief says it is green, and I ran the suite only on the try candidate.
