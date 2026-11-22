## 3a adversarial lane: skills-bnbu at 3f5c376 (base 039320d)

I ran 14 attacks of my own on base and head. The change holds on every attack that tests it. I found one pre-existing way to reach §6's worst impact that §6 does not list (F1). I also found one wording problem on a CHANGELOG line the PR adds (F2) and one pre-existing defect outside the diff (F3). The PR introduces no new defect that I could find.

### Setup
- **Repo untouched.** I made no edits, did not touch the index and made no commits. Everything is in `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/218a355e-cdd3-44c2-abd8-54702ab71064/scratchpad/bnbu-run/3a/`.
- **Copies.** `head/` and `base/` are `git archive` of 3f5c376 and 039320d. `head-a/` and `base-a/` are the mod with `band.test.tsx` removed.
- **Test file.** `head-a/tests/attack.test.tsx` and `base-a/tests/attack.test.tsx` are identical. Each is head's `band.test.tsx` lines 1–223 (`world()` and helpers) followed by `attack3a.tsx`.
- **Command.** `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test <dir>/3a/{base-a,head-a}`.
- **Result.** Base: `14 pass / 0 fail / Ran 14 tests across 1 file.` Head: the same. Full output is in `base-run.txt` and `head-run.txt` (the `READING` lines).
- **Held ms.** This is engine time on the kit's mock clock, advanced in 100 ms steps. The completion callback fires inside an advance, before the counter moves. So the true hold is between the reading and the reading + 100 ms. Base and head have the same bias.
- **Oracle caveat (known, plan-time A-report).** C0, H4, H5, H6 and H7 measure on the same mock clock that drives the deadline. H1, H2 and H3 grade the same fake store that `world()` gives the suite. The hand expectations are independent.

### Enumerate rows A3, A6, A7 and the `NOT RUN` lines
- **A3, A6, A7.** The orchestrator found the code identical to the sketch, so I did not re-run them.
- **`NOT RUN` lines.** None is a lane obligation. Line 115 cites "s6qg lane report, NOT RUN" for the real engine's store. The brief's stand-in is the kit, and live runs are out of my rules. No planner re-run was needed.

### Attacks (input → oracle → base / head → verdict)
- **C0, control (liveness).**
  - Input: 100 fresh other entries; each read answers in 1.9 s.
  - Oracle: the held ms of the first Bash call, against a hand bound of 4 000.
  - Base `heldMs 191000`; head `heldMs 3800`.
  - The harness tells base from head. **Holds.**
- **H1, hostile value corpus.**
  - Input: 24 values, each JSON round-tripped:
    - null, false, 0, "", [], {};
    - trees `[]`; `C:/repo`; `C:\repo`; a relative path; `at` as an ISO string;
    - `at` at exactly ±30 days and at ±(30 days + 1 ms); `at` at ±1e308;
    - arrays nested 5 000 deep; a JSON `__proto__` key; 50 000 trees; trees holding `''`.
  - Oracle: a hand keep/delete column per value.
  - Base and head: `mismatches: []`, the same 17 deleted.
  - Head equals the control. That is expected, because rule 2e did not change, so this is a regression check, not a probe. **Holds:** no throw and no hold.
  - It surfaced F2 and F3.
- **H2, hostile key corpus.**
  - Input: 14 keys, every value expired, the own entry expired too:
    - `claims:` (empty id), `claims:__proto__`, `claims:constructor`;
    - the own key followed by a space, and followed by NUL;
    - `Claims:x`, a 10 000-character key, an emoji, a lone surrogate, `../../etc/passwd`, a zero-width-space prefix.
  - A second run lists every key twice, plus the own key again.
  - Oracle: a hand list.
  - Base and head: `mismatches: []`, `ownKept: true`, in both runs. **Holds** (a regression check).
- **H3, clock edge: skewed engine clock (§6).**
  - Input: 5 live entries written at T0. This session's clock reads T0, T0 + 31 days, T0 − 31 days, and T0 + 29 days.
  - Oracle: live entries left.
  - Base and head: 5 / 0 / 0 / 5. **Finding F1.**
- **H4, §3 error surface: "at most RUN_MS after the own read".**
  - Input: the own read takes 1.9 s and the key list 1.9 s. Then 100 expired entries, whose reads and deletes take 100 ms each.
  - Oracle: the hand bound 1 900 + 2 000 = 3 900 (+100 step).
  - Base: `heldMs 23700`, 100 reads, 100 deletes.
  - Head: `heldMs 3800`, 1 read, 0 deletes, `expiredLeft 100`. The pass ran out of time, by design.
  - The key listing is inside the deadline. **Holds.**
