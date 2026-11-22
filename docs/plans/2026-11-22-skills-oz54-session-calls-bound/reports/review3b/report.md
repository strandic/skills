## Lane 3b code review: skills-oz54 at 873fec5 (base c3c525d)

**Summary:** All 14 mutants turn the tests red that §7 expects. The code matches the sketch and §3. I found one false sentence in the README and one in the CHANGELOG. I found no defect in the code.

**Control:** HEAD unpatched reads `314 pass / 0 fail / Ran 314 tests`. Every mutant reading below differs from it.

### Mutants
I applied each mutant to a scratch copy of HEAD, finding its site by its code, and ran `claude plugin test`. Outputs are in `reports/review3b/mut-<name>.{diff,txt}`.

| mutant | tests red | vs §7 |
|---|---|---|
| m227 | V5 | as expected |
| m405 | V6 | as expected |
| m405b | V6 | as expected |
| m406 | V1, V8 | as expected |
| m427 | V2 | as expected |
| m595 | V3 | as expected |
| m612 | V1, V5, V8, V10 | as expected |
| m725 | V1, V6 (runs 2 and 3) | as expected; run 1 also reddened Q6-4, see below |
| m784 | V4 | as expected |
| keepOnLost | V5 | as expected |
| readNoLost | V5, V9, V10 | V10 is extra |
| noLostThrow | V5, V9, V10 | V10 is extra |
| startNoClear | V13 | as expected |
| mcancel | K9, V7 | as expected |

- **m725, run 1:** it also turned "Q6-4 store.set answers out of order" red. Runs 2 and 3 of the same mutant did not. I read it as the known flake (S4), not a kill.
- **mcancel:** I applied it only to `within`. The same cancel line also appears in `restore` at register.tsx:345.
- No mutant left everything green.

### Invariants and §3
- The `+`/`-` lines of `register.tsx`, `README.md` and `band.test.tsx` are the same as in `sketch/sketch.patch`, by a diff of the changed lines.
- The `register.tsx` changes fall only in the functions §3 names, plus the `RUN_MS` doc comment. That list is: the `isCwdLost` flag, `claim`, `discover`, `snapshot`, the new `readMainCwd`, `refresh`, `stale`, and the `session.start`, `tool.call`, `turn.complete` and `ui.render` hooks.
- `model.ts` is untouched. The README changes only the :40 paragraph.
- The version is 0.3.4, one after main's 0.3.3, set in `plugin.json` and the CHANGELOG.
- Every `$.session.*` call now goes through `bounded`, at register.tsx:217, :226, :227, :404, :405, :426, :598, :621, :756 and :815.
- My count of session calls per update is at most 8, so the README's "eight … 16 seconds" holds. A main tool call has 8 distinct sites, a subagent call 7, a turn end 7, and the 15 s check 8.
- §3's error surface held under my attacks. No new error reaches a caller. Each give-up falls into the site's own `.catch` (the `refresh` catch for discover and usage).

### Finding 1: a false README sentence (register.tsx:645-646, :682-690)
- **The sentence** (README.md:40): "When the working directory cannot be read after a tool call, at a turn end or in the 15-second check, the mod forgets the one it knew and draws nothing until a later tool call or turn end of the main session reads it again".
- **Why it is false:** the rows also come back without a tool call or turn end, in two ways.
  - The 15 s check keeps running after the failed refresh, because cm2l Q3's `next.scan.status === 'failed' && check !== null` keeps it alive (register.tsx:645-646). The check then calls `readMainCwd` (:690). When the cwd answers, the check clears `isCwdLost` and draws the rows again.
  - A session start draws them again too, which test V13 already asserts.
- **Reproduction (probe P1)**, appended to `band.test.tsx` at HEAD:
  ```
  let fail = false
  const clock = world(on, new Map([at(ROOT,'m')]), ROOT, [], new Set(), { hold: { 'session.cwd': () => (fail ? Promise.reject(new Error('x')) : undefined) } })
  await bash($,'true'); fail = true; await bash($,'true'); const lost = await band($)
  fail = false; await clock.advance(15_000); await settle(30); await clock.advance(15_000); await settle(30)
  ```
  - HEAD reads `lost: []` and then `afterCheck: ["m · trivial · since 14:00"]`.
  - The base control reads `lost: ["m · …"]`, because it never forgets.
- **Effect on the brief:** B5's "the 15 s check stays stopped until a main event" is out of date on c3c525d too. §3's own wording, "until a main read answers or a session starts", still holds.

### Finding 2: a false CHANGELOG sentence (register.tsx:756)
- **The sentence** (0.3.4 entry): "When the working directory cannot be read, the mod forgets it and draws nothing until the main session reads it again".
- **Why it is false:** the read before the call can give up without anything being forgotten. That read at :756 does not touch `mainCwd` or `isCwdLost`.
- **Reproduction (probe P2):** after one good Bash call, make only the next cwd read hang. That is the read before the second call. Advance 2 s.
  - HEAD still draws `["m · trivial · since 14:00"]`.
  - The base control times out after 5 s, because that read is unbounded there.
- **Suggested fix:** narrow the sentence as the README does: "after a tool call, at a turn end or in the 15-second check".

### Imprecise, not false
- **The sentence** (CHANGELOG): "a `/cd` folder, project root or context figure that never came held the Write, Edit, NotebookEdit or Bash call before it ran".
- **What the base does:** only the cwd held a call before it ran. A root or usage call that never answered let the tool run at once, then never returned its result. Probes P3 and P3b read `ran = 1` with no clock advance, on base and on HEAD alike.
- Those two readings describe the base, so equal readings were expected there. They are evidence for the claim, not a kill.

### Files
- Outputs: `/Users/jonathan/Documents/strandic-skills/.worktrees/oz54/docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/review3b/`
  - `control.txt`
  - `mut-*.diff` and `mut-*.txt`
  - `probes.tsx`
  - `probes-probe.txt` (HEAD) and `probes-base.txt` (c3c525d)
- I removed my scratch worktrees (`oz54-rv3b-ctl`, `-mut`, `-probe`, `-base`). I left `.worktrees/oz54` and the main checkout alone, apart from the outputs above, which git ignores.
