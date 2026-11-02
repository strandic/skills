# lane 3b (run, Wave 3) — saved from the lane's final message

`<L>` = `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/a1fe7339-7fa8-440d-973c-d1d5d4792ad5/scratchpad/run-v2tm/lane-3b/` (scratch clone at 8bb457d).

**Summary.** All 6 brief mutants are killed. Of the lane's 13 D11/D12 mutants, 7 are killed and 6 survive the 162-test suite: d3 is equivalent to the original, and d6–d10 are test gaps. One finding is real: the D11 check compares path text only, so a symlink inside the tree gets around it (Finding 1). Also one error-surface finding (Finding 2) and several stale doc lines. Nothing in the repo or the run worktree was changed.

**Commands.** Tests: `env CLAUDE_CONFIG_DIR=$HOME/.claude-personal $HOME/.local/bin/claude plugin test <mod dir>`. Types: `npx --offline -y -p typescript@5 tsc -p <L>/tsc/tsconfig.json`. Baselines: tests `162 pass / 0 fail` (`<L>/out/baseline.txt`); tsc exit 0. Runners: `<L>/tools/run-mutant.sh` (m1–m4, m6), `<L>/tools/run-mutant-py.sh <L>/tools/m5.py` (m5), `<L>/tools/run-dm.sh d1 … d13` (`<L>/tools/dm.py`); each d-mutant also ran tsc, all exit 0.

## Mutant table (outputs `<L>/out/mutant-<id>.txt`, diffs `<L>/out/mutant-<id>.diff`)

| mutant | pass/fail | red test names | killed? |
|---|---|---|---|
| m1 `now - at > STALE_MS` → `>=` | 161/1 | Q5 boundaries > isStaleAt … | yes |
| m2 `MAX_ROWS = 20` → `21` | 158/4 | Q6 21 markers (FAIL size); N1 chosen pushed past the 20-row limit; N3 both caps; N4 a hidden marker touched each period | yes |
| m3 drop `'-z'` | 135/27 | the brief's 26 names plus D11 a sibling worktree's marker naming the main checkout's plan dir | yes |
| m4 `{ cwd, timeoutMs: RUN_MS }` → `{ cwd }` | 161/1 | F9 every process.run carries timeoutMs 2000 | yes |
| m5 bidi class → `[U+2028U+2029]` | 160/2 | F5 clean blanks bidi controls; F5 a ticket holding U+202E draws no bidi control | yes |
| m6 `!(at > startedAt + 1)` → `!(at > startedAt)` | 160/2 | malformed markers …; F3 fractional mtimes | yes |
| d1 isInside without the `/` boundary | 161/1 | D11 /repo-evil | yes |
| d2 isInside always true | 148/14 | D11 ×6, W3-R4 F2, Q4 ×3, D3, Q3 sibling, Q6 51 worktrees, Q6 21 markers | yes |
| d3 timeIn without `isLink !== true` | 162/0 | — | no: equivalent (claude-code.d.ts:5119-5121: a link lists as kind `other`) |
| d4 planFiles back to stat-then-read | 160/2 | D12 pane plan.md link; D12 pane decisions.md link | yes |
| d5 rowOf `isInside` line removed | 156/6 | D11 ×6 | yes |
| d6 ownTree `cwd.startsWith(root)` no boundary | 162/0 | — | no: test gap; probe P4 kills it (`<L>/out/probe-d6.txt`) |
| d7 planFiles: a failed list always throws | 162/0 | — | no: test gap; P2 (`<L>/out/probe-d7.txt`) |
| d8 planFiles: a failed list never throws | 162/0 | — | no: test gap; P3 (`<L>/out/probe-d8.txt`) |
| d9 timeIn without `kind === 'file'` | 162/0 | — | no: test gap; P6 (`<L>/out/probe-d9.txt`: `read …/plan.md` of a folder) |
| d10 isInside without `root === '/'` | 162/0 | — | no: test gap; P4, P5 (`<L>/out/probe-d10.txt`) |
| d11 parseMarker not folded | 161/1 | D11 a relative plan dir climbing out | yes |
| d12 outside row keeps `planDir` | 160/2 | D11 pane; D11 15 s check | yes |
| d13 pane branch keyed on `problem === 'malformed marker'` | 161/1 | D11 the pane of an outside row | yes |

Probe harness `<L>/tools/probe.sh <name> [d-id]` (appends `<L>/probes/probe-3b.tsx` to a copy of band.test.tsx). On 8bb457d: `170 pass / 1 fail`, the fail P10 (Finding 2), `<L>/out/probe.txt`.