- **H5, key list answering at the deadline.**
  - Input: the key list answers at 1 999, 2 000 and 2 001 ms; 3 expired entries.
  - Oracle: the entries left. All 3 deleted leaves 1, because the own entry is written.
  - Base: 1 / 1 / 4. Head: 1 / 4 / 4.
  - At 2 000 ms the head's timer wins the tie, so nothing is deleted. That is safe. Held is 1 900 on every row. **Holds.**
- **H6, a one-hour clock jump in one advance (laptop sleep) while a read is held 500 ms; 20 expired entries.**
  - Base: done at once, all 20 deleted (base's per-call timers each lose to the earlier read).
  - Head: done at once, 3 deleted. The deadline fell inside the jump.
  - Bounded, nothing live touched. **Holds.**
- **H7, every other read hangs; keys answer at once; 3 calls in a row.**
  - Base and head: `heldMs [1900, 0, 0]`, 1 other read, own entry written.
  - So `restoredFor` is set and there is no second pass. Head equals the control, so this is a regression check only. **Holds.**
- **Contract "prune never throws".**
  - `parseClaimed` cannot throw on any JSON value: H1 covered nesting, `__proto__` and size.
  - A synchronous throw from `$.store.*` or `$.clock.after` cannot happen through hooks: the kit and the engine turn it into a rejection.
  - A refused or dropped timer is skills-vmhr (known). I did not re-run it.
  - **Holds.**

### Findings
- **F1. `own`; pre-existing; not on a changed line.**
  - **What happens.** §6 says a live entry is deleted "reachable only through the pre-existing read-then-delete race". A wrong engine clock also does it. When a session's clock reads more than 30 days ahead or behind the time the entries were written, its first pass deletes every live entry it examines (up to 100). Examples: a dead CMOS battery before NTP sync, a VM restored from a snapshot, a home directory shared between machines.
  - **Rule.** Rule 2e is unchanged, so base and head behave the same. The PR neither adds nor fixes this.
  - **Likelihood.** Low.
  - **Fix.** Correct §6's "only", and file a ticket per §8.
  - **Reproduction.** `describe('H3 clock skew')` in `.../3a/head-a/tests/attack.test.tsx`; same command as above.
  - **Output (head):**
    ```
    READING H3 control 0 {"heldMs":0,"liveLeft":5}
    READING H3 +31 days {"heldMs":0,"liveLeft":0}
    READING H3 -31 days {"heldMs":0,"liveLeft":0}
    READING H3 +29 days {"heldMs":0,"liveLeft":5}
    ```
    Base reads the same four lines.
- **F2. `own`; docs; on a line the PR adds (CHANGELOG 0.3.1).**
  - **What happens.** The line reads "An entry that reads as empty is skipped too, not deleted." Only `undefined` (an unset key) is skipped. Entries holding `null`, `""`, `[]` or `{}` are judged malformed and deleted, on head as on base.
  - **Fix.** Suggest "an entry that reads as unset".
  - **Reproduction.** `describe('H1 hostile values')`; same command. Head output:
    ```
    READING H1 {"heldMs":0,"mismatches":[],"deleted":["null","false","zero","emptystr","emptyarr","emptyobj","windows-path-fresh","backslash-path-fresh","relative-path-fresh","at-string","at-ttl-plus1","at-future-ttl-plus1","at-1e308","at-neg-1e308","deep-5000","proto-key","trees-with-empty"]}
    ```
- **F3. `own`; pre-existing; outside the diff (a ticket per §8).**
  - **What happens.** `parseClaimed` accepts only trees that start with `/`. A fresh live entry whose trees are `C:/repo` or `C:\repo` (Windows paths) reads as malformed. Every other session's pass deletes it, and its own `--resume` reads none. It reaches §6's impact only on Windows, and not through a changed line.
  - **Reproduction.** H1 above: `windows-path-fresh` and `backslash-path-fresh` are in `deleted` on base and head.

### Listed items, not re-reported
I found no new shape of either listed item:
- the read-then-delete race (skills-hybo, `listed`);
- a refused or dropped timer (skills-vmhr, `listed`).

H6's jump and H5's tie both end the pass early, which is the safe direction.
