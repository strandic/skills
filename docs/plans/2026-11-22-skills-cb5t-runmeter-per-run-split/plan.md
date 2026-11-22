# skills-cb5t — runmeter cuts a session at each skill command, so its figures are per run

Ticket `skills-cb5t` (no siblings) · authority: the ticket's design, the owner's ruling Q1 (design interview) and the DEFAULTs D1–D10 in [decisions.md](decisions.md), 2026-11-22 · planned 2026-11-22 (claude-opus-5-5; skill 0.11.0) at base `5eaa942 plan(skills-5w5c): research lane, design interview paused on Q1` (local main; `scripts/runmeter.mjs`, `scripts/runmeter.md`, `scripts/plantime.mjs` and `scripts/test/runmeter.test.mjs` are unchanged since `bb89183`: `git diff --stat bb89183 main -- <those four>` prints nothing) · proposed branch `cb5t-runmeter-parts` in `.worktrees/cb5t-run`, cut from `origin/main` after a fetch, with the plan commits cherry-picked; PR + squash merge.

Lessons read (`grep '^## ' docs/plans/lessons.md`, no retro marker yet; the house lessons file has no `- Lesson (<tag>):` lines, so `freeze_check.py --listing` reads it as unusable and F9 is checked by hand here):

- `## skills-v2tm (2026-11-02, PR #5)`: containment through links — no: no path is resolved or checked. Oracle from the contract's words — matches §4: the two existing tests that pin the JSON shape and the doc sentence are edited in the tests commit. Mutants per round — matches §7.
- `## skills-bnbu (2026-11-22, PR #12)`: a stated wait — no: nothing awaits. A docs word against the code's values — matches §2 2f: the Parts section names the exact rule the code tests (`part 0` only is dropped when empty).
- `## skills-cm2l (2026-11-22, PR #13)`: catches that turn an error into an empty value — matches §7 A10: the only new fallback is `part.get(d) ?? 0`. Comments made false — matches §2 2f: the header comment and three doc sentences on labels are rewritten in the executed sketch. Mod version — no: not a mod.
- `## skills-lhwh (2026-11-22, PR #14)`: trivial note shape — no: briefed. `--base` for check_pr — matches §5: pass `--base origin/main`.
- `## skills-4eqz (2026-11-22, PR #15)`: a matcher sent more input — no: `SKILL_COMMAND` and `classify` see the same records as before. Branch from the remote base — matches the proposed branch above.

## 1. What (the defect or goal, measured)

`scripts/runmeter.mjs` prints one line per session (`sessionLine`, `scripts/runmeter.mjs:456-459` at the base) with one label, the session's first skill command (`owner`, :141-154). A session often holds several commands. On this repo's transcripts (`node reports/probe-commands.mjs ~/.claude-personal/projects strandic-skills`, 2026-11-22, aggregates only):

- 5 of 7 sessions with lanes hold more than one skill command; 16 commands in all, 1 of them started by the model (`isMeta`).
- So the per-session figures (owner turns, minutes, tokens, lanes) mix several runs, and cost per run can only be read for sessions that hold one command (the ticket).

The goal: cut each session at each owner-typed skill command, give each part its own line with its lanes, owner turns, minutes and tokens, keep the per-session line as the total, and decide what happens to a lane that starts under one command and ends under the next (Q1).

## 2. The design

The whole change is a patch beside this brief: [sketch.patch](sketch.patch) (`scripts/runmeter.mjs`, `scripts/runmeter.md`, `scripts/test/runmeter.test.mjs`; 3 files, 297 insertions, 20 deletions). `EXECUTED (inputs: the Partition rows below; `node --test scripts/test/runmeter.test.mjs` on the sketch tree → `tests 63 · pass 63 · fail 0`)`.

