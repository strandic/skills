## Rebase review: skills-cm2l onto origin/main (`f1ed7f4`), head `8eea52b`

**Verdict: no findings.** The rebase lost nothing and duplicated nothing. The branch's code is the same as before the rebase. I found no semantic conflict between the cm2l check changes and the skills-bnbu store clean-up. All readings below were run. The four probe tests ran in scratch copies only.

### 1. Range-diff (`git range-diff cc230ee..cm2l-pre-rebase origin/main..8eea52b -- mods/`)
- Commits 3, 4 and 5 are `=` (unchanged).
- Commit 1 (`b9e9288`, the tests) changed only in context. The `cm2l: the 15 s check survives a failed pass` describe block is now appended after bnbu's `skills-bnbu: one deadline per prune pass…` block, at the end of the file. Placement is correct.
- Commit 2 (`9cd2b82`, the fix) lost its plugin.json version bump, because main is already at 0.3.1. Its CHANGELOG lines were merged into main's `## [0.3.1]` section. Commit `f4a72fe` then moves them out.

### 2. Commit `f4a72fe` (version 0.3.2)
- plugin.json goes from 0.3.1 to 0.3.2.
- CHANGELOG order is now `[0.3.2]` (the three cm2l/0wsk Fixed items plus the Removed item), then `[0.3.1]` (the two bnbu/6y0d items, word for word as on main), then `[0.3.0]`.
- No line is lost or duplicated.
- `grep -rnE '^(<<<<<<<|=======|>>>>>>>)' mods/shawarma-companion` finds nothing.

### 3. Auto-merged `hooks/register.tsx`
**The branch's code is unchanged.** I took the `+`/`-` lines of `git diff cc230ee cm2l-pre-rebase -- …/register.tsx` and of `git diff origin/main HEAD -- …/register.tsx`. The two sets are identical (`diff` is empty).

**Main's side was carried over unchanged.** For README.md, model.ts, band.test.tsx and index.d.ts, I compared `git diff cc230ee origin/main` with `git diff cm2l-pre-rebase HEAD`. The changed lines hash to the same value for every file (for example, tests: `ad1a48f6…` on both sides).

**Reading the code:**
- `failed()` resets `lastScan`, `lastListed`, the rows and the counts. It does not touch the claims or `restoredFor`.
- `restore` is retried at the next `claim`.
- `within` cancels its timer on every path, and `prune` cancels its deadline in `finally`.
- A check pass waits at most a few 2 s bounded calls, well under 15 s, so passes do not overlap.

I wrote four probes, appended as an extra describe block to scratch copies of HEAD, origin/main and cm2l-pre-rebase. The file is `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/c1e1be1d-815d-4a37-964f-d9c10f46049f/scratchpad/lane-rebase/probe.tsx`. P3 was rewritten after its first version, so the file holds P1, P2 and the second P3. "Expired entries" below means `claims:` entries older than 30 days.

| Probe | HEAD | cm2l-pre-rebase | origin/main |
|---|---|---|---|
| **P1.** The store fails at the first update, then recovers. Does the 15 s check run `restore` and `prune`? Does any 2 s timer fire in the next 10 s? | pass: expired entries 3 → 0, row kept, 0 timers fired | pass | pass |
| **P2.** One check pass throws (`clock.now` rejects) while the store fails. Then both clear. | pass: row gone, then back; prune runs inside the check (3 → 0); 0 timers fired | pass | fail as expected: the check stopped after the failed pass, so the row stays gone and 3 expired entries remain. This is the intended cm2l change (Q3), not a regression. |
| **P3, first version.** A read fails after the store starts hanging. | — | — | — |
| **P3, second version.** The store never answers from the start, and plan.md fails to read during the check. | store gets per pass `[1, 2, 2]`; band reads `shawarma: skills-x: could not be read`; expired entries kept at 3; full row back once the read works | — | gets `[1, 1, 0]`; row dropped and the check stopped |

P1 and P2 ran on all three trees. The first version of P3 was a dud: plan.md's time never changed, so the check did not read it again. P3 has no expected values. It fails by design so the test runner prints what it measured, and it ran on HEAD and origin/main only.

**What P3 shows:**
- On HEAD, a check pass that a problem row forces to refresh asks for the session's own store entry twice: once in `stale`'s `claim`, once in `snapshot`'s `claim`. That is at most about 4 s of waiting per 15 s pass.
- On main, every check pass that ends in a refresh pays the same double ask. HEAD pays it more often only because problem rows now force a refresh each pass.
- This is a cost only, not a fault. Prune is correctly never reached while the own entry cannot be read.

### 4. Tests lost or duplicated?
I listed the `test(`/`it(` lines of band.test.tsx at each ref:

| Ref | Test lines |
|---|---|
| cc230ee (old base) | 262 |
| cm2l-pre-rebase | 274 (16 added, 4 removed on purpose: R2 ×2, N11, "21 markers … unread sentence") |
| origin/main | 270 (8 added: U1–U7, K9; 0 removed) |
| HEAD | 282 |

- `(base − removed + cm2l adds + bnbu adds)` compared with HEAD with `diff`: no difference.
- `uniq -d` on HEAD's list: no duplicates.
- Runner totals add up: 277 at the old base, 292 pre-rebase (+15), 286 on main (+9), 301 at HEAD. 286 + 15 = 301.

### Test runs
Command: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test <copy>`, on `git archive` copies under the scratchpad folder `lane-rebase/`.

| Ref | Clean runs | Result |
|---|---|---|
| HEAD | 6 | 301 pass / 0 fail every time |
| origin/main | 6 | 286 / 0 |
| cc230ee | 1 | 277 / 0 |
| cm2l-pre-rebase | 9 of 10 | 292 / 0 |

**One flaky run, not at HEAD.** The very first run of cm2l-pre-rebase gave **290 pass / 2 fail**. I did not capture the failing test names. The next 9 runs of that tree were 292 / 0. I did not reproduce it, and none of the HEAD runs failed. If you want it chased, rerun the pre-rebase copy until it fails and log the names.

### Worktree status
`git -C /Users/jonathan/Documents/strandic-skills/.worktrees/cm2l status --short` prints nothing. I made no edits, staging, commits, stashes or branches in the repo.
