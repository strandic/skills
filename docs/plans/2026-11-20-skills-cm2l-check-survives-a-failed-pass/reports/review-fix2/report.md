# Fix review of commit a651a69 (skills-cm2l): the two comment edits

## Verdict
Both new comments are true. Two small gaps remain, both minor. No code changed. The suite passed 292 / 0 on nine of ten runs. One early run had a single failure that I could not capture (see Suite below).

## How I ran it
- Clean copy: `.../scratchpad/lane-fix2/head`. `diff -r` showed it matches the worktree. `mods/` has not changed since a651a69 (HEAD is fd422fe).
- Probe copy: `.../scratchpad/lane-fix2/probe/tests/probe.test.tsx`. It uses the harness from band.test.tsx lines 1–222. A `state.get` spy captures the `rows` atom, so the row's fields can be read.

## Comment 1: `refresh`, register.tsx line 584
New text: "a failed discovery or pass draws nothing, and a row whose files fail to read is drawn as `could not be read`, never with a value read earlier."

- **Finding 1 repro (probe F1).** The band showed `skills-x — the thing · run W1 · since 14:01 · 0 decisions`. Then the marker was rewritten to W2, `usage` was added to `fail`, and `bash 'true'` ran. Result: band `undefined`, pane `Shawarma state could not be read.`, rows `[]`. "A failed pass draws nothing" is true. Before this commit the doc covered only discovery.
- **Second clause.** In probes F2a and F2d, a marker read failure and a decisions.md read failure each draw `shawarma: skills-x: could not be read`. The empty title and step show no earlier value is kept. True.
- **Nit 1.** "Pass" is not defined in this comment. "Draws nothing" holds for the band and the more-row. The pane, though, does draw a line: `Shawarma state could not be read.`
- **Nit 2 (incomplete).** The second clause names only file reads. A row whose plan-dir `exists` rejects is also drawn as `could not be read` (probes F2b and F2c). The `problem` doc covers that case; this comment does not.
- **Out of scope.** I made `clock.now` reject once at a tool call. The failure hit the `tool.call` hook's own `clock.now` (line 714), before `refresh` ran. The old W1 row stayed. That is not a `refresh` failure, so the comment is not wrong.

## Comment 2: `problem`, types/index.d.ts lines 28–33
New text: "`could not be read` (the marker, plan.md or decisions.md failed to read, or the plan dir did not list and could not be asked whether it exists; only the ticket, marker, tree, since and labels are set)."

- **Marker read fails (F2a).** Band: `shawarma: skills-x: could not be read`. Pane: `shawarma: skills-x: could not be read (/repo/.shawarma/active-skills-x)`. True.
- **plan.md read fails.** The existing C6 `plan.md` test passes. True.
- **decisions.md read fails (F2d).** Band reads `could not be read`. True.
- **List of DIR fails and `exists DIR` rejects (F2b).** Band reads `could not be read`. This is finding 2's second repro. True.
- **Fields set.** Captured rows (F2a, F2b, F2d):
  - Set: `ticket`, `marker`, `tree`, `since`, `isEarlier`, `isStale`, `isOtherTree`, and `problem`.
  - Empty: `decisions: 0`, `planDir: ""`, `planAt: null`, `decisionsAt: null`, `title: ""`, `step: ""`.
  - F2e drew the band `other tree: stale: shawarma: skills-y: could not be read`, which confirms `isOtherTree` counts as a label.
  - True.
- **Minor gap (F2c).** "The plan dir did not list" misses one path: the plan dir is never listed at all. In F2c, `stat once DIR` rejects, so `isPlanInside` returns `unknown` and no list call is made. Then `exists DIR` rejects. The band reads `shawarma: skills-x: could not be read`, and the log shows only `stat /repo/docs/plans/2026-10-16-skills-x-thing resolve`, with no `list`. Control: the same run with `exists` answering gives `· plan dir not readable: /repo/docs/plans/2026-10-16-skills-x-thing`. Suggested wording: "the plan dir was not listed (its list or its real-path stat failed) and could not be asked whether it exists".

## Code unchanged
- `git diff --name-only 59bec42..a651a69 -- mods/` lists only register.tsx and index.d.ts.
- Both versions of each file, with comments stripped: `diff` is empty for both files.
- `bun build --no-bundle` of register.tsx at both commits gives byte-identical output (28682 bytes each, `cmp` equal).
- No call sites changed.

## Suite on the head copy
- Run 1: 291 pass, 1 fail. I did not capture which test failed.
- Runs 2–10 (logged to `run2.log` … `run9.log`; each covers one run; run2.log holds two later runs because the file was overwritten): 292 pass, 0 fail.
- So the expected 292 / 0 holds, but I saw one failure in ten runs and cannot name the test. Nothing in this commit could cause it, since the code is identical. It looks like an existing flaky test.

## Repo state
`git -C /Users/jonathan/Documents/strandic-skills/.worktrees/cm2l status --short` is empty.