- **2a** `owner(recs, partOf)`: with `partOf`, also returns `byPart`, the turns per part. A turn counts in the part of its last owner record (D2). Without `partOf` it returns `{ turns, label }` as before.
- **2b** `cuts(recs)`, new, exported: over all of a session's records (never the window), each record that `classify` reads as `human` and whose text opens with `<command-message>` starts a part. Returns `starts` (`{ t, label }` per command, in time order), `partOf(record)` and `partAt(time)` (binary search; a time equal to a command's belongs to that command's part).
- **2c** `parts(recs, lanes, c, turnsByPart)`, new, exported: per part number, in order — `part`, `day`, `label`, `minutes`, `ownerTurns`, `messages`, `tokens`, `lanes` (a count), `laneTokens`. A message counts in the part of its first record (D1). Minutes run over the part's own records (D8). A part a command opened is always kept; part 0 is dropped when it has no message, no turn and no lane (D3).
- **2d** `readSession`: computes `cuts(all)`, passes `c.partOf` to `owner`, sets each lane's `part = partAt(lane's first record)` (Q1) and `crossesCommand = lane's last record > the next command's time` (D10), and adds `parts` to the session. `readLane` also returns `t1`, its last record's time. `collect` nulls each part's label without `--labels`, as it does the session's.
- **2e** `totals`: `lanesCrossingCommand`, the count of lanes with `crossesCommand`. Text: `  lanes that end under a later command: <n>` after the token lines, only when not zero (D9).
- **2f** Text: `sessionLines(s)` prints the session line, then, for a session of two parts or more, each `partLine` followed by that part's lanes; otherwise the lanes as before (D5). `scripts/runmeter.md`: a new `## Parts` section, the four JSON keys in the figure tables, "four sections" for the output's four parts, the Minutes and Limits paragraphs, and the label sentences (header comment, intro, Session label, Privacy rule 3).

Rejected options: placing a lane by its launch call (B) and splitting a crossing lane's figures by time (C) — Q1.

**Sources** (plan step 1; research report [reports/research/report.md](reports/research/report.md); every row re-checked by execution in the attack lane, [reports/attack/report.md](reports/attack/report.md)):

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §2 2b an owner command is a user record with an owner origin | local transcripts, CLI 2.1.301–2.1.330 (19 records); `scripts/plantime.mjs:191@5eaa942` | `if (OWNER_ORIGINS.has(origin) && !d.isMeta) return 'human';` | verified (A2: 0 cut-count mismatches on the real shape) |
| §2 2b a model-started skill does not cut | local transcripts (1 record: `isMeta`, `<skill-format>`, no origin); Skill tool_use (5 + 4 cases) | key sets only, no quote | verified (A2 `modelSkill`, `skillTool` units) |
| §2 2b a record with no origin opening with `<command-message>` reads as `human` | `scripts/plantime.mjs:34,208@5eaa942` | `const OWNER_TAGS = /^\s*<(command-name|command-message|command-args|bash-input)>/;` | verified (A2 NOORIGIN: the sketch cuts, 0 such records in real data; S1) |
| §2 2b commands are in time order for the binary search | `scripts/plantime.mjs:247@5eaa942` | `out.sort((a, b) => ts(a.timestamp) - ts(b.timestamp));` | verified (Array.prototype.sort is stable since ES2019; Node 24.22.3) |
| §2 2d a lane does not outlive its command in practice | local transcripts: 0 of 263 lanes cross a command by launch call, first record or last record | counts only | verified (A1, A3: crossing 0) |
| §6 resume and fork keep timestamps | binary 2.1.330 (embedded JS) | `K={...l,...f,sessionId:d,parentUuid:c,isSidechain:!1,sessionKind:void 0,requestSessionId:CFt(l),forkedFrom:{sessionId:S,messageUuid:l.uuid}}` | not found by the attack lane (not re-read: 0 `forkedFrom` records locally; §8) |
| §2 prior art: a child is tied to its launcher | https://opentelemetry.io/docs/concepts/signals/traces/ | "Links exist so that you can associate one span with one or more spans, implying a causal relationship" | paraphrased by the research lane; informed option B (rejected, Q1) |

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| no skill command | owner typed text only | real d5dd187a; T1 `runs()` part 0 | one part 0; text byte-identical to base (A7) |
| one command, nothing before | `/shawarma plan x` opens the session | fixture S2; real 218a355e | one part; no part line (D5) |
| command after a `/clear` record in the same turn | the base fixture S1 | `--json` test | part 0 dropped (turn moved, D2, D3); part 1 holds 3 turns |
| several commands, lanes in each | owner runs plan then run | T1; real a1fe7339 (6 parts) | parts sum to the session (A1: 10/10 sessions) |
| unlabelled command | args whose first word is no plain word | T3; real c1e1be1d | cuts; label `null` |
| built-in, model skill, Skill tool, typed `/shawarma …` text | the harness, the model, the owner | T3; A2 units | no cut (A2: 0 cut-count mismatches) |
| command record with no origin | older transcripts; the test helper `skill()` | T1–T7 fixtures; A2 NOORIGIN | cuts, as the label rule reads it (S1) |
| two commands in one turn, same instant | queued commands | T7; A4 | both parts kept, part 2 with 0 turns (fixed after A4) |
| turn running into a command | text then a command, no answer between | T4 | the turn counts in the command's part |
| message records on both sides of a command | a message's usage repeated | T4; A2 `asstRepeat` | the message counts in its first part; part minutes over own records |
| lane starts before the first command | early explorer lanes (7 of 126 real) | T1 lane a1 | part 0 |
| lane starts at a command's instant | — | T7 lane a1; A4 | the command's part |
| lane ends at / 1 ms after the next command | a long or background lane | T7 lanes b2, c3; T2 lane d4 | not crossing / crossing; count printed |
| window cuts a part | `--since`/`--until` | T6; A3 190 pairs | cuts over the whole file; part keeps its number and label; sums hold |
| `--labels` off | default | T5; A5 1463 sequences | every part label `null` |
| sizes: commands, lanes, records each to 20 000 / 200 000, and both together | long sessions | `reports/cost.sh` | CPU ≤ 2.4× base, linear (§5 observation) |
| compaction summary, interrupt | the harness | A2 units | no cut; sums hold |

