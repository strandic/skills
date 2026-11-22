## Fix review 3a (adversarial, executed) for skills-oz54: pre-fix 1a6d0cc against fix 3391a63

**In short:** the fix closes the problem it was written for. It adds no wrong label that the pre-fix code lacks, no hold beyond the README's limit, and no error that reaches a caller. I found two new problems of my own (F1, F2). Two sentences in the docs are false (F3).

**How I ran it:** I copied each commit's mod folder into a scratch folder and ran `claude plugin test` on each copy. Every probe ran on the pre-fix copy, the fix copy and the all-instant run of the same sequence (the control). The probes and outputs are in `/Users/jonathan/Documents/strandic-skills/.worktrees/oz54/docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview/`. The scratch copies are removed, and I made no worktree and no commit.

**Liveness probe (P0, V14's sequence, `t.tail.tsx`):**
- Pre-fix after the check: `[m, other tree: w]`.
- Fix: `[w, other tree: m]`.
- Control: `[w, other tree: m]`.
- Only the fix passes it.

### 1. Call sites

Every code call site is in `hooks/register.tsx`. A search of the whole tree finds the names elsewhere only as unrelated words (beans, model.ts "stale:", scripts) or in tests.

**`readMainCwd`** (defined at :621; the fix adds `if (isCwdLost) lastTrees = null` at :625):
- :689 (the new check branch): new. P0 and P1 show it.
- :696 (`stale`, with the trees known), :775 (`tool.call`, main session only) and :793 (`turn.complete`, main session only): the same calls as before. They now also clear `lastTrees` when the read is lost. The effects are listed under `lastTrees` below.

**`isCwdLost`:**
- Set at :624 and cleared at :746 (`session.start`): unchanged.
- Read at :635 (the throw in `refresh`): unchanged.
- Read at :689: new.

**`lastTrees`:**
- :636 (set in `refresh`): unchanged.
- :687 and :692 (`stale`): changed. After a loss the check takes the new branch.
  - P1, reject, no move, pre-fix: the rows stay drawn at every tick while the read fails.
  - P1, fix: the rows go at the second tick, then come back at the first tick whose read answers.
- :797 (`turn.complete`, `lastTrees?.isFromGit`): changed. After a lost read at a turn end it is now null, so the turn's folders and call spans are kept for the next turn, not cleared.
  - P3c (70 calls in one turn; tree x listed before the turn end; turn end rejecting): pre-fix `[m, 1 run in another worktree]`; fix `[m, other tree: k]`; control `[m, other tree: k]`.
  - So the fix now matches the control here, where the pre-fix code lost the claim. The CHANGELOG does not mention this.
- :895 (the pane's `lastTrees?.reals`): changed. See F2.

**`stale`:**
- :666 (the check timer): its catch is unchanged. The new branch cannot throw.

**`refresh`:**
- :690 (new branch), :718, :755, :784, :794: what they see changes only through `lastTrees` and the new branch.

### 2. Attacks

**P5, the hold.** The fix's new check branch made 5 session calls (cwd, root, id, root, usage) over about 10 s. The pre-fix code made 6 calls on the same tick. This is within "at most eight things … 16 seconds".

**Errors.** No error reached a caller and no unhandled rejection appeared in any output. The only HooksError lines were from a mounting mistake in my first pane probe, which `t2`/`t3` correct.

**Probes with no difference between pre-fix and fix:**
- P4: a stale late answer racing a move.
- P6a and P6b: rows empty before the loss.
- P7: a subagent call or a rejecting turn end inside the check's slow re-read.

**The sweep (`sweep.gen.py`, `sweep-classify.py`, `sweep-breakdown.py`):**
- Design: 3 events from {Bash, subagent Bash, turn end, 15 s tick, /clear start}, starting from every event. One event's cwd answers 3 s late or never. Every move position. 3 500 runs per side, 17 500 reads, 0 test failures on either side.
- Wrong label that differs from the control: pre-fix 526 reads, fix 208.
- Of the fix's 208:
  - 196 are reads taken while a faulted Bash call is still waiting on its give-ups (up to 6 s). They show the rows drawn before the move, and the pre-fix code shows the same reads. This is lag, not a lasting label.
  - The other 12 are F1.
- Reads after 16 s idle and after the last main call: pre-fix has 236 wrong-and-differs reads (the original finding), the fix has 0.

### Findings

**F1 (`own`; pre-existing, not closed by the fix).** When the check's own read gives up and no marker changed, the check leaves the rows drawn until the next tick, up to 15 s.
- Cause: `stale` reaches `refresh` only when something changed, so the loss at :696 empties nothing.
- Minimal repro, P1 (`t.tail.tsx`): rows drawn, then the cwd rejects, then wait 20 s.
  - Pre-fix: rows at tick1 and tick2, and still at tick3.
  - Fix: tick1 `[m · trivial · since 14:00, other tree: w · trivial · since 14:00]`, tick2 `[]`.
  - Control: rows throughout.
- With a move first, P1 move=true, fix: tick1 shows `[m, other tree: w]` while the session is in w. The control shows the same, so that read alone is the known check-path bug skills-mizx.
- The case where the control is right, sweep `S tick,sub,bash never,instant,instant 0`: read 1 is `[m, other tree: w]` on both pre-fix and fix, and `[w, other tree: m]` on the control. The subagent's refresh ran with the old directory while the check's read was still waiting, and the check's later loss left those rows drawn. The sweep has 12 such reads, all equal on pre-fix and fix.

**F2 (`own`; new with the fix; pane only, about 2 s).** On a tree that git spells through a link, the pane says "plan dir outside its tree" for an inside plan folder.
- When: between a lost read (which now nulls `lastTrees`) and the refresh that empties the rows.
- Repro P2b (`t3.tail.tsx`):
  - Setup: git lists `/lnk/r`, which links to `/real/r`. The row's plan folder is missing, then created.
  - A Bash call's cwd never answers. The pane is read at 4.5 s.
- Readings:
  - Fix: `shawarma: p: plan dir outside its tree (/lnk/r/.shawarma/active-p)`.
  - Pre-fix: the brief (`**p** · plan 1 … Recap`).
  - Control: `**p — inside** · plan 1 …`.
- It fails toward saying "outside", so nothing is read where it should not be. The truth is that the folder is inside.

**F3 (`own`, docs).**
- README: "When the working directory cannot be read after a tool call, at a turn end or in the 15-second check, the mod forgets the one it knew and the worktrees it found from it, and draws nothing until the working directory is read again". This is false for the check: F1/P1 show the rows still drawn 15 s after the check's give-up. The rest of the paragraph held in my readings: the re-read at the next tool call, turn end, check or start; trees found again from the folder read (P0, P1 tick3); and "eight … 16 seconds" (P5).
- CHANGELOG 0.3.4: "the mod forgets it and draws nothing until it reads it again, at the next tool call, turn end or 15-second check". This is false in two ways:
  - The same check case as the README (P1).
  - "the next tool call" includes a subagent's call, which never reads the directory. V9 shows nothing drawn after a subagent call. The README says "the main session's".
  - It also leaves out session start, which the README lists.
