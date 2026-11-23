## 3b code review: skills-ob78 (HEAD a841aa6 against base 324197d)

I made no edits in the worktree. All work is in `R=/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a6141571-e679-49a4-ad68-1cbe62690176/scratchpad/ob78-review`. Raw kit outputs are in `$R/run-*.txt`. Kit suites ran one at a time.

**Sketch match:** the implementation equals the sketch. `git apply sketch.patch` on `git archive 324197d`, then `diff -r` against HEAD for `mods` and `scripts`, differs only in the plugin.json version and the CHANGELOG entry.

### Mutant table
Each variant was run after its unpatched control. Each has a liveness probe: a diff or grep showing the mutation is in the variant and not in the control.

| mutant | control reading | liveness probe | variant reading | killed by |
|---|---|---|---|---|
| M1 `drop = (work) => { void work }` | HEAD kit: `327 pass / 0 fail / Ran 327 tests across 1 file.` | `diff`: line 220 changed to `{ void work }` | kit: `327 pass / 1 fail / Ran 328 tests`. `(pass) … O1 …`, then `(fail) the file ran to its end` / `a rejection nothing handled: skills-ob78 O1: rejected after drop` / `skills-ob78 O1: rejected in a chained then` | O1, through the file-end line. **Extra check:** M1 with the O1 block removed reads `326 pass / 0 fail`, so O1 is the only test that kills M1. |
| M2 regex `/^void\b/` | HEAD scan on the base test file: `tests 2 / pass 1 / fail 1`, 16 lines listed | grep shows `/^void\b/` at line 43 | scan on the base test file: `tests 2 / pass 2 / fail 0` | T1's base reading |
| M3 regex `/^\s*void\s/` | hostile corpus (`  void(paren())`, a line holding only `  void`, `  voidable()`), control: `fail 1`, flags `h.test.ts:2: void(paren())` and `h.test.ts:3: void` | grep shows `/^\s*void\s/` | same corpus: `pass 2 / fail 0`. On HEAD: `pass 2` (same as control). On the base test file: `fail 1` with 16 unique lines (same as control) | the hostile corpus only. T1 and T2 cannot tell M3 from the real regex. This is as the brief predicts. |
| M4 one site (`:3879`, V5 `hang`) changed from `drop(` back to `void` | HEAD scan: `pass 2 / fail 0` | `diff`: line 3879 changed | scan: `tests 2 / pass 1 / fail 1`, `band.test.tsx:3879: void $.tool.call({ tool: 'Bash', command: 'hang', agentId: 'a1' } as any)` | T1 |

### Findings

**F1: the "about ten seconds" in the changed prose is wrong. Measured: about 5 s. Label: APPLY.**
- Where it appears:
  - CHANGELOG 0.3.6: "once the test kit let a held call go, about ten seconds later".
  - `mod-tests.test.mjs` header: "let go by the test kit about 10 s later".
  - Brief §1 has the same wording, and its Sources row says "the delay itself was not timed".
- Reproduction 1 (handlers that log the time, full file plus a 14 s idle tail):
  - Setup: `$R/x-full`, where `:3601`, `:3653` and `:3879` became `{ const t0 = Date.now(); X.then(() => console.log("RES L<n>", …), (e) => console.log("REJ L<n>", Date.now() - t0, String(e))) }`.
  - Output:
    ```
    REJ L3653 5057 AbortError: The operation was aborted.
    REJ L3879 5479 HooksError: no implementation for tool.call
    328 pass / 0 fail
    ```
- Reproduction 2 (minimal file): `node $R/bin/gen.mjs $R/head $R/x-timed '{"files":{"a":{"form":"timed","tailMs":14000}}}'`, then the kit in `$R/x-timed`. Output: `REJECTED-AFTER 5008 HooksError: no implementation for tool.call`.
- Oracle check: `Date.now()` agrees with the kit's own timer. The tail logged `TAIL-DONE 14001` and the kit printed `[14002ms]`. The suite took 41.7 s, against the control's 26.9 s.
- This also explains why the ticket's 6 s tail was enough.
- Suggested wording: "about five seconds later". In the brief, add a §9 row for §1.

**F2: the CHANGELOG says "any test file still running ended on 'a rejection nothing handled'". Only the file that dropped the call fails. Label: APPLY.**
- Reproduction (the kit runs files in parallel):
  - `node $R/bin/gen.mjs $R/head $R/x-two '{"files":{"a":{"form":"void"},"b":{"form":"none","tailMs":14000}}}'`, then the kit in `$R/x-two`. Output: `3 pass / 0 fail`. File b ran 14 s and was not failed by a's dropped call.
  - Control, `$R/x-one`: the same void call with a 14 s tail in file a itself. Output: `tests/a.test.tsx: (fail) the file ran to its end / a rejection nothing handled: no implementation for tool.call`. File b passes. Total `4 pass / 1 fail`.
- Suggested wording: "the test file, if still running, ended on …". The scan header already says "the file" and is correct.

