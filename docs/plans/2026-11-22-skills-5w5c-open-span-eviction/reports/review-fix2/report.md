Review lane 3b, round 3 of skills-5w5c (open-span eviction): commit 617b519 checked against 2a4b0ae.

Verdict: the commit changes prose only, and the suite passes 308 / 0. Every claim in the two changed sentences reads TRUE when run, for the cases they name. I found three small wording gaps of my own. All three come from older behaviour, and none needs a code change. No `mutant:` rows came with the brief, so I ran none.

Setup. Everything is in /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/4223d73b-665c-4520-bc14-c05fe749bdb1/scratchpad/review-fix2/.
- v_617b519 and suite_617b519 are `git archive` copies of the mod.
- v_617b519_i is the same copy plus the previous lane's one instrumentation line after `const spans = …` (register.tsx:254). On each refresh it stores the spans in openWindows, and how many spans in `windows` (wInf) and `turnWindows` (tInf) still end at Infinity.
- run.sh is the previous lane's runner, pointed at this folder. Probe files: q.part.tsx, n2.part.tsx, plus copies of p.part.tsx and e2.part.tsx. Outputs are in out/.

**1. Code unchanged, suite**
- `git diff 2a4b0ae 617b519 -U0 -- mods/` changes 5 lines. All are comment lines in register.tsx (lines 71-73) or README.md line 36. The other changed files are docs/plans files only.
- `diff -r` of the previous lane's 2a4b0ae copy against the 617b519 copy shows only those two hunks.
- Full suite on suite_617b519: ` 308 pass`, ` 0 fail`, `Ran 308 tests across 1 file.` Output: out/suite.out.

**2. Claims check (617b519, instrumented copy)**

Comment: "a span whose end is not recorded (an abandoned call, or a failed end-time clock read) stays open there until evicted". TRUE.
- Abandoned call, AB0: `"afterAbandon":{"open":[],"wInf":1,"tInf":1}` and rows `["main-1 · trivial","other tree: other-1 · trivial"]`.
- Clock read rejects, E2-evict=false: `"settled":"answered"…"ended":{"open":[],"wInf":1,"tInf":1}`, and other-1 is claimed.
- Clock read never answers, Q-hang-0: `"settled":"pending"…"ended":{"open":[],"wInf":1,"tInf":1}`, and other-1 is claimed.
- "Until evicted": after a main turn end and 64 writes the span is gone. AB1 reads `wInf 0, tInf 0`, Q-reject-T64 reads `"afterAct":{…"wInf":0,"tInf":0}`, and both show `1 run in another worktree` (not claimed).
- "open" here means in `windows` and `turnWindows` only. openWindows is empty in every case (`"open":[]`).

README: "A call the engine abandons … counts on until a main turn end and 64 newer writing calls". TRUE.
- AB1: not claimed. AB2 (63 writes): claimed, `wInf 1, tInf 0`. AB3 (64 writes, no turn end): claimed, `wInf 0, tInf 1`. AB4 (a subagent turn end): claimed. AB7 (subagent writes): not claimed. AB8: not claimed.
- These match the previous lane's readings exactly.

README: "or one whose end time the mod fails to read, counts on until a main turn end and 64 newer writing calls". TRUE for both kinds of failure.

| Case | Clock read rejects | Clock read never answers |
|---|---|---|
| no eviction | claimed; `wInf 1, tInf 1` | claimed; `wInf 1, tInf 1`; the call stays `pending` |
| main turn end + 63 writes | claimed; `wInf 1, tInf 0, wLen 64, tLen 63` | claimed; `wInf 1, tInf 0` |
| main turn end + 64 writes | `1 run in another worktree` (not claimed); `wInf 0, tInf 0` | not claimed; `wInf 0, tInf 0` |
| 64 writes, no turn end | claimed; `wInf 0, tInf 1, tLen 66` | claimed; `wInf 0, tInf 1` |

- `armLeft 0` in every case, so the armed failure was used up by a clock read. `wInf 1` after the call ended shows it hit the hook's end-time read.

**3. Call sites, worktree at 617b519 (identical to HEAD for mods/)**
All are in mods/shawarma-companion/hooks/register.tsx.
- `turnWindows`: 52 (declaration), 70 (comment), 254 (spans), 754 (remember at start), 765 (remember at end), 792 (`splice(0)` at a main turn end that git listed).
- `windows`: 62 (declaration), 70 (comment), 254, 753, 764.
- `openWindows`: 75 (declaration), 254, 755 (add), 756 (delete, inside `release`), 761 (comment).
- No other code uses them. Other whole-word hits are prose in .beans and docs/plans, sketch patches, and unrelated `windows` hits in evals/.

**4. Findings**

`own` G1, low, wording. "64 newer writing calls" also counts an older call that ends later, because a call that ends is put back as the newest entry.
- Probe N1 (q.part.tsx): the clock read rejects for call A. A call started before A ends after it. Then a main turn end and only 63 new writes.
- Output: `PROBE N1 {"armLeft":0,"rows":["main-1 · trivial","1 run in another worktree"],"afterAct":{"open":[],"wInf":0,"tInf":0,"wLen":64,"tLen":63}}`.
- Control Q-reject-T63, without the earlier call: claimed.
- Run: `./run.sh v_617b519_i q.part.tsx Q_i`.

`own` G2, low, wording. "until a main turn end and …" is not the only way out. 4096 newer writing calls with no turn end also evict the span, through the MAX_TURN cap on `turnWindows`.
- Probe n2.part.tsx: `N2-4097-reject` gives rows `1 run in another worktree` and `"wInf":0,"tInf":0,"tLen":4096`. `N2-4095-reject` gives `other tree: other-1` and `"tInf":1`.
- Control `N2c-4097-control` (the clock works): not claimed.
- Run: `./run.sh v_617b519_i n2.part.tsx N2_i`.
- Old behaviour, and an edge case (4096 writes in one main turn).

`own` G3, low, a note on how the docs read. When the end-time clock read never answers, the hook awaits it inside `.finally`, so the tool call itself never settles (`"settled":"pending"` in every Q-hang case).
- The README's next sentence, "A call that never ends keeps counting", reads as covering this call too. Yet after a main turn end and 64 writes it is not claimed (Q-hang-T64). The new sentence governs this case correctly.
- Base 4d24fa7 has the same `span.to = await $.clock.now()` inside `.finally`, so this is old behaviour.
- In the real engine, a hook budget would probably abandon the call. The test harness cannot show that, so it is not verified.

`known`: a main turn end listed by the git fallback does not clear `turnWindows` (skills-blde, the ticket for ended-call spans that stay open; not yet on this branch). AB6b on 617b519 still reads `"tInf":1` and `other tree: other-1`. Its control, AB6c, is not claimed. This applies equally to the clock-read case.

All clear: no code change, suite 308 / 0, both new claims TRUE, 63 vs 64 writes and reject vs never-answers read exactly as the README says.
