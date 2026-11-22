---
# skills-oz54
title: 'shawarma-companion: a session.cwd call that never answers holds the tool call forever; the README says session calls give up after 2 s'
status: in-progress
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-22T07:44:49Z
updated_at: 2026-11-22T07:44:49Z
---

Found by the skills-bnbu run, fix-review lane (docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/reports/run/lane-3b-fix/report.md, Note 2). Pre-existing. $.session.cwd() has no time limit (register.tsx lines 222, 649, 705, 719, 737 use only .catch; $.session.usage() at 584 too). With session.cwd never answering, the first Bash call was still pending after 10 s of engine clock (PROBE-F sessionCwdHang done=false); the hang at line 705 comes before next(e), so the tool call never runs. README: 'Each call to the session or the store gives up after 2 seconds' is false for the session half.

## Plan paused: 1 question (2026-11-22)

Spike on base `f1ed7f4`, sketch `docs/plans/2026-11-22-skills-oz54-session-calls-bound/sketch/sketch.patch` (5 files, 164 insertions, 12 deletions), in `.worktrees/oz54-spike`. Research and attack reports in `reports/research/report.md` and `reports/attack/report.md` beside it.
- The sketch races the 10 unbounded `$.session.cwd/root/usage` calls (register.tsx 219, 396 ×2, 417, 585, 649, 706, 719, 737, 765 at the base) against 2 s with the existing `bounded()` helper. `root` at 396 and 417 was unbounded although s6qg Q6 ruled the root bounded.
- `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin test mods/shawarma-companion`: sketch `295 pass` / `1 fail` / `Ran 296` (the 1 is V10, Q1's test); without V10, `295 pass` / `0 fail` in 5 of 5 runs. Base modules with the new tests `288 pass` / `9 fail` (V1–V6, V8, V9, "the file ran to its end"); V10 passes on the base. Base alone: one unnamed failure in 10 runs (`285 pass` / `1 fail` / `Ran 286`), the same flake as skills-4yek.
- On PR 13's head (skills-cm2l, `95b016c`) with the sketch's register.tsx, README and tests: `310 pass` / `0 fail`.
- Mutants, one per site (the 2 s bound undone): 12 of 12 turn their site's V test red; the timer cancel dropped turns K9 and V7 red.
- `claude plugin validate`: `✔ Validation passed`. `tsc -p` against the 2.1.330 types: exit 0; a wrong fix `bounded($, $.session.cwd)`: `error TS2345`.
- Attack lane: every site, never answering alone, settles in 2 000 ms (base held past 60 s; the 15 s check recovers at 30 s on the base). Reject and never answering give the same band and claims at 39 of 39 sites. The README's first numbers ("at most five", "about 10 seconds") were false: a Write held 16 000 ms with 8 session calls, the 15 s check 12 000 ms with 6. The sketch's README now says at most eight session calls per update, 16 s.

> **What this is about:** The session moves to another worktree. Its working-directory call then answers after 3 s, past the new 2 s give-up. The band keeps the old directory and labels the session's own tree "other tree:". It labels the tree it left as the current one. The old code waited for the answer and drew the right labels after 6 s. A failed (rejected) call already gives this wrong label today. The change makes a slow call reach it too. The rule is right, the ticket is right, and the gap is in the code: a call that gives up keeps the last directory it knew.
>
> A. Forget the directory on a give-up (after a writing call, at a turn end, in the 15 s check). That update then draws nothing rather than a wrong label. Executed (`sketch/option-forget.patch`): the label test V10 passes. Two other tests change: a turn end takes 4 s, not 2 (V8), and the 15 s check does not redraw while the call stays slow (V5). A rejected call draws nothing too, where today it keeps the old labels. **Recommended**: the band never says something false.
>
> B. Keep the last directory (the sketch as it is). The wrong label stays until the call answers in time again and the next writing call or turn end re-reads the trees. Executed: V10 fails, with `"other tree: w · trivial · since 14:00"` drawn 3 times. A new ticket would hold the residue.
>
> Either way, a new ticket covers one more gap: a 15 s check that gets the new directory does not re-read which tree is current. Attack A4 saw the wrong label survive that check.

**Q1 (RULING, open)**: the A4 wrong label above. A or B.

> **What this is about:** five smaller choices. Silence accepts each recommendation.
>
> D1, version. PR 13 (skills-cm2l), now open, already takes 0.3.2. A: this change ships as 0.3.3 with its own changelog section, after PR 13 merges (recommended). B: 0.3.2 now, and PR 13 renumbers. Executed: the sketch's register.tsx and README apply cleanly on PR 13's head. The version, the changelog and the end of the test file conflict.
>
> D2, the band with context on. When the context figure answers between 2 and 30 s, that drawing now shows no row. Before, it showed the row late. The next drawing shows the row again. Executed: attack A11, usage at 2.5 s. This leaves something out but says nothing false. A: accept (recommended). B: draw the row without the figure (`unexecuted`).
>
> D3, repeated cost. A session call that gave up is asked again at every update. So a session that never answers costs each writing call 2 s before it runs, every time. A: accept (recommended). It is an engine fault, and the README states the cost. B: remember the give-up until the turn ends (`unexecuted`).
>
> D4, new tickets for gaps that were there before this change: (a) the 15 s check updates the directory but not the current tree; (b) a subagent call whose project-root read fails counts the session's own run as "in another worktree" (attack report, A1 sub); (c) existing tests leave a rejection nothing handles, which shows as "the file ran to its end", probably in the 15 s check's catch. A: file all three (recommended). B: file none.
>
> D5, test V7 (no 2 s timer fires once every call has answered) now also checks that some timer was asked for. Without that check it passed on the old code and proved nothing. A: keep (recommended).

unruled: D1 version — default 0.3.3 after PR 13
unruled: D2 late context figure draws no row that drawing — default accept
unruled: D3 a give-up is asked again at each update — default accept
unruled: D4 three pre-existing gaps — default file three new tickets
unruled: D5 V7 precondition — default keep

**Q1, D1–D5 ruled (owner: "Go with reco")**: Q1 A, a working-directory call that gives up forgets the known directory and that update draws nothing. D1 0.3.3 after PR 13. D2 a late context figure draws no row that drawing. D3 a give-up is asked again at each update. D4 three new tickets. D5 V7 keeps its precondition.

## Plan paused: 1 question (2026-11-22)

Re-spiked on Q1 A; brief written at `docs/plans/2026-11-22-skills-oz54-session-calls-bound/plan.md`, `freeze_check.py` PASS (F10 on this note), not frozen until Q2.
- Attack lane round 2 (`reports/attack2/report.md`): forgetting the directory alone gave two new wrong labels — after a forget a subagent's event labelled the trees by the project root (12 of 12 rows), and a turn end's give-up during a running 15 s check redrew from the trees found before a move (48 of 6 912 runs). The sketch now marks the directory lost (`isCwdLost`) until a main read answers or a session starts; while lost every refresh draws nothing. Re-run of the lane's 6 912-run enumeration on it: 0 label differences from the instant control, 5 292 absences.
- `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin test mods/shawarma-companion`: sketch `297 pass` / `0 fail` / `Ran 297` ×3; base modules with the new tests `287 pass` / `11 fail` / `Ran 298` (V1–V6, V8, V9, V10, V13, "the file ran to its end"). 14 of 14 mutants red. `tsc` exit 0; `claude plugin validate` `✔ Validation passed`.
- Per the orchestrator: the sketch no longer changes the version or the changelog (3 files: register.tsx, the tests, README); the brief names every function touched.
- Tickets filed (D4): skills-mizx, skills-laqh, skills-rb3j.

> **What this is about:** Your ruling D1 set this change to version 0.3.3, after PR 13 merges. Since then the orchestrator has said two more companion plans (skills-1tr4, skills-lhwh) share the version and the changelog, and that no plan should pick a number or write a changelog entry: the run picks the next free version after rebasing on whatever merged first. A, amend D1: the version and the changelog entry are set at run time, after rebasing, to the next free patch version (recommended; the sketch already leaves them out). B, keep 0.3.3: the run must merge right after PR 13, and the other two streams renumber.

**Q2 (RULING, open)**: amend D1, A or B.

> **What this is about:** Ruling Q1 said a give-up forgets the known working directory and "that update draws nothing". Round 2 showed one update was not enough: the next subagent event or a check already running then drew wrong labels. The sketch keeps the band empty until the main session's working directory is read again (the next main tool call or turn end, or a session start). A: keep this (recommended; executed, 0 wrong labels in 6 912 runs; the cost is a longer empty band after a failed read). B: forget for one update only (executed: 12 + 48 wrong-label rows).

unruled: D6 band empty until the main directory is read again — default keep

**D7 (DEFAULT, relayed by skills-orch)**: the owner ordered skills-lhwh (decisions pane) to run and merge first among the companion streams. At run time this change rebases on it, then picks the version and the changelog entry. This rules out Q2 B (keep 0.3.3); Q2 stays open for your answer.

unruled: D6 band empty until the main directory is read again — default keep
unruled: D7 rebase on skills-lhwh before picking the version — default keep

**D7 update (relayed by skills-orch)**: skills-lhwh opened PR 14 as companion 0.3.3, adding tests at the end of band.test.tsx. At run time, rebase on main after PR 14 merges and take the next version then (0.3.4 or later). The new describe block here also sits at the end of that file: expect a rebase conflict and keep both blocks.

## Plan ready (2026-11-22)

**Q2, D6, D7 ruled (owner: "Go with reco")**: Q2 A, the version and the changelog entry are set at run time after rebasing on main once PR 14 merges (reverses D1). D6 A, the band stays empty until the main working directory is read again. D7 A, rebase after PR 14 and keep both test blocks.

Brief frozen: `docs/plans/2026-11-22-skills-oz54-session-calls-bound/plan.md`. Waiting for `run`.

unruled: none

## Run (2026-11-22)

Go given. Branch `fix/oz54-session-bound` in `.worktrees/oz54`, from `origin/main` `c3c525d` (mod 0.3.3, skills-cm2l and skills-lhwh merged since the plan's base `f1ed7f4`).

**W3 (review)**: review 3a found a wrong label on the rebased base: after a lost read, the 15 s check redrew from the trees found before a move (`[m, other tree: w]` while in w; 270 reads in 6 912 runs). Owner ruled W3-R1 B (the check finds the trees again) and W3-R2 (README and CHANGELOG wording). Tests `8785cd4` (V14 red, V15), fix `3391a63`; suite `316 pass` / `0 fail`. Fix-review lane running.

**W3 round 3**: the fix review found the check's own lost read left the rows drawn up to 15 s, and a 2 s false pane line ("plan dir outside its tree"). Owner ruled W3-R3 C. Tests `05533c7` (V16, V17 red), fix `29f8f15`; suite `318 pass` / `0 fail`. Filed skills-f7a9 (a turn end's lost read loses a worktree claim; pre-existing) and skills-9u5j (labels from before a move while a slow read is in flight; pre-existing). Fix-review lane on round 3 running.
