Review lane 3b, round 1 of skills-5w5c: claims check of commit 2a4b0ae against db50198 (worktree .worktrees/5w5c)

Verdict: the commit changes no code, and the suite passes 308 / 0. Most claims read TRUE when executed. Two new claims read FALSE, or only partly true, on cases they do not mention. Both come from older behaviour that skills-blde (an ended call's span stays open in the capped lists) already describes. They are wording gaps, not code defects.

Setup. All work is in /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/4223d73b-665c-4520-bc14-c05fe749bdb1/scratchpad/review-fix1/. That folder has mod copies taken with `git archive`: v_2a4b0ae, v_db50198 and v_1f961fb (the base). v_2a4b0ae_i is the 2a4b0ae copy plus one line of instrumentation after `const spans = …` (register.tsx:253). On each refresh that line stores which spans are in openWindows, `windows` and `turnWindows`, and how many still have `to = Infinity`. The runner is `run.sh <variant> <part.tsx> <name>` and uses the same helpers as review3a. The probe files are p.part.tsx and e2.part.tsx, and the outputs are in out/.

**1. Code unchanged and suite**
- I diffed db50198 to 2a4b0ae under mods/ and filtered out comment lines. No changed lines are left. The only changes are register.tsx lines 70-72 (a comment) and one README.md line (line 36).
- Full suite on the 2a4b0ae copy: ` 308 pass`, ` 0 fail`, `Ran 308 tests across 1 file.` Output is in out/suite.out.

**2. Claims check (2a4b0ae; base 1f961fb as the control)**

Comment, line 70: "`windows` and `turnWindows` hold the same span object". TRUE while the call runs.
- Probe R1 on _i, while the call runs: `"open":[{"inW":true,"inT":true,"to":"Infinity"}]`. This repeats the C1 reading.
- It holds only until the span is evicted. In R3, after a main turn end and 64 writes: `"open":[{"inW":false,"inT":false,"to":"Infinity"}],"wInf":0,"tInf":0`. That is still consistent with the claim.

Comment, line 71: "so the call's end closes it there too". TRUE on the normal path. FALSE when the end-time clock read fails.
- Probe E1, a finite call that ends: `"ended":{"open":[],"wInf":0,"tInf":0}`. A marker from another session 60 s later gives rows `["main-1 · trivial","1 run in another worktree"]`, so it is not claimed.
- Probe E2 (own), where the call ends and answers but `clock.now` rejects at its end: `"settled":"answered"`, `"ended":{"open":[],"wInf":1,"tInf":1}`. Rows: `["main-1 · trivial","other tree: other-1 · trivial"]`. The call ended, yet its span is still open in both lists and another session's marker is claimed.
- Base 1f961fb gives the same rows, so the behaviour is old (the skills-blde bean names this path).
- After a main turn end and 64 writes (E2-evict=true), the marker is not claimed.

Comment, lines 71-72: "an abandoned call's span stays open there until evicted". TRUE.
- AB0 (a hook above answers first; the call beneath never ends): `"afterAbandon":{"open":[],"wInf":1,"tInf":1}`. Rows show `other tree: other-1`. This repeats A5, with the same rows on base.
- AB1, after eviction: `"wInf":0,"tInf":0` and rows show `1 run in another worktree`.
- The same AB0 reading shows `open:[]`. That confirms the comment's older claim that aborting `next.signal` removes the span from openWindows.
- The wording misses the E2 path above. That span stays open because the end-time clock read failed, not because the call was abandoned.

README: "A call counts while it runs, however long, so a long subagent call claims a new marker it writes partway through". TRUE.
- Probe R1: the call writes its own marker 3 hours in, after a main turn end and 64 writes. 2a4b0ae: `"during":["main-1 · trivial","other tree: wt-7 · trivial"]`.
- Base control: `"during":["main-1 · trivial","1 run in another worktree"]`, so the claim is FALSE on base, as expected.

README: "A call the engine abandons counts on until a main turn end and 64 newer writing calls". TRUE as worded, with one gap. Each case is an abandoned call, then the action, then another session's marker:

| Case | What happened after the abandon | Result |
|---|---|---|
| AB0 | nothing | `other tree: other-1` (claimed) |
| AB1 | main turn end + 64 writes | `1 run in another worktree` (not claimed), `wInf 0, tInf 0` |
| AB2 | main turn end + 63 writes | `other tree: other-1` (claimed), `wInf 1, tInf 0` |
| AB3 | 64 writes, no turn end | `other tree: other-1` (claimed), `wInf 0, tInf 1` |
| AB4 | subagent turn end + 64 writes | `other tree: other-1` (claimed) |
| AB5 | 64 writes, then main turn end | not claimed (the order does not matter) |
| AB7 | main turn end + 64 writes made by a subagent | not claimed (subagent writes count) |
| AB8 | main turn end + 64 writes, all before the abandon | not claimed right after the abandon |

- AB8 fits "newer", which means newer than the call's start.
- Gap, AB6b (own): the main turn end must be one whose listing came from git. AB6b is a main turn end while `git worktree list` fails, then 64 writes, then a subagent turn end so git lists again. It reads `"wInf":0,"tInf":1` and rows `other tree: other-1`, so the marker is still claimed.
- Control AB6c, the same steps with git working: `1 run in another worktree`.
- The code that causes this is register.tsx:790, `if (isMain && lastTrees?.isFromGit === true)`.
- AB6 alone, without the later subagent turn end, shows no row at all for the other worktree. That happens because the fallback list is kept until the next turn end. It is not a claims issue.
- Every AB case gives the same rows on head and on base, so abandoned-call behaviour did not change.

README, unchanged sentence: "A call that never ends keeps counting …". TRUE on head.
- Probe R3, a call that is never abandoned and never ends, then a main turn end and 64 writes: `["main-1 · trivial","other tree: other-1 · trivial"]`.
- Base gives `1 run in another worktree`, so this is new behaviour from the fix.
- The sentence does not cover a call that was abandoned and also never ends underneath (AB1 is not claimed). The sentence just before it covers that case, so I treat this as acceptable.

**3. Call sites in 2a4b0ae (docs/ excluded)**
- openWindows, all in mods/shawarma-companion/hooks/register.tsx: line 74 (declaration), 253 (spans), 754 (add), 755 (delete in release), 760 (a comment).
- windows, in register.tsx: line 62 (declaration), 70 (the comment), 253, 752 (remember at start), 763 (remember at end). Every other `-w windows` hit is unrelated: .beans prose, evals fixtures, and the scripts/*.mjs comments and graders.test.mjs:691.
- turnWindows, in register.tsx: line 52 (declaration), 70 (the comment), 253, 753, 764, 791 (`splice(0)` at a main turn end). Two more hits are prose in the skills-5w5c bean (.beans/skills-5w5c--…md, lines 13 and 38).

**4. Findings (`own`)**

F1, low, wording. The comment's "the call's end closes it there too", and its limiting the open span to "an abandoned call", miss one path: a call that ends while its end-time clock read rejects. Its span stays at `to = Infinity` in `windows` and `turnWindows` until eviction. The README's "A call counts while it runs" is wrong for the same case: that call keeps counting after it ends.
- Reproduction: e2.part.tsx test `E2 … evict=false`. Run `./run.sh v_2a4b0ae_i e2.part.tsx E2_i`.
- Output: `PROBE E2-evict=false {"settled":"answered","rows":["main-1 · trivial","other tree: other-1 · trivial"],"ended":{"open":[],"wInf":1,"tInf":1,…}}`.
- Base gives the same rows. The skills-blde bean lists this path, so the fix is to the wording only. For example: "a span whose end is not recorded (abandoned call, or a failed end-time clock read) stays open there until evicted".

F2, low, wording. "until a main turn end and 64 newer writing calls" only counts a main turn end whose worktree list came from git. A main turn end on the fallback list (git failed) does not clear `turnWindows`.
- Reproduction: p.part.tsx test AB6b. Run `./run.sh v_2a4b0ae_i p.part.tsx P_i2`.
- Output: `PROBE AB6b {… "rows":["main-1 · trivial","other tree: other-1 · trivial"], "afterAct":{"open":[],"wInf":0,"tInf":1,…}}`.
- Control AB6c: `"rows":["main-1 · trivial","1 run in another worktree"]`. Base gives the same result as head.

N1, note. The comment cites `skills-blde`, but that bean is not in 2a4b0ae. It is on main (commit ccf9e05), so the citation will resolve after the merge.

All-clear items, each backed by the executed readings above:
- no code change
- suite 308 / 0
- R1 and R3 are true on head and false on base
- the 63-write and subagent-turn-end boundaries read exactly as the README says
