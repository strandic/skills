## Fix review (3b) for skills-ob78: a841aa6 → 5d382ff, mods + scripts

**No blocking findings.** All three fixes hold when re-run. Below are three low-severity observations and one note about a flaky test. Nothing in the worktree was changed. Scratch root: /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a6141571-e679-49a4-ad68-1cbe62690176/scratchpad/ob78-fixreview/ (copies `pre/` and `fix/`, the same two in `sp ace/`, and a mod copy at `probe/m` driven by `probe/patch.py`). Node v24.22.3, claude 2.1.330.

### Item 1: the three reproductions re-run on 5d382ff

**F1 (timing).** The test files can't use `test.skip`: the kit's `test.skip is not a function`. The kit's per-test timeout is 5000 ms, so a single 14 s test times out. I used a tail of four idle tests of 3.5 s each instead. The handlers log `performance.now()` both as a delta from the call's start and as an absolute time.
- Full file, timed at the V17 and V5 sites, plus the tail: `OB78 V17 rejected 5056 … AbortError` and `OB78 V5 start abs 18989` / `OB78 V5 rejected 5448 … no implementation for tool.call abs 24437`. Result `331 pass / 0 fail`.
- Minimal file (V5 plus the tail):
  ```
  OB78 V5 start abs 672
  OB78 tail part 0 done abs 5540     (so V5 ended at about 2040)
  OB78 V5 rejected 6368 6368 HooksError: no implementation for tool.call abs 7040
  5 pass / 0 fail
  ```
  An earlier run logged `V5 start abs 511`, `V5 end abs 1801`, `rejected … abs 6807`.
- **The kit lets a held call go about 5000 ms after the test ends, not after the call starts.** Measured: end + 5006 ms, and end + about 5000 ms. Counted from the call's start, the delay was 6296 to 6368 ms in the minimal file. The release does not depend on the next test timing out: it fell at 7040 while the next test was still running normally.
- The new prose matches this. The scan header says "leaves it running past the test's end has it let go … about 5 s later", which is correct and anchored to the test's end. The CHANGELOG says "A test that started a call … once the test kit let a held call go, about five seconds later". That is acceptable, since "later" reads as after the test.

**F2 (which file fails).** The kit runs two files in parallel. In each case `band.test.tsx` was cut down to V5, with the V5 call changed to `void`, and file b held a 4 × 3.5 s idle tail.
- Tail only in b: `Ran 5 tests across 2 files`, `5 pass / 0 fail`.
- Tail also in the band file: `tests/band.test.tsx: (fail) the file ran to its end / a rejection nothing handled: no implementation for tool.call`, `9 pass / 1 fail`. b passed.
- So only the file that dropped the call fails, which matches the new wording "the test file, if still running".

**F3 (path with a space).**
- Pre-fix, from `sp ace/pre`: `tests 2 pass 0 fail 2`, `ENOENT … scandir '…/sp%20ace/pre/mods'`.
- Fix, from `sp ace/fix`: `tests 2 pass 2 fail 0`.
- Fix, from a normal path: `tests 2 pass 2 fail 0`.