## Findings

**Finding 1. D11 is a text-only check; a symlink inside the tree gets around it.** `hooks/register.tsx:213`, `hooks/model.ts:68-71`; README:54 and register.tsx:194-198 claim "the mod reads nothing in that folder". Kit probe P1: band `["o-9 — secret from outside · run W1 · since 14:00 · 0 decisions"]`, pane `"**o-9 — secret from outside** · run W1\n\n### Recap\n\nTOP SECRET…"`, calls `["list /repo/docs/p","read /repo/docs/p/plan.md",…]`, never a `stat /repo/docs/p`. Real OS: `node <L>/probes/readdir-link.mjs <L>/realfs/tree/docs/p` (docs/p → `<L>/realfs/target`), `<L>/out/readdir-link.txt`: `lstat(dir).isSymbolicLink true`, `{"name":"plan.md","kind":"file","isLink":false}`, text `TOP SECRET`. A clone can commit `r -> /` plus a force-added `.shawarma/active-x` naming `r/<abs path>`; band and pane then show any `plan.md`/`decisions.md` on disk. The Partition row "symlinked plan dir … NOT RUN", now executed. Medium. Possible fix: `$.fs.stat(dir, { resolve: true })` and `isInside` on the real path against the real root.

**Finding 2. The pane says "No shawarma marker in the last scan." when a marker was listed but could not be read.** `hooks/register.tsx:432-437`; the error-surface row "`$.fs.read` of a picked marker … rejects → the pane says `could not be read`" holds only when a press chose it. P10 (marker read fails): band `[]`, command `{"text":"Shawarma pane opened."}`, pane `"No shawarma marker in the last scan."`. P9 (`$.fs.exists` rejects for a plan dir that does not list): the same. The code follows the frozen 2i order; the gap is contract and code together. Side note: `exists` rejecting drops the row silently, no error-surface row. Low.

**Finding 3. Five D11/D12 mutants survive (test gaps):** d6 `model.ts:131` (P4 `ownTree('/repo-evil', ['/repo'])` → `null`); d7, d8 `register.tsx:111-114` (P2 pane `…_No brief yet…_ … _None recorded._`; P3 pane `"The plan files could not be read: HooksError: no implementation for fs.list"`); d9 `register.tsx:101` (P6); d10 `model.ts:70` (P5 worktree at `/` with `docs/p` → `["r — at slash · plan 1 · since 14:00 · 0 decisions"]`). Low.

**Finding 4. Claims check (by reading; P8 executed):** `model.ts:6` orphan JSDoc above `STALE_MS`, `ticketOf` undocumented (from the sketch); `register.tsx:237-241` doc attached to `type Found`, not `snapshot` (sketch); `types/index.d.ts:20` planDir empty also for "plan dir outside its tree"; `types/index.d.ts:26` `problem` holds more than a file name; `types/index.d.ts:14` "after this session's start" vs start + 1 ms; README:35 row template omits `stale: ` and the leading ticket; README:30 `<k> worktrees` vs `1 worktree`; README:49 omits `plan dir not readable`; README:24 omits bare records skipped; README:58 "within 15 seconds" false for a worktree added after the last refresh (P8 after 30 s: `["a · trivial · since 14:00"]`) and for D7; the manifest description and the README settings row still say "the active … plan or run", "the row". Low/cosmetic.

**Not reproduced:** a failed check does not reset `hiddenAtom` (`register.tsx:296-299`), unlike a failed refresh; the kit could not make `stale` throw (`<L>/out/probe-base-with-P7-attempt.txt`, inconclusive).

§3 lines checked by reading, no mismatch: 2a (with D11), 2b, 2c, 2d, 2e, 2f, 2g, 2i (with D11/D12), 2j, 2k; error surface matches except Finding 2.

## Call sites (`git grep -w` at 8bb457d, `<L>/out/callsites.txt`)
- parseMarker: model.ts:56; register.tsx:6, 204; tests 4, 438-444, 447-449, 1012-1016.
- isInside: model.ts:69 (doc 54), 131 (ownTree); register.tsx:7, 213 (rowOf).
- ownTree: model.ts:128; register.tsx:6, 136 (discover).
- timeIn: register.tsx:100, 115, 221, 222, 326 (×2).
- planFiles: register.tsx:110, 453.
- readOr (removed): no code reference outside `docs/`.

Tree: `git -C …/.worktrees/v2tm status --porcelain` printed nothing; HEAD 8bb457d.
