## ATTACK LANE report: skills-ob78 (dropped test calls), sketch at .worktrees/ob78-spike

Scratch root: `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a6141571-e679-49a4-ad68-1cbe62690176/scratchpad/ob78-attack/` (written `$S` below). Kit command used everywhere: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test .`. I edited no tracked tree. I ran no two kit suites at once. The V5 flake did not appear in any run.

### A1: ways to start a call and not await it (each in its own sketch copy)
- **Setup:** `node $S/bin/a1gen.mjs <sketch> $S/a1`. Each file is the sketch's lines 1–225 (the helpers, including `drop`), plus one test, plus the 12 s tail.
  - The test calls `world(..., { claimed: [], after: e => e.command==='hang' ? never() : undefined })`, then `await bash($,'true')`, then the form below on `$.tool.call({tool:'Bash',command:'hang',agentId:'a1'})`.
- **Kit:** run in `$S/a1/kit/<form>`. Output is in `$S/a1/<form>.kit.txt`.
- **Scan:** `node --test scripts/test/mod-tests.test.mjs` in `$S/a1/scan/<form>`, on the same file. Output is in `<form>.scan.txt`.

| form | kit (file-end line) | scan |
|---|---|---|
| F0 no call (control) | 2 pass / 0 fail | pass |
| F1 `    void X` | **fail**: `a rejection nothing handled: no implementation for tool.call` | flags (fails) |
| F2 `\tvoid X` | **fail** (same line) | flags |
| F3 `let x = 1; void X` | **fail** | **passes (missed)** |
| F4 bare `X` | **fail** | **passes (missed)** |
| F5 `X.then(() => undefined)` | **fail** | **passes (missed)** |
| F6 `arr.push(X)`, never awaited | **fail** | **passes (missed)** |
| F7 `Promise.all([X])`, not awaited | **fail** | **passes (missed)** |
| F8 `drop(X)` (control) | 2 pass / 0 fail | pass |

- **Grade:** the kit fails all 7 dropping forms. The scan catches 2 of the 7. `drop` clears the failure.
- **FINDING A1:** 5 forms that drop a call's promise get past the scan, and each one fails the file under the kit. The scan checks one way of writing a dropped call, not dropped calls in general.
  - Reproduction: `cd $S/a1/kit/F4_bare_call && <kit>`, then `cd $S/a1/scan/F4_bare_call && node --test scripts/test/mod-tests.test.mjs`.
- I searched the sketch's band.test.tsx itself for the F3–F7 forms. None is present: every `const call = …` is awaited within 1–11 lines.

### A2: the weakened check
- **Setup:** in `$S/a2/{base,sketch}`, `hooks/register.tsx:778` now has `throw new Error('A2 weakened: tool.call throws')` as the hook's first line.
- **Readings:**
  - base: `69 pass 257 fail, Ran 326`
  - sketch: `70 pass 257 fail, Ran 327`
  - `diff base.list sketch.list`: the only difference is the extra `(pass) … O1`.
  - With timings stripped, the full outputs are identical apart from O1.
  - The file-end check fired on neither run (0 lines).
- **Grade:** no test that fails on base stops failing on the sketch.
- **FINDING A2 (the oracle cannot see the defect):** the engine absorbs a hook that throws. The call resolves instead of rejecting: F9 on base reads `Received: { result: { type: "text", text: "ok" } }`. So this weakening never reaches the rejection path that `drop` silences, and it cannot tell base from sketch in the harmful direction.
- **Supplementary A2b:** this reaches that path directly. `$S/a2b/{void,drop}` holds a test that does `void|drop Promise.reject(new Error('A2b rejected during the test'))` and then a second test (no tail).
  - void: `(fail) the file ran to its end … a rejection nothing handled: A2b rejected during the test`, 2 pass / 1 fail.
  - drop: 2 pass / 0 fail.
  - So `drop` hides a rejection that happens *during* a test, not only one after the kit lets the call go. This is the accepted error direction from the Q1 ruling, now measured.
- **Supplementary mutant:** `$S/mut`, where `drop` is changed to `{ void work }`, run as the full sketch suite: `327 pass 1 fail`. The failing line is `(fail) the file ran to its end … skills-ob78 O1: rejected after drop / … rejected in a chained then`. O1 itself still reads `(pass)`. O1 kills the mutant only through the file-end line.

### A3: the sketch with the 12 s tail (`$S/a3/<variant>`, output in `<variant>.<n>.txt`)
| placement | result |
|---|---|
| at the end, run 1 | `328 pass 0 fail` |
| at the end, run 2 | `328 pass 0 fail` |
| at the end, run 3 | `328 pass 0 fail` |
| directly after the skills-oz54 block (before line 3759) | `328 pass 0 fail` |
| directly after the skills-5w5c block (before O1) | `328 pass 0 fail` |
| control: base with the tail at the end (`$S/a3/base_end`) | `327 pass 1 fail`: `(fail) the file ran to its end … a rejection nothing handled: The operation was aborted.` |

- **Grade:** the sketch passes in every placement. The control shows the probe can detect the bug.

### A4: promises the mod creates and does not await or return
**By reading:**
- `register.tsx:185` `late` (inside `within`). It rejects only if `$.clock.after` throws, and `Promise.race` handles that.
- `:187` `work.then(ok, fail)`: handled, and attached synchronously before the first `await`.
- `:333` / `:335` `deadline` and the `race` in `prune`: same pattern as `:185` / `:187`.
- `:369` the memoised `$.fs.list(path).then(e => e, () => null)`: handled.
- `:402` `Promise.all([readIf…])`: returned, and the caller at `:923` catches it.
- `:682` `void stale($).catch(…).catch(() => undefined)`: handled.
- `:797` `next(e).finally(async …)`: awaited.
- `:863` `void openOn(...)`: `openOn` (`:745-747`) catches `update` and answers `ui.open` with an `.then(ok, err)`. One leftover case: a *synchronous* throw from `$.ui.open` would reject `openOn`, and `:863` leaves that unhandled. The kit cannot produce that throw, so it is not tested.
- `model.ts`: creates no promises.

**Kit probes:** `node $S/bin/a4gen.mjs` (trivial marker) and `$S/bin/a4gen-plan.mjs` (a plan dir that is missing, plus one that is present).
- They cover 17 `$` calls, each in 2 modes, each in its own file with the tail. The calls are: session.cwd, session.id, session.root, session.usage, store.get, store.set, store.keys, store.delete, clock.now, fs.list, fs.read, fs.stat, fs.exists, process.run, ui.open, command.register, tool.call.
- The modes are `hold → Promise.reject(...)` and `hold → never()`.
- Each test runs: session.start, then a bash call, then a band mount, then a row press (which calls `openOn`), then a turn end, then four 15 s checks. Every call is dropped. The test asserts that the held call was actually reached (`hits > 0`).

**Readings:**
- `$S/a4/run1.txt`: `66 pass 2 fail, Ran 68 tests across 34 files`. The 2 fails are `fs.exists`, where `hits` is 0 because the path was not reached with a trivial marker.
- `$S/a4/runplan.txt`: `68 pass 0 fail, Ran 68 across 34 files`. Every call was reached.
- Zero `a rejection nothing handled` lines in either run.

**Grade:** the claim "the mod's own code leaves no rejection unhandled" holds under the kit, for all 17 calls in both modes. It says nothing about the real engine.

Side reading (not about this ticket): `fs.exists` at `:551` and `:729` has no RUN_MS bound. With `never`, the hook hangs until the kit lets it go.

### A5: the scan over a hostile corpus
- **Commands:** `$S/a5/repo` (`node --test scripts/test/mod-tests.test.mjs`) and `$S/a5/repo2` (a mod with no `tests` folder).
- **Expected verdicts** come from the contract: "a line whose first non-whitespace token is `void` fails; nothing else does".

| case | expected | scan |
|---|---|---|
| `void` at line start inside a template literal | pass (string content, not a token) | **flagged (false positive)** |
| `void` at line start inside a block comment | pass | **flagged (false positive)** |
| `  void(paren)` | fail | **not flagged (false negative)** |
| `\tvoid tab` | fail | flagged ✓ |
| CRLF `    void crlf\r` | fail | flagged ✓ |
| `.test.ts` file | fail | flagged ✓ |
| `void\tx` | fail | flagged ✓ |
| a line that is only `void` (operand on the next line) | fail | **not flagged** |
| `ok(); void afterSemi` | pass by the line contract (fails at runtime, see A1 F3) | not flagged |
| `// void inLineComment` | pass | not flagged ✓ |
| `tests/helpers.ts` holding `void` | pass | not flagged ✓ |
| `tests/sub/c.test.ts` | pass (`tests/*`) | not flagged ✓ |
| a symlinked mod `mods/linked -> …/tests/d.test.tsx` | fail (`mods/*` matches it) | **not flagged**: `readdir withFileTypes` `isDirectory()` is false for a symlink, so the mod is skipped |
| a mod with no `tests` folder, alone (repo2) | no crash | no crash. The void test passes, and `✖ the mods have test files to read` fails, as designed |