### Item 2: the new test `scripts/test/mod-tests-root.test.mjs`
- On the fix: `pass 1 fail 0`.
- Against the pre-fix scan: `fail 1`, and the assertion's inner output holds `ENOENT … scandir '/private/var/folders/…/ob78-XXXX/sp%20ace/mods'` (twice). It is red for the stated reason.
- Scan mutants (the new test's reading in each case):
  - m1 empty scan file (no tests): `pass 0 fail 1`
  - m2 syntax error: `pass 0 fail 1`
  - m3 `URL.pathname` (the pre-fix line): `pass 0 fail 1`
  - m5 pathname, with the ENOENT of `readdir(mods)` swallowed: `pass 0 fail 1` (the "has test files" check catches it)
  - m4 the same as m5, plus `length > 0` weakened to `>= 0`: `pass 1`. This needs two coordinated edits, so it is a low concern.
  - m6 `ROOT = process.cwd()`: `pass 1`. That is correct behaviour in the documented usage.
  - m7 `decodeURIComponent(pathname)`: `pass 1`. Also a correct fix.
  - m8 the `void` regex disabled: `pass 1`. See O1.
- **The `NODE_TEST_CONTEXT: undefined` override is needed.**
  - `spawnSync` with an undefined value really removes the variable: `env | grep` printed `unset`.
  - Without the override, the inner run prints `Warning: node:test run() is being called recursively within a test file. skipping running files.`, its stdout is `''`, and the test fails. The code comment is accurate.
  - The test also passes when run inside the full glob: `✔ the scan reads the mods from a checkout whose path holds a space`.

### Item 3: uses of the changed symbol `ROOT`
- `ROOT` is local to the module and is not exported.
- It is used at `mod-tests.test.mjs:27`, `:28`, `:30` and `:43`, always through `path.join`. The trailing `/` from `fileURLToPath` is harmless.
- Nothing outside docs/plans imports or references `mod-tests.test.mjs` except the new test. `band.test.tsx` has its own unrelated `const ROOT = '/repo'`.
- R2 on the fix commit: `tests 2 pass 2 fail 0`.
- R2 with the fix's scan over the 324197d test file: `tests 2 pass 1 fail 1`, with 16 lines listed (:1269 … :3873).

### Item 4: full node suite, `node --test scripts/test/*.test.mjs`, normal path

| | tests | pass | fail | skipped |
|---|---|---|---|---|
| a841aa6 | 680 | 677 | 1 | 2 |
| 5d382ff | 681 | 678 | 1 | 2 |

- On both commits the only failure is `every marketplace entry names a plugin.json with the same name and version`, which already existed.
- The same two skips appear on both (the pinned 2.1.250 CLI is absent).
- No new failures or skips.
- Unchanged kit suite on 5d382ff (R1): `327 pass / 0 fail`, `Ran 327 tests across 1 file`.

### Item 5: claims check on every changed prose line
- CHANGELOG, "about five seconds later": true. The release is about 5.0 s after the test ends.
- CHANGELOG, "the test file, if still running, ended on 'a rejection nothing handled'": true (F2 readings).
- CHANGELOG, "a check in scripts/test/ fails on a mod test line that starts with void": true (R2 base reading).
- Scan header, "past the test's end … about 5 s later": true, and correctly anchored.
- `// not URL.pathname: a checkout path may hold a space`: true (F3 readings).
- New test header ("finds the repository from a checkout path holding a space"): true.
- `NODE_TEST_CONTEXT` comment: true (verified above).

### Observations
- **O1 (the scan has no positive self-test). Label: TICKET.** If the scan's `/^\s*void\b/` were broken (mutant m8), no test in the suite would fail. The new test's fixture holds no `void` line, and the real tree has none either. Only the plan's R2 base-content reading, run by hand, would catch it. Repro: in a copy, change `/^\s*void\b/` to `/^NEVER$/` in `scripts/test/mod-tests.test.mjs`, then run `node --test scripts/test/mod-tests.test.mjs scripts/test/mod-tests-root.test.mjs`. Everything passes. A possible fix: a fixture line `void x()` in the new test's temp tree, expecting `pass 1 fail 1` and the listed line. That is outside F3's scope, hence a ticket.
- **O2 (sibling `URL.pathname` uses in other tests). Label: DECLINE (pre-existing / out-of-scope); a TICKET if wanted.** Full suite from `sp ace/fix`: `tests 679 pass 671 fail 6`. The failures are the marketplace pair, `frontmatter.test.mjs` (the file fails to load), two plantime pipe tests, and `the CLI prints from any path to the script: a link, a %, a #`. The pathname uses are at `marketplace.test.mjs:13`, `frontmatter.test.mjs:18` and `plantime.test.mjs:545/603/786`.
- **O3 (W3-R1 row wording in plan.md). Label: APPLY (low, docs/plans only).** The row (and §1, which it amends) reads "let go … about 10 s of real time after it starts → about 5 s". Measured, the 5 s runs from the test's end. From the call's start it was 6.3 s in a minimal file. Suggested wording: "about 5 s after the test ends".
- **O4 (inner-run assertion depends on the reporter). Label: DECLINE (unreachable on the current setup).** The new test matches the spec reporter's `ℹ pass 2`. On a Node whose default reporter for piped output is tap (I believe older than 23), it would fail loudly and could never pass falsely. I did not run this. The local Node is 24, and the repo pins no Node version and has no CI.
- **Flaky-test note. Label: DECLINE (out-of-scope).** On a patched copy, one run under heavy machine load (a concurrent `find /`, 45 s run) failed `V4 a long call whose end-time read fails closes its span` with `Received: []`, and V17's call resolved instead of being aborted. The rerun read `331 pass / 0 fail`, and the unpatched suite read `327 pass / 0 fail`. The fix changes no test code, so this does not come from it, but V4 can flake under load.
