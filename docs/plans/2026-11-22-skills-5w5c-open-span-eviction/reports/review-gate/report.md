## Lane 3b code review: skills-5w5c at head 3e3e968

**Verdict.** The rebase holds. All three mutants turn skills-5w5c tests red, and the full suite passes on both trees. Every changelog claim held when I ran it. There are no code findings. There is one `own` low prose note, on the words "a call that never ends", in item 2 below.

I edited nothing in any repo tree. Probes, runner and outputs are in /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/4223d73b-665c-4520-bc14-c05fe749bdb1/scratchpad/review-gate/. That folder holds `run.sh`, the probe files `c2.part.tsx`, `d.part.tsx`, `e.part.tsx` and `f.part.tsx`, the copies `v_3e3e968` and `v_4897414`, the mutant copies `m1`, `m3` and `m4`, and every output in `out/`. The probes use the HEAD test file's first 223 lines, which are the same on base, plus the earlier `attack/common.tsx`. I did not reuse `helpers2.tsx`, because its `hold` signature is older than the one in the test file.

### (b) The rebase: full suite and mutants
**Full suite**
- HEAD 3e3e968: `326 pass / 0 fail / Ran 326 tests across 1 file. [24.36s]`
- Base 4897414: `321 pass / 0 fail / Ran 321 tests across 1 file. [23.04s]`
- The difference is the 5 new tests V1 to V5.

**Mutants** (each applied to a copy of HEAD; the diffs are confirmed in the run log):
- **m1** (`release()` moved after `span.to = await $.clock.now()`): 1 red, V4 (a failed end-time clock read closes the span). Count line: `325 pass, 1 fail`.
- **m3** (`spans = [...windows, ...turnWindows]`, openWindows dropped): 3 red, V1, V2 and V5. Count line: `323 pass, 3 fail`.
- **m4** (the two `next.signal` lines removed): 1 red, V3 (a hook above answers first). Count line: `325 pass, 1 fail`.

All failures were inside the skills-5w5c block. The fix still binds on the code as rebased onto oz54. The range-diff shows the fix commit `14230fd` as `=`. Only the context of the test commit changed, because it now follows the oz54 test block.

### (a) Changelog [0.3.5]: each claim run on HEAD, with base as control
0. **Version.** Main 4897414 is at 0.3.4, so 0.3.5 is the next free patch. Its changelog entry is placed at the top, above [0.3.4].

1. **"A long call lost its span after a main turn end and 64 newer writes; the own run read '1 run in another worktree'."** This held.
   - Probe C1: a subagent call (`agentId a1`) writes the own marker during the call, after the turn end and 64 writes.
   - Base: `during` and `after` both read `["main-1 · trivial","1 run in another worktree"]`.
   - HEAD: `during` and `after` both read `["main-1 · trivial","other tree: wt-7 · trivial"]`.

2. **"A span counts until the call ends or Claude Code abandons it, however long it runs."** This held, with the boundary below.
   - C2a-1h: own marker 1 hour into the call. Base reads `1 run in another worktree`; HEAD reads `other tree: wt-7`.
   - C2b: a finite call ends, then a turn end and 64 writes, then another session's marker. HEAD and base both read `1 run in another worktree`, so the span stops counting once the call ends.
   - Duration probe D, run on HEAD only. A marker from another session is claimed for as long as the call is still running.
     - Never-ending call: claimed at 10 min, 1 h and 3 h. At 6 h the test kit itself has rejected the call (`rejected HooksError: no implementation for tool.call`) and the marker is no longer claimed.
     - Gated call: claimed up to 6 h. Rejected and no longer claimed at 12 h.
     - Runs of 24 h and 7 days end with the same rejection.
   - So the engine (here, the test kit) abandons a very long call, and the span is then released. That matches "or Claude Code abandons it".
   - `own`, low, prose only: "a call that never ends keeps claiming them" holds only until the engine gives up on the call. In the kit that happened after 3 to 6 hours of fake time.
   - Repro: `run.sh v_3e3e968 d.part.tsx head-d`.

