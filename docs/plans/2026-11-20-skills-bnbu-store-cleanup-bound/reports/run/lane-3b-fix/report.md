## Lane 3b fix review: skills-bnbu review round (3f5c376 → 13263da)

The round's prose is accurate, and every number I ran matched. K9 passes on the unpatched copy and fails on the mutant. The full suite passes and validate passes. I found no defect on a line this round adds. There are two notes. One is a nuance in a sentence this round changed. The other is a gap in an older sentence that this round left unchanged.

Scratch dir: /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/218a355e-cdd3-44c2-abd8-54702ab71064/scratchpad/bnbu-run/fixreview
- base/ is a copy at 13263da, untouched.
- mutant/ is a copy at 13263da with the line-338 patch.
- probe/ is a copy at 13263da with my probes added.
- pre/ is a copy at 3f5c376.
- probes.tsx is the probe source.

All copies were made with `git archive <sha> mods/shawarma-companion | tar -x`. I did not edit the repo and did not touch the git index.

### Call sites
- `git diff --stat 3f5c376 13263da` lists three files: CHANGELOG.md (+2/-2), README.md (+1/-1) and tests/band.test.tsx (+17).
- The round changes no code symbol. `git diff 3f5c376 13263da -- '*.ts' '*.tsx'` shows only new locals inside the test K9: `store`, `fired`, `tapped`, `clock`. It uses `world`, `at`, `bash`, `ROOT`, `STARTED` and `ON` without changing them. So there are no call sites to list.
- I grepped the whole tree for the old prose: `git grep -nE "about 4 seconds|at most about 4|reads as empty|once per session id|Both limits rely" 13263da`.
  - Outside docs/plans there is one hit: scripts/plantime.mjs:74 ("reads as empty"). It is unrelated code.
  - In docs/plans the only hit is the old sketch.patch.
  - No stale copy of the old wording is left.

### Claims, each with its executed reading
I ran the probes with `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test <probe>/mods/shawarma-companion`. They use `world()` and are appended to band.test.tsx in the probe copy.

1. **"waits at most about 6 seconds for the store: 2 for the session's own entry, 2 for the clean-up, 2 to save its claims"** (README:40, CHANGELOG:11). Confirmed. In PROBE-A, every store.get, set, keys and delete answers N ms after it is asked. There are 100 expired other entries, and the engine clock moves in 10 ms steps.
   ```
   PROBE-A ms=1900 heldMs=5790 calls=["get claims:sess-1","keys","get claims:o37","set claims:sess-1"] setLanded=true
   PROBE-A ms=1990 heldMs=5970 calls=["get claims:sess-1","keys","get claims:o37","set claims:sess-1"] setLanded=true
   ```
   The clean-up ends 2 000 ms after it starts: keys answers at 3 800 and the pass ends at 3 900, where it started at 1 900. That matches "stops 2 seconds after it starts".
   - Other paths that could hold the update on the store longer: none found by reading.
     - Only restore, prune and claim call the store (register.tsx lines 254, 266, 295, 320, 328, 334).
     - The extra store.get at line 254 needs `id === storedFor`. That cannot be true at an id's first update, because session.start sets storedFor to null and storedFor is only set after a successful set.
     - There is one refresh per tool call (line 723) and one per session.start or turn end. So one tool call holds one update.

2. **"All three limits rely on the engine's timer"** (README:40). Confirmed. With the engine clock never advanced, and the one named call never answering, the first Bash call was still pending after 300 real ms in all three cases:
   ```
   PROBE-B noAdvance done=false      (own store.get never answers)
   PROBE-B2 noAdvance done=false     (store.keys never answers)
   PROBE-B3 noAdvance done=false     (store.set never answers)
   ```
   With the clock advanced, the same cases finish within 2 s. The existing tests U2 and Q7-3 already show this.

3. **"at a session's first update that reads the session's own entry"** (README:40). Confirmed for the case it names. In PROBE-C, the own store.get fails once and there are 3 expired entries:
   ```
   PROBE-C oldLeftAfterEachUpdate=[3,0,0] keysCalls=1
   ```
   See Note 1 below for the case where the session id changes and then comes back.

4. **"An entry that reads as unset (no value) is skipped"** (README:40, CHANGELOG:12). Confirmed. In PROBE-E the other entries hold null, "", {}, [] and 0, and one more is listed but answers undefined:
   ```
   PROBE-E kept=["claims:undef"]
   ```
   Only the entry that answers undefined is kept. That matches the code at line 330 (`read.value === undefined`).

5. **"stops 2 seconds after it starts"** (CHANGELOG:11). Confirmed by PROBE-A above.

### K9 control and mutant
- Control: the unpatched copy at 13263da passes. `(pass) ... > K9 (review W3-2) after the first Bash call and a 10 s advance, no 2 s timer resolves: the pass cancels its deadline [25.16ms]`
- Mutant: `;(timer as Timer | null)?.cancel()` replaced by `void timer` at register.tsx:338, which is prune's `finally`. The same line at 170, in `within`, is left as is. Here `diff` shows only `338c338`.
  ```
  (fail) ... > K9 (review W3-2) ... [22.77ms]
    Expected: 0
    Received: 1
   285 pass
   1 fail
  ```
  K9 kills the mutant.

### Suite and validate at 13263da
- `plugin test` on base: `286 pass, 0 fail, Ran 286 tests across 1 file. [12.97s]`
- `plugin validate` on base: `✔ Validation passed`. It also printed the standard note that these checks do not apply the plugin directory's own rules for hooks modules.

### Findings
No finding on a line this round adds. Two notes follow.

**Note 1 (low, a nuance in a sentence this round changed: README.md:40, "at a session's first update that reads the session's own entry").** The clean-up runs again when the session id changes and then comes back. This happens because `restoredFor` keeps only the last id (register.tsx:212). The sentence does not say "only once", but a reader may take it that way. PROBE-D runs ids a, a, b, a in turn, with a counter on store.keys:
```
PROBE-D passesById=["a","b","a"]
```
It does no harm: the extra pass still has its 2 s deadline. A possible fix is a few words, for example "at the first update after the session id changes that reads its own entry". Or leave the sentence as it is.

**Note 2 (pre-existing, not this round: README.md:40 "Each call to the session or the store gives up after 2 seconds").** This sentence was there before the round, unchanged. `$.session.cwd()` has no time limit: register.tsx lines 222, 649, 705, 719 and 737 use only `.catch`. `$.session.usage()` at line 584 has no limit either. In PROBE-F, `session.cwd` never answers:
```
PROBE-F sessionCwdHang done=false     (after 10 s of engine clock advanced in 1 s steps)
```
The hang at line 705 comes before `next(e)`, so the tool call itself never runs. This does not touch the store numbers in claims 1 to 5. It does make the README's "session" half of that sentence wrong. It belongs to a later ticket, not this round.

Probe side effect, not a finding: in the probe copy, the suite reported `(fail) the file ran to its end ... $.state.get refused`. This comes from my never-answering probes (B, B2, B3 and F) still running after their tests ended. The base copy has no such failure.