**F3: `ROOT = new URL('../../', import.meta.url).pathname` breaks when the checkout path holds a space. Label: APPLY (low).**
- The repo already warns about this. `scripts/test/runmeter.test.mjs:31` says "not URL.pathname: a checkout path may hold a space". The fix is `fileURLToPath`. `marketplace.test.mjs:13` has the same pattern on the base.
- The failure is loud, never a false pass.
- Reproduction: `D="$R/sp ace"`, `git archive 324197d | tar -x -C "$D"`, copy in the new scan, run `node --test scripts/test/mod-tests.test.mjs`. Output:
  ```
  Error: ENOENT: no such file or directory, scandir '…/ob78-review/sp%20ace/mods'
  ℹ tests 2  ℹ pass 0  ℹ fail 2
  ```
- §3 freezes the file "as in the patch", so this needs a §9 row. Alternative: DECLINE (style).

**F4: the regex `\b` flags an identifier that starts with `void`, such as `  void$ = 2`. The header says it flags "the word void". Label: DECLINE (unreachable).**
- No such identifier exists in any mod test.
- Reproduction: `$R/corpus2/mods/zz/tests/h.test.ts`, then `node --test` in `$R/corpus2`. Output: `+ 'mods/zz/tests/h.test.ts:9: void$ = 2'`.

### Claims check on the changed prose (all executed)
- **`drop` doc, "a call the kit lets go after the test has ended does not fail the file":** holds.
  - HEAD plus a 12 s tail (`$R/r3`): `328 pass / 0 fail`, `(pass) tail > wait 12 s`.
  - `drop` with a held call and a 9 s tail (`$R/x-during` c): passes.
- **`drop` doc, "A rejection during the test is not reported either":** holds. In `$R/x-during`, a: `drop(Promise.reject(…))` passes, while b: `void Promise.reject(…)` gives `(fail) the file ran to its end / a rejection nothing handled: R during test`.
- **O1 comment, "the oracle is the kit's own file-end check … fails the file, not this test":** holds. Under M1, O1 reads `(pass)` and the file-end line fails.
- **Scan header, the line rule:** holds.
  - Flagged: `void` at a line's start inside a template literal, and inside a block comment.
  - Not flagged: `// void`, ` * void`, `bare()`, `x(); void y()`, `arr.push(z())` (`$R/corpus2`).
- **Header, "`claude plugin test` cannot read a test's source":** holds. All four routes are refused by the kit (`$R/x-src`):
  - text import: "is not named like code and was not loaded";
  - `node:fs` import: "imports its own files by relative path and "claude-code", nothing else";
  - dynamic `import()`: refused;
  - `fetch`: "globalThis.fetch is not a function".
- **`modTests` doc, "a linked mod folder followed":** holds. Probes in `$R/link`: a linked mod, a `tests` folder that is a link, a dangling link, and a plain file. Output: `+ 'mods/linked/tests/d.test.tsx:1: void a()'`, `+ 'mods/m2/tests/e.test.ts:1: void b()'`, `fail 1`, no crash.
- **CHANGELOG "Tests only; the mod's behaviour does not change":** holds. `git diff --name-only 324197d..HEAD` lists only the plan docs, plugin.json, CHANGELOG, `tests/band.test.tsx` and `scripts/test/mod-tests.test.mjs`. The diff for `hooks/` and `types/` is empty. `claude plugin validate` → `✔ Validation passed`.
- **The "ten seconds" and "any test file" claims:** false. See F1 and F2.

### §3 error surface ("no hook or engine call changes; drop is used only in tests"): holds
- `grep -rnw drop mods/shawarma-companion` outside `band.test.tsx` finds only the CHANGELOG and a pre-existing comment at `register.tsx:69`. There is no identifier named `drop` outside the test file.
- `drop` is defined once (`:220`) and nothing else in the test file shadows it. There are 18 `drop(` calls: the 16 rewritten sites plus 2 in O1.
- An independent TypeScript AST oracle (`$R/bin/astvoid.cjs`, the TS compiler's parser rather than the scan's regex) counts:
  - base: 16 `void` statements, at the exact lines T1 lists;
  - HEAD: 0;
  - `hooks/register.tsx`: 0 `void` statements on both, and the same 2 `void` expressions (the known `:682` and `:863`).
- `tsc -p` on base and HEAD gives the same error set with line numbers stripped (`diff` is empty). This is a weak reading: the kit's types are not on disk, so both sides report 675 errors.

### Oracle independence
- T1's base reading was cross-checked with the AST oracle and with an awk count (`$1=="void"`: 16). They share no regex with the scan.
- The kit's file-end line is independent of the code under review.
- The liveness probes are diff or grep checks that the patch took effect. They do not grade the outcome.
- The timing readings use `Date.now()` inside the kit, cross-checked against the kit's own timings.

**Overall:** all four mutants were killed exactly as the brief predicts. Invariants and §3 hold. Two prose claims are false (F1, F2: CHANGELOG and scan header wording). F3 is a low-severity convention fix. F4 is declinable.