### A6: re-reading the sources
- (a) `claude-code.d.ts:21584-21586` (Mock.clock): "one held past a hook's budget (ten seconds of real time) is let go, as a hook that overran". **Verified**, with one caveat:
  - The sentence's subject is a held *clock wait* (`$.clock` waits). The sketch and the ticket apply it to a call held by a test hook awaiting `never()`.
  - `reference.md:256` gives the budget rule that actually applies: the overrunning hook is the test's own `after`/`hold` wrapper, because "a `next` or `$` call in flight does not count".
  - So the citation is **paraphrased / extended past its subject**.
- (b) `claude-code.d.ts:2842`: `log: (text: string, options?: UiLogOptions) => void;` **Verified.**
- (c) `reference.md:256`: hook budget, and "`next.signal` aborts when that dispatch is abandoned (… the budget ran out)". **Verified.**

### Flags
**Class words that A1 and A5 contradict:**
- The scan file's header says the mods' test files: "none drops a call's promise". The check enforces only `^\s*void\s`. A1 F3–F7 drop calls and pass.
- The header also says "a call a test does not await goes through a helper that handles its rejection". That is stated as fact and is not checked (A1).
- The `modTests` doc says "Every `mods/<mod>/tests/*.test.ts(x)` file". A symlinked mod is skipped (A5).
- O1's describe says "a call a test does not await has its rejection handled". O1 drops plain `Promise.reject` values, not `$` calls.
- The `drop` doc says "a call left running past its test is let go by the kit later". A2b shows `drop` also silences a rejection that happens during a test.

**Expected values in the new tests:**
- O1's `expect(true).toBe(true)` is a tautology. O1's real oracle is the kit's file-end line, which is independent of the sketch, and it kills the `drop`→`void` mutant ($S/mut). But O1's own row stays `(pass)`.
- The scan's `length > 0` check is weak. `deepEqual(found, [])` shares a regex with nothing in the sketch, so it is independent.

**Ticket claims, and what stands behind each:**
- "About 6 s later something aborts them": no timing reading. The doc says ten seconds. The 6 s probe worked presumably because of the elapsed test time; that was not measured.
- "A busy-wait of 6 s gives the same": not re-run by me.
- "Worst case: a red suite; no wrong output seen": no test behind it.
- "At runtime, outside tests: no … the engine … handles a hook that fails or overruns": kit-only evidence (A2: a hook throw is absorbed; A4: no unhandled rejection). No real-engine reading.
- "`:863` `openOn` cannot reject": true except for a synchronous `$.ui.open` throw, which was not tested (A4).
- "16 statement-level `void`, 4 handle a rejection": **verified** by grep on base (`:3092`, `:3112`, `:3178`, `:3439`).
- `:682`, `:187`, `:335`, `:745-747`: **verified** by reading.