**Attack readings** (one per §7 line; raw values in [reports/attack/report.md](reports/attack/report.md)):

- A1 → 10 of 10 real sessions equal to base on 11 fields; holds; T1 pins the sum. The first run's oracle shared a growing live transcript (finding, line changed to a frozen snapshot).
- A2 → real shape: 1463 sequences, parts-sum 0 and cut-count 0 mismatches; holds, becomes gate R2. NOORIGIN: 644 cut-count mismatches → S1.
- A3 → 190 day pairs, 0 differences; holds; T6.
- A4 → part 2 dropped when two commands share a turn: **changed 2c** (keep every command's part) and added T7; ends-at-instant reading is D10.
- A5 → 0 label without `--labels`, 0 leak hits; holds; T5, existing privacy test. On the new fixtures: NOT RUN (fixtures not exported); A2 covers the same unit kinds.
- A6 → ratio ≤ 1.5 time; `sessionLines` copied a growing array per lane: **changed 2f** (push into a list). Re-measured by `reports/cost.sh` (§5).
- A7 → single-part sessions byte-identical to base; holds; T5 last assertion.
- A8 → 4 keys added, 0 dropped, 0 changed; ranges in the report; part minutes sum below session minutes → D8, documented.
- A9 → doc keys, "four parts" wording, a test for the session total (added T8), same-instant and ends-at-instant tests (added T7).
- A10 (cm2l lesson, executed by the planner) → `part.get(d) ?? 0`: `partOf` is only called on records of the same file, a subset of `all` (`recs = all.filter(...)`); A2's 1463 sequences and A3's windows read no record outside the map (the sums would break). Holds.

After the changes, A2 and A4 were run again on the final sketch (`reports/attack/a2-rerun.out`, `a4-rerun.out`): 1463 sequences, 0 mismatches; parts `[[0,…],[1,"plan t-1",…],[2,"run t-1",0,0,0],[3,"run t-2",…]]`.

**What the planner saw:**

- **S1** A skill-command record with no `origin` cuts, because `classify` reads a record opening with `<command-message>` as the owner's. Real transcripts hold 0 such records (23 have `origin.kind = human`); the base's label rule reads them the same way. Kept: the cut rule is the label rule, as the ticket says ("the label rule already finds them").
- **S2** On real data `lanesCrossingCommand` is 0, so the live run cannot show a crossing failure; T2 and T7 bind it.
- **S3** The full suite on the base fails one test outside this change: `every marketplace entry names a plugin.json with the same name and version` (`node --test scripts/test/*.test.mjs` on `5eaa942`: `tests 670 · pass 667 · fail 1 · skipped 2`). Another stream's version work; not proposed as a ticket here (§8). Once, on `bb89183`, the plantime cost test `classifying four times the command or the notice costs at most six times the time (best of 3)` also failed, a timing test; it passed on the next three runs.
- **S4** A session's part minutes add up to less than its minutes: the time between a part's last record and the next command belongs to no part (d0d36858: 3347.3 vs 3678.6). D8; the Minutes section says so.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `scripts/runmeter.mjs` | run | 2a `owner`, 2b `cuts`, 2c `parts`, 2d `readLane` (`t1`), `readSession`, `collect`, 2e `totals`, `totalLines`, 2f `partLine`, `sessionLines`, `render`; header comment |
| `scripts/runmeter.md` | run | 2f: `## Parts`; keys `parts`, `part`, `crossesCommand`, `lanesCrossingCommand`; Minutes; Limits; label sentences |
| `scripts/test/runmeter.test.mjs` | run | T1–T8; the two edits in "Existing tests that change" |

Data shapes (JSON): `sessions[].parts[]` = `{ part: number, day: 'YYYY-MM-DD', label: string|null, minutes: number, ownerTurns: number, messages: number, tokens: {input, output, cacheWrite, cacheRead}, lanes: number, laneTokens: {…} }`, in part order. `sessions[].lanes[]` gains `part: number` and `crossesCommand: boolean`. `totals` gains `lanesCrossingCommand: number`. No key is removed or renamed (A8). Text: a part line is `  # part <n>[ [<label>]] <day> · <m>m · messages <n> · owner turns <n> · lanes <n> · orchestrator tokens <…> · lane tokens <…>`.

Invariants: per session, the parts' `ownerTurns`, `messages`, `lanes` and each token field sum to the session's. A part opened by a command is kept even when empty (A4, T7). No new error surface: no new exception, exit code or message.

## 4. Tests

All in `scripts/test/runmeter.test.mjs`, synthetic data only (fixtures `runs()` and inline).

- **T1** *red* — `parts: a session is cut at each skill command the owner typed; the parts add up to the session`. Asserts `shape(s)` = `[[0, null, '2026-11-01', 1, 1, 1, 1, 1, 1], [1, 'plan t-0001', '2026-11-01', 11, 2, 2, 1, 30, 2], [2, 'run t-0001', '2026-11-01', 30, 2, 2, 1, 70, 4]]` and the five sums equal the session's. On the base: `TypeError: Cannot read properties of undefined (reading 'map')` (no `parts`).
- **T2** *red* — `parts: a lane counts whole where its first record falls; one that ends under a later command is counted and printed`. Lanes `[a1 0 false] [b2 1 false] [d4 1 true] [e5 2 false] [c3 2 false]`, `lanesCrossingCommand` 1, text line `  lanes that end under a later command: 1`, absent on the base fixture.
- **T3** *red* — `parts: only a skill command the owner typed cuts; a built-in, a model-invoked skill and typed text do not`. `[[1, 'plan t-0001', 3]]`; an unlabelled command cuts: `[[1, 'plan t-0001'], [2, null]]`.
- **T4** *red* — `parts: a turn that runs into a command counts in the command's part; a message seen before a command stays in its first part`. Session turns 2; parts `[[0, 1, 2, 51, 2], [1, 1, 1, 1, 1.5]]` (part, turns, messages, output tokens, minutes).
- **T5** *red* — `parts in text: a line per part, its lanes under it, only for a session of two parts or more; --labels adds the labels and nothing else`. Line 7 = `  # part 1 2026-11-01 · 11m · messages 2 · owner turns 2 · lanes 1 · orchestrator tokens in 30 out 30 cache-write 30 cache-read 30 · lane tokens in 2 out 0 cache-write 0 cache-read 0`; the base fixture prints no `  # part` line.
- **T6** *red* — `parts with --since and --until: the cuts are read over the whole file; a part whose command is before the window keeps its label`. Session label `run t-0001`; parts `[[1, 'plan t-0001', '2026-11-02', 1, 1, 1, 1], [2, 'run t-0001', '2026-11-02', 1, 1, 1, 1]]`.
- **T7** *red* — `parts: two commands in one turn, and commands at one instant, each keep their part; a lane ending at a command's instant does not cross it`. Parts `[[0, null, 1, 1, 0], [1, 'plan t-1', 1, 1, 3], [2, 'run t-1', 0, 0, 0], [3, 'run t-2', 1, 1, 0]]`; lanes `[a1 1 false] [b2 1 false] [c3 1 true]`; `lanesCrossingCommand` 1.
- **T8** *guard* — `parts: the session line stays the total, with the base figures, when its session is cut`. Line 4 = `## aaaaaaaa 2026-11-01 · 70m · orchestrator claude-opus-5-5 · effort ? · messages 5 · owner turns 5 · lanes 3 · orchestrator tokens in 101 out 101 cache-write 101 cache-read 101 · lane tokens in 7 out 0 cache-write 0 cache-read 0`; green on the base and on the sketch.

**Existing tests that change** (plan step 2):

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|
| `--json: one document with the same figures` | the session, lane and totals objects gain keys (the ticket's per-part figures) | `parts: [{ part: 1, day: '2026-09-20', label: null, minutes: 89, ownerTurns: 3, messages: 3, tokens: {60, 600, 6000, 60000}, lanes: 4, laneTokens: {110, 1506, 10079, 100712} }]`; lane `part: 1, crossesCommand: false`; totals `lanesCrossingCommand: 0`. No existing value changes. | red |
| `doc: the reference measures sessions, and says where a session is not a run` | the sentence it pins ("Splitting a session at each command is ticket `skills-cb5t`") is what this ticket removes | the doc holds `The tool cuts such a session into parts, one per skill command` and not `The tool does not split them.` | red |

`doc: scripts/runmeter.md names every --json key` does not change; it goes red if the code ships without 2f's doc keys (seen on the sketch before the doc was written).

Predicted red set on the tests commit (base code, base doc, final test file; `node --test --test-reporter=spec scripts/test/runmeter.test.mjs`, executed): **T1, T2, T3, T4, T5, T6, T7, `--json: one document with the same figures`, `doc: the reference measures sessions, and says where a session is not a run`** — `tests 63 · pass 54 · fail 9`; T8 and every other existing test green.

## 5. Accept gate

- suite, lint and review per run steps 3–4. Full suite on the sketch tree (`node --test scripts/test/*.test.mjs`): `tests 678 · pass 675 · fail 1 · skipped 2`, the one failure being S3's, also failing on the base. `check_pr.py` with `--base origin/main` (lessons skills-lhwh, skills-4eqz).
- live-data run: `node reports/probe-parts.mjs ~/.claude-personal/projects strandic-skills [<since> <until>]` against the run tree (the script imports the tree's `runmeter.mjs`; edit its import path), read-only, aggregates only — observation, no rule: at plan time on the sketch, 10 sessions, 28 parts, `invariant failures 0` with no window and with windows `2026-10-29..2026-11-10`, `2026-11-12..2026-11-12`, `2026-11-21..2026-11-22`; lanes crossing a command 0. Cost observation (`bash reports/cost.sh <scratch> <base tree> <sketch tree>`, CPU user+sys, best of 2): commands alone 2 500 → 20 000, base 0.06 → 0.14 s, sketch 0.10 → 0.30 s; lanes alone 2 500 → 20 000, base 0.31 → 1.49 s, sketch 0.25 → 1.83 s; both together at 20 000, base 1.74 s / 158 MB, sketch 1.97 s / 225 MB; records alone 200 000, base 0.99 s / 301 MB, sketch 1.32 s / 315 MB. Bound stated: CPU at most 2.5× base and linear in each size (4n/n ≤ 4.5 on the sketch; commands 20 000 / 5 000 = 0.30 / 0.13 = 2.3).
- **R1** — the runmeter tests pass. · `node --test scripts/test/runmeter.test.mjs` on the run tree, reading `ℹ tests`, `ℹ fail` · dataset: the test file's synthetic fixtures, whole · settle: once, at Wave 3 and again after each fix round · dry-run with the fix in: `tests 63 · pass 63 · fail 0` · FAIL reading: base code with the final tests, `tests 63 · pass 54 · fail 9` (the predicted red set); nearest wrong fixes as mutants (§7): `fail 1` each · cannot run (the test file missing): `Could not find 'scripts/test/runmeter.test.mjs'` and no `ℹ tests` line, read as cannot-run · PASS when `failed: 0` and `ran ≥ 63`, ran printed as `ℹ tests` (63 on the sketch tree; a ran below 63 is a RULING).
- **R2** — every enumerated sequence's parts add up to the base session, and the cuts equal an independent count. · `node docs/plans/2026-11-22-skills-cb5t-runmeter-per-run-split/gate/parts-sum.mjs <base scripts dir> scripts` (base = a worktree at the base commit), reading `graded <n>/1463`, the `(a)`, `(b)`, `shared session fields changed`, A5 counts, and the last line · dataset: all 1463 sequences of length 1–3 over 11 unit kinds, typed commands with `origin.kind = human` (generated by the script, no seed needed: deterministic) · settle: once · dry-run with the fix in: `graded 1463/1463 · crashed 0`, all counts 0, `PASS` · FAIL reading: mutant m1 (a message counts by each record's own part) → `(a) parts-sum mismatches 6`, `FAIL`; mutant m3 (an `isMeta` command also cuts) → `(b) cut-count mismatches 353`, `FAIL` · cannot run (the candidate has no `parts`: the base given as the candidate) → `graded 3/1463 · crashed 1460`, `CANNOT-RUN` · PASS when the last line is `PASS`. Mutant m4 (drop an empty command part) reads PASS here: R2 has no power on it; its binding test is T7.
- orchestrator follow-ups: none. S3's failing marketplace test belongs to another stream.

## 6. Worst impact

A hostile or malformed transcript can at worst put a lane, a turn or a message in the wrong part, which misstates one run's cost and the next one's while the session total stays right; it cannot print private text (labels only with `--labels`, A5: 0 hits), write a file or stop the tool (A2: 0 crashes on 1463 sequences). ⇒ the code-review lane, with A2 and A5 standing in as the executed adversarial stand-in.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines A5 (on the new test fixtures), a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests A2, A3, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose (`scripts/runmeter.md` Parts, Minutes, Limits, label sentences) · §3's error surface, by attacks of its own |

Attack lines (executed at plan time, [attack-lines.md](attack-lines.md)):

- A1 every real session, no window: parts sum to the session's 11 figures → oracle base runmeter `--json` on one frozen snapshot.
- A2 enumerate: sequences of length 1–3 over {owner text, labelled command, unlabelled command, built-in command, model-invoked skill, Skill tool call, assistant message, repeated message id, lane start, compaction summary, interrupt} (`gate/parts-sum.mjs`) → oracle base session figures, and an independent cut count (owner origin, no `isMeta`, opens with `<command-message>`).
- A3 enumerate: every (since, until) pair of real days (190) → oracle base runmeter with the same window.
- A4 lanes at, and 1 ms past, a command's instant; two commands at one instant → oracle Q1's words and D10.
- A5 no label without `--labels`; no private text, path or full id → oracle string scan.
- A6 20 000 commands and lanes; 200 000 records; 20 000 lanes in one part → oracle base CPU and RSS on the same input.
- A7 sessions of one part print byte-identically → oracle base text output.
- A8 per-field JSON diff on real data → oracle per-field diff.
- A9 plan-time flags (spike rules, independence of expected values, checklist).
- A10 every `??` fallback the diff adds → oracle: the sums of A2 and A3.

Mutants for 3b (each run on the final test file, `node --test --test-reporter=spec scripts/test/runmeter.test.mjs` in a scratch copy):

- `mutant: in parts(), delete "if (id !== null) { if (firstPart.has(id)) p = firstPart.get(id); else firstPart.set(id, p); }" → T4 red (fail 1) (reports/gate-m1.out for R2)`
- `mutant: in cuts(), "=== 'human' &&" → "=== 'human' || d.isMeta) &&" (with the opening parenthesis) → T3 red (fail 1) (reports/gate-m3.out)`
- `mutant: in parts(), "if (p === 0 && !u.messages …" → "if (!u.messages …" → T7 red (fail 1) (reports/gate-m4.out)`

## 8. Out of scope

- Splitting a run that spans two session files (resume into a new file, `/clear`, fork): each file's parts stand alone; the Limits section says so. Forks keep old timestamps (§2 Sources); 0 local.
- Placing a lane by its launch call (`meta.toolUseId`, Workflow run folder): rejected in Q1; would be its own ticket if crossings show up.
- Per-part models and effort (D5).
- S3, the failing marketplace test: another stream's.
- Out-of-diff review findings: ticket, unless they make a §3 invariant false.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|

## Plan ending: defaults

> **What this is about:** how the parts are cut and printed, in the cases the ticket and the one ruling leave open. Each line below is a default: silence accepts it, an answer changes it. Readings: §2 Partition and Attack readings; tests T1–T8. Where the residue goes: an answer that changes one becomes a §9 row before `run`.

unruled: D1 a message counts in the part of its first record — default as §2 2c
unruled: D2 an owner turn counts in the part of its last owner record — default as §2 2a
unruled: D3 a part a command opened is always kept; part 0 is dropped when it has no message, turn or lane — default as §2 2c
unruled: D4 cuts read over the whole file; figures over the window; a part keeps its command's label before the window — default as §2 2b, 2c
unruled: D5 part lines only for a session of two parts or more, no model or effort per part — default as §2 2f
unruled: D6 part 0 before the first command, part N the Nth owner skill command in the file — default as §2 2b
unruled: D7 every owner-typed skill command cuts, any skill, labelled or not — default as §2 2b
unruled: D8 part minutes run over the part's own records; parts' minutes can sum below the session's — default as §2 2c
unruled: D9 the crossing count prints in text only when not zero, always in JSON — default as §2 2e
unruled: D10 a lane ending at the next command's exact instant does not cross it (strict `>`) — default as §2 2d