3. **Limit: "a new marker from another session is claimed too; a never-ending call keeps claiming them."** This held within the boundary in item 2.
   - V5 is green.
   - C3 (HEAD): the first marker is claimed, `other tree: other-1`.
   - The second marker comes 1 day later and is not claimed. That is the kit's abandonment from item 2, not a fix regression.
   - Base: neither marker is claimed.

4. **"A claimed tree stays claimed for the session and comes back on `--resume` (30 days)."** This held.
   - C4 (HEAD): still claimed after the call ends, a turn end and 64 writes. Stored as `{"trees":["/repo","/repo/.worktrees/v"],...}`.
   - C4r: a resume 0, 29 or 31 days later restores the row.
   - The 30 days is enforced by another session's clean-up. Probe E: when another session starts 29 days later the entry is kept (`kept: true`); at 31 days it is deleted (`kept: false`).
   - Base, as control: the tree is never claimed, and only `/repo` is stored.

5. **"Its newer rows can push the own row for another worktree below the band's fold."** The order held. The fold itself cannot be seen in the kit.
   - C5 (HEAD): before the call, `[main-1, other tree: wt-7]`. During it, `[main-1, other-3, other-2, other-1, wt-7]`, so the own row comes last.
   - Probe F: with 3, 4 or 5 over-claimed rows, wt-7 is always last.
   - The mod never reads `maxRows`, and the kit's `findAll` returns every row. So the fold depends on the engine cutting the surface, which the kit does not show.
   - Base: `[main-1, wt-7, 3 runs in other worktrees]`.

6. **Unchanged: "an abandoned call, or a failed end-time clock read, counts until a main turn end and 64 newer writing calls."** This held, and HEAD and base read the same.
   - Probe C6 placed another session's marker after the abandon or the failed read. For both cases:
     - nothing, turn end only, or 64 writes only: claimed (`other tree: other-1`)
     - turn end and 64 writes: not claimed (`1 run in another worktree`)
   - So it takes both steps.
   - `known` (skills-blde).

7. **Unchanged: "a main turn end that did not place against a fresh git list does not count."** This held, and HEAD and base read the same.
   - Probe C7: abandoned call; turn end with the git list rejected; 64 writes; marker other-1. Then a placed turn end, 64 writes, marker other-2.
   - Result: `placed` reads `[main-1, other tree: other-1, 1 run in another worktree]`. other-1 is claimed because the unplaced turn end kept turnWindows; other-2 is not.
   - `known` (skills-blde).
   - Side note: just after the git list was rejected, other-1 had no row at all (`unplaced: ["main-1 · trivial"]`) until the next placed turn end. Base does the same, so it predates this ticket and I did not pursue it.

### §3 error surface ("none"): my own attacks
- A call the engine rejects partway through (D, never-ending call at 6 h and later) releases its span. After that, nothing new is claimed.
- A failed end-time clock read is covered by m1 and V4. A hook above answering first is covered by m4 and V3.
- Base never used `next.signal`; this fix adds its first use. The suite runs on the kit's signal. I did not find the engine typings in the repo (`.claude-plugin/types` is missing there), so I could not check the signal's declaration myself.
- I found no new place where a call can reject or wait.

### (c) Call sites at HEAD, all in `mods/shawarma-companion/hooks/register.tsx`
- **turnWindows**
  - declared at :52
  - remembered at the call's start at :785, and after it ends at :796
  - read in `claim` at :263
  - cleared at :824, in `turn.complete`, under `isMain && isPlaced`
- **windows**
  - declared at :62
  - remembered at :784 and :795
  - read at :263
- **openWindows**
  - declared at :75
  - `add` at :786
  - `delete` inside `release` at :787 (`release` is called at :788, through the abort listener at :789, and in the finally at :793)
  - read at :263
- The doc comment at :70 names `windows` and `turnWindows`. Neither the tests nor `model.ts` reference these names.

### Harness note
- The first claims run included gated calls lasting 24 h and 7 days. It ended with "the file did not load". Without those cases, the second run gave `18 pass / 1 fail`.
- That one failure is the kit's "the file ran to its end", from an unhandled rejection: a never-ending call left running is rejected by the kit (`no implementation for tool.call`) after its test finishes. It is not a probe result.
