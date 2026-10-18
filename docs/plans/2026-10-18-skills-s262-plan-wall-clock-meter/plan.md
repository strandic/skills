# skills-s262 — shawarma retro: a plan wall-clock meter

Ticket `skills-s262` (no folded siblings) · authority: the ticket's text, round-7 ruling R3 (the meter moves to `scripts/`; the ticket closes when the project-agnostic script lands), plan ruling R4 (2026-10-18: transcript retention set to 365 days) and DEFAULTs D1–D7 (accepted 2026-10-18), all on the ticket · planned 2026-10-17 to 2026-10-18 (claude-opus-5-5; skill shawarma as installed, no version field) at base `e93e92e chore(beans): triage …` (the brief commits on `b8b1cc6`, which changes only `.beans/`) · proposed branch `feat/s262-plantime` in `.worktrees/s262-plantime`, PR + squash merge. Lessons read: none (`ls docs/plans/lessons.md` → No such file; no house rules file, so the skill's defaults apply).

Terms:
- **meter**: `scripts/plantime.mjs`, the script this brief adds.
- **window**: from the first `plan <ticket>` command in a session (the **opener**) to the brief commit's time.
- **bucket**: a named share of the window's time. Each gap between two transcript records is charged to the record that ends it.
- **wait buckets**: `human` (owner wait), `other-session-wait`, `lane-wait`, `exec-wait`, `idle-for-coordinator`, `scheduled`, `external`, `interrupt`, `compaction`, `other`. The rest (`model`, `exec:*`, `vcs/tracker`, `file-io`, `web`, `lane-*`, `tool:other`) are **work buckets**.
- **old meters**: bigbrain's `docs/retros/2026-10-08-shawarma-round-6/tools/plantime.py` and `docs/retros/2026-10-14-shawarma-round-7/tools/plantime_r7.py`. They live outside this repo; only the orchestrator runs them (§5).

## 1. What (the goal, measured)

The retro needs to know where a plan's wall-clock time goes. Rounds 6 and 7 measured it with one-off Python scripts in another repo. This ticket moves a generic meter into `scripts/`, runnable on any project's transcripts. It prints durations and counts only, because transcripts may hold private data and this repo is public.

What the old meters got wrong, measured by the sketch on the same windows (§5, G2 and the readings below):
- Round 7's 1735 minutes of `other` (ticket 063y) were the session waiting on another session. The sketch reads them as `other-session-wait`.
- 164 minutes the old meters called `human` were a compaction running while the session idled. The sketch passes a compaction's gap to the record that wakes the session.
- The old rules for "killed at the tool limit" missed every call moved to the background at its limit and every background command stopped at its background limit (Claude Code 2.1.285 and later), and counted command output that quoted the harness's words.

Restated round totals (DEFAULT D4), `node scripts/plantime.mjs <bigbrain transcripts> gates/plans-r6.txt` and `plans-r7.txt`:
- round 6: orchestrator 27.2 h, human 751 m (46%), lane-wait 333 m (20%), other-session-wait 307 m (19%), model 116 m (7%), exec:suite 94 m (6%); lanes 8.6 h.
- round 7: orchestrator 94.9 h, human 3391 m (60%), other-session-wait 1950 m (34%), lane-wait 140 m (2%), model 136 m (2%); lanes 2.9 h.

## 2. The design

Whole-file sketches sit beside this brief: `sketch/scripts/plantime.mjs` and `sketch/scripts/test/plantime.test.mjs`. Both are `EXECUTED (inputs: the Partition rows below; 32 tests; rounds 6 and 7 of the bigbrain transcripts; every local transcript for the population readings)`. Copy them as they are. The meter's header doc comment is the contract (§3).

How it works:
1. **Inputs.** A transcripts dir (one project's folder under the Claude Code config dir's `projects/`) and a plans file: one plan per line, `<ticket> <session prefix> <brief commit time> [<start time>]`. The script never runs git (D6): the brief time comes from `git log -1 --format=%cI <commit>`.
2. **Read.** Each session file is split on bytes, so a file past the engine's string limit still reads. A line that is not JSON, and a user or assistant record with no real timestamp, is counted in `unreadableRecords`, never silently dropped.
3. **Window.** The opener is a `<command-args>plan <ticket>…</command-args>` record or a typed `/…shawarma plan <ticket>`, outside lanes and meta records. A start time in the plans file overrides it.
4. **Classify** each record (`classify`): the bucket of the gap it ends. Assistant records are `model`. A tool result takes its call's kind (`exec:suite`, `exec:probe`, `exec:lint`, `vcs/tracker`, `exec:other-shell`, `file-io`, `web`, `lane-*`, `human` for an AskUserQuestion answer). A user record is read by its origin first, then by a tag that opens its text. A tag counts anywhere only when the record has a harness origin (`task-notification`, `peer`, `coordinator`), because the owner can type or quote a tag. A record whose origin is `task-notification` is a notification whatever the command it quotes holds; a peer record relaying another session's message stays that session's whatever the message quotes. A task notification is `exec-wait` when its call was a Bash or Monitor call, found by `<tool-use-id>` or by the task id its result carried. When the transcript holds no such call, the harness's words decide (`Background command "`, `Monitor event: "`, `<summary>Monitor`).
5. **Split** (`split`): records that only accompany a wake-up (meta, system reminders, empty) and compactions pass their gap to the next record when that record wakes the session; otherwise the gap is `other` or `compaction`. Owner turns and the wait before each are counted. Calls that hit their time limit are counted from the harness's record only: `timedOutAfterMs`, its words opening a Bash result, or its notice that a background command was stopped at its background limit. Each call counts once per transcript file, so a call moved to the background at its limit and later stopped at the next is one. A call the file does not hold is known by the id the record names; a record naming none is a call of its own. Elapsed time never counts (D1).
6. **Lanes.** Subagent transcripts whose first record lies in the window, at any depth under `<session>/subagents/`, are split the same way and summed. Links, FIFOs and unreadable entries are skipped and counted.
7. **Output.** Text per plan, then totals; or `--json`, one object per plan. A plan that cannot be measured reads `NOT RUN (<why>)`. Errors give an fs error code, never a path.

Rejected options: a Python port (R3 and the repo's scripts are Node); counting ask rounds from the transcript alone (D2: needs a marker the skill writes, skills-hekn); naming the command in the retro's text in this PR (D5: skill text changes only at a retro).

**Sources** (plan step 1):

| sentence (§ · label) | source | verbatim quote | attack-lane re-read |
|---|---|---|---|
| §2 step 2 · transcript location and layout | `~/.claude-personal/projects/<project>/` listing, CLI 2.1.302 | 108 main files, 617 under `subagents/` (362 under `subagents/workflows/…`) | verified (passes 1–2) |
| §2 step 4 · origin kinds | CLI 2.1.302 bundle, origin switch | `case"human":case"channel":case"peer":case"task-notification":case"coordinator":case"unclassified":case"observer":…case"plugin":case"slack-ping"` | verified (pass 1); local population: human 1276, peer 507, task-notification 387, coordinator 62 (pass 3) |
| §2 step 4 · background notification words | CLI 2.1.302 bundle | `Background command "…" completed`, `Monitor event: "…"` | verified (pass 3, A2: 14 orphan notifications, 0 disagreements) |
| §2 step 5 · moved to the background at the limit | CLI 2.1.302 bundle, Bash result text | "Command did not complete within its ${n}s timeout and was moved to the background" | verified (pass 2) |
| §2 step 5 · stopped at the limit | CLI 2.1.302 bundle | "Command timed out after ${…}" | verified (pass 2) |
| §2 step 5 · `timedOutAfterMs` on the result | CLI 2.1.302 bundle | `function xyr({backgroundTaskId:e,…,timedOutAfterMs:y,…})` | verified (pass 2) |
| §2 step 5 · the moved-to-background message | Claude Code changelog, 2.1.250 | "Improved the Bash/PowerShell tool message when a command hits its timeout and is auto-backgrounded, so the model can distinguish a hang from an explicit background request" | planner read (2026-10-18) |
| §1, §2 step 5 · background commands stop at a limit | Claude Code changelog, 2.1.285 | "Changed background Bash and PowerShell commands to stop after a time limit (their `timeout` with `run_in_background`, default 30 min, max 2 h); Claude is notified when one is stopped" | planner read; the notice's words from 5 real notifications ("Background command \"…\" was stopped after reaching its background time limit"); pass 7 |
| §3 header · retention | CLI 2.1.302 settings schema | `cleanupPeriodDays: int().positive().optional()` "Number of days to retain chat transcripts before automatic cleanup (default: 30)" | planner read; the effect of 365 is `unexecuted` until a transcript passes 30 days (R4) |
| §2 step 2 · string limit | Node docs, `buffer.constants.MAX_STRING_LENGTH` | "the largest length allowed for a single string instance" | verified (pass 2) |

**Partition** (spike q2), per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| plans line | the retro's operator | test "parsePlans": 2 good lines, 11 refusals, BOM, CRLF, `#` inside a field | green |
| time field | the operator; transcripts | L4 (pass 3): 18 forms vs Python | 0 disagreements |
| session prefix | the operator | test "sessionFile": unique, ambiguous, missing, a directory, a link | green; refusals name no path |
| transcript bytes | the harness; a crash; a hostile file | L6 (pass 3): 13 byte cases vs Python; tests "records" | 2 cases differ by design (invalid UTF-8 read with U+FFFD; untimed records now counted) |
| record origin × tag position | the harness; the owner typing | A1 (pass 4): 10 kinds × isMeta × 5 tags × 8 positions; E1 (pass 5): 624 cells; H1 (pass 6) | matches the header after the pass-5 fixes; see Attack readings |
| task notification | the harness | A2 (pass 4): 387 real; 14 with no known call | 0 disagreements with the harness's own words |
| record sequences at the opener and the start | the harness; a start time | A3 (pass 4): 985 sequences; 132 real openers; `gates/turns.mjs`: 1560 sequences | 0 differ from the header's rule; 0 real readings change |
| Bash command | the model | isProbe vs the default regex: 88,741 enumerated strings (test), 1,254,305 grammar strings and 33,951 real commands (pass 4) | 0 disagreements |
| subagents tree | the harness; links; FIFOs; mode 000; a lane with nothing readable | tests "lanes", 28; E3 (pass 5) | skipped and counted, never followed |
| CLI entry path | the operator | test "the CLI prints from any path"; L7 (pass 3): 13 forms | prints or exits 1 with usage; never a silent exit 0 |
| sizes | long sessions | cost probes (§5 G5) | linear |

**Attack readings** (eight passes; 1 and 2 ran before the questions ending, 3–8 after R4):
- Passes 1–2: 19 findings, all fixed in the sketch (gate G3 added; paths on error paths; FIFO hang; link loops; elapsed-time false positives; interrupts, AskUserQuestion answers and background notifications misread; entry through a link or `%`; BOM; the string limit; Monitor events by task id; lost owner turn after the opener; impossible dates; exit 0 on a missing dir; one long line dropping a session; `--preserve-symlinks-main`; quoted timeout phrases).
- Pass 3 (L1–L10 → readings above): F1 orphan notifications read lane-wait → fixed (step 4, harness words), test "classify: a background command's notification…". F2 owner text quoting tags, and owner text starting with the interrupt words → fixed (origin first; tags open the text unless the origin is the harness's), test "classify: what woke the session". F3 a record at the opener's instant made the opener a turn → fixed (`t > t0`), test "split: a record at the opener's own instant…". F4 untimed records dropped silently → counted, test "records". F5 `Math.max(0, ...waits)` overflowed past ~150k turns → `waitStats`, test "waitStats". F6 the default probe regex is quadratic (225 kB took 8.8 s) → `isProbe`, tests "isProbe" and "cost: classifying four times the command". F7 G3 restates classify's rules → its claim narrowed (§5 G3).
- My first F2 fix (tags only opening the text, for every record) changed real readings: 14 peer records carry their cross-session tag mid-text. G2 and G3 caught it (FAIL 1 cell, FAIL 3/6). Fixed to the rule in step 4; test case "Message relayed. <cross-session-message…" binds it.
- Pass 4 (A1–A7 on the pass-3 changes): no hang, crash or leak. F1 an unknown origin quoting a tag was read by the tag → `external` now precedes every tag check; test cases `channel`, owner meta. F2 an owner-origin record with the interrupt words reads human → kept: all 40 real interrupts have no origin; the header now says so. F3 the turn rule's 1 ms edge → written into the header. F4 "unreadable lines" mislabelled untimed records → renamed `unreadableRecords`, text "records not read (bad line or no real timestamp)". F5 untimed records in lanes were dropped silently → summed into `unreadableRecords`, test "measure: records not read are counted…".
- Pass 5 (E1–E4 on the pass-4 changes): 0 class changes over 48,478 real user records. F1 the interrupt words under any origin read `interrupt` → only a record with no origin is an interrupt, checked after `scheduled` and `external`; test cases `channel`, `scheduled`, `peer`. F2 a lane file with nothing readable vanished from the output → counted in `lanesSkipped`; test 28. F3 a harness-origin record's tag decides over its origin (14 real peer records relay another session's message) → kept, written in the code comment. F4 "nothing between" in the turn sentence → "only accompanying records between"; test 13's reminder case. F5 the session's count covers the whole file → the header and the output line say so.
- Pass 6 (H1–H4 on the pass-5 changes): H1 108 cells, 0 mismatches. H2 `NOT RUN (its oracle, the pass-5 variant, shares records() and classify with what it grades)`. H3 12 lane-file shapes match by hand. F2 the header called an empty lane file skipped → the header now says an empty or blank-only file is no lane. F3 with a start time, an owner record continuing a turn whose wait crossed the start became a turn → a turn whose wait crosses the start is not counted, nor are the records joining it; test 13's start-time case.
- Planner's own finding after pass 6: the 2.1.285 changelog shows background commands stopped at their own limit, by a notice, not a tool result. 5 real notices; the meter missed them (wrong count, plan step 3(c)) → counted, once per call (3 calls had been moved at their limit and then stopped); `l3pop2.py` given the same rule in its own code; test 14's last five cases.
- Pass 7 (M1–M5 on that change): real data, meter and reader count the same 150 records by (file, uuid). F1 the stop-notice regex `"[\s\S]*"` was quadratic (1 MB notice: 50 s) → two `indexOf` searches; test 22's notice case. F2 a stop notice quoting `<cross-session-message` was read as another session's → a `task-notification` origin decides first; test 14. F3 a `tool_use` seen again made a second call → the first entry is kept; test 14. F4 the header did not say "each call once" → it does, per file. F5 the G4 reader copied the meter's regexes → rewritten with string operations. F6 the reader's seen-set spanned files → per file.
- Pass 8 (N1–N5 on the pass-7 changes): N2 linear (4× → ≤ 4.6×); N3 0 class changes on real data. F1 the stop match accepted one quote as both the opening and the closing one (27,149 of 471,453 swept strings) → offset fixed; `gates/stopsweep.mjs` (below) and test 14. F3 two notices naming the same unknown call counted twice → an unknown call is keyed by the id it names; test 14. F5 a peer record relaying another session's message with a stop notice inside was counted → the relay stays the other session's; test 14. F6 and F8 the reader read lines the meter refuses (NaN, a BOM mid-file, `+0000` and week dates, empty ids) and skipped dot-directories → aligned. F2 the reader's stop match is the spec's sentence, as the meter's is: G4 does not grade that sentence (test 14 and the sweep do). F4 notices timed within the same millisecond as their call but before it in the file count twice → DEFAULT D8 below. F7 invalid UTF-8 is read with U+FFFD, by design (pass 3 L6).
- The pass-8 fix lines did not go back through a lane: `NOT RUN (lane)`, in 3a's cell. In its place, executed: `node gates/stopsweep.mjs $PWD/scripts/plantime.mjs` (the stop match, read through `split`, against the old regex on every string of up to 5 tokens) → `{ cases: 19608, differ: 0 }`, and with the off-by-one back → `differ: 947`; `node gates/classdiff.mjs <pass-6 sketch> scripts/plantime.mjs ~/.claude-personal/projects` → `{ records: 135388, changed: {} }`; the G4 reader against the meter on pass 8's hostile corpus → equal on every file but one with a year-0000 timestamp (the meter takes it as a real instant; Python's datetime starts at year 1; the harness writes no such year).
- The pass-6 F3 fix lines (the turn counting in `split`) did not go back through a lane: `NOT RUN (lane)`, in 3a's cell. In its place: `node gates/turns.mjs $PWD/scripts/plantime.mjs` grades every sequence of up to 4 records from {owner, meta, model, interrupt, AskUserQuestion answer}, with and without a start before the first record, against the header's turn rule written out by hand in that file → `{ cases: 1560, differ: 0 }`; the pre-fix rule → `differ: 56` (liveness).

**What the planner saw:**
- The default probe pattern does not count `python3.12 x.py` or a quoted `"|"` as a probe. `isProbe` inherits this from the regex (pass 4, A5). It is a default the operator can override with `--probe`; not wrong output about what the meter claims.
- `isProbe` on 16 MB of `|` takes ~1 s and 335 MB, because `split` builds an array (pass 4, A6). Linear; the longest real command is 45,700 characters.
- G3's FAIL readings bind only on round 7 (063y). On round 6, W1–W5 all read PASS 6/6.
- The pass-3 C1, C4 and C5 fixes and the pass-4 and pass-5 classify fixes change 0 readings on real data (pass 5, E2: 0 class changes over 48,478 user records); their only FAIL readings are their unit tests.
- Peak memory is about 2.7× the transcript's size (381 MB → 1015 MB RSS). The largest real transcript is about 145 MB.
- A median of an even count is the lower middle; the header says so.
- **DEFAULT D8** (plan step 3(c), judged unreachable): two records in the same millisecond keep their file order. A stop notice written before its own call within one millisecond would count the call twice. Reading: every real stop notice whose call is in its file comes after the call and in a later millisecond (7 of 7; one more names its call by task id), by a direct walk of `~/.claude-personal/projects` (2026-10-18).

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `scripts/plantime.mjs` | code worker | new: `sketch/scripts/plantime.mjs` as is |
| `scripts/test/plantime.test.mjs` | tests worker | new: `sketch/scripts/test/plantime.test.mjs` as is |

- CLI: `node scripts/plantime.mjs <transcripts dir> <plans file> [--json] [--suite|--probe|--lint|--vcs <regex>]`. Exit 0 with output; exit 1 with one line on stderr on an error below.
- Exports (named): `DEFAULTS`, `ts`, `isProbe`, `bashKind`, `toolKind`, `classify`, `isIso`, `records`, `split`, `planStarts`, `parsePlans`, `sessionFile`, `fmt`, `waitStats`, `measure`, `main`.
- JSON per plan: `ticket, wallMs, attributedMs, planCommands, ownerTurns, ownerWaitsMs, timeLimitHits, unreadableRecords, lanes, lanesSkipped, buckets, laneBuckets`; a plan not measured: `{ticket, notRun}`.
- The header doc comment is contract text: every rule it states is a §4 test. Its class words, and the code comments' (line numbers in `sketch/scripts/plantime.mjs`), each with what searched for a counterexample:

| line | claim | searched by |
|---|---|---|
| 4 | never message content | test 27 (sentinels in every field, error paths included); §7 sentinel line; pass 3 L10 |
| 15–21 | owner turns: records at the opener's instant, accompanying records between, a wait across the start | tests 10, 11, 13, 15; `gates/turns.mjs` (1560 sequences) |
| 21–26 | each call counts once per file; an unknown call by the id it names; a record naming none on its own | test 14; G4; pass 7 M2, pass 8 N4 |
| 26–29 | `unreadableRecords` scope; a lane with nothing readable is skipped, an empty one is no lane | tests 20, 28; pass 5 E3, pass 6 H3 |
| 49 | a record that only accompanies a wake-up passes its gap on | tests 4–8 |
| 53, 56 | any other origin kind, any other leading tag is `external` | test 2 (`channel`, `auto-continuation`, `some-future-kind`, `slack-ping`); pass 6 H1; §7 enumerate E-origin |
| 65 | `isProbe` is the default regex without its backtracking, on every command | tests 21, 22; pass 4 A5 (1,254,305 strings), A6 |
| 147 | with no harness origin, a tag counts only opening the text | test 2; pass 4 A1, pass 5 E1 |
| 220 | a compaction's gap is its own only when no wake-up record comes next | test 8 |
| 251 | the stop match retries from no opener | test 22's notice case; pass 8 N2 |
| 259 | elapsed time never counts | test 14 ("late but completed"); G4 |
| 325 | lanes at any depth | test 23 (`workflows/wf_1/`) |

The totals' labels ("ORCHESTRATOR, all") name a sum, not a claim.
- Error surface:

| error | where | what the caller can do |
|---|---|---|
| `transcripts dir not readable: <code>` | thrown from `measure`, exit 1 | fix the path or permissions |
| `plans file not readable: <code>` | `main`, exit 1 | fix the path |
| `plans file line <n>: <why>` | `parsePlans`, exit 1 | fix that line |
| `--<flag> is not a valid regex`, `--<flag> needs a regex`, usage | `main`, exit 1 | fix the arguments |
| `session not found: 0 transcripts match` / `session prefix is ambiguous: <n> transcripts match` | that plan reads `NOT RUN` | fix the prefix; a plan older than `cleanupPeriodDays` is gone |
| `session transcript not readable: <code>` | that plan reads `NOT RUN` | fix permissions |
| `no \`plan <ticket>\` command before the brief time`, `start is after the brief time` | that plan reads `NOT RUN` | give a start time |

## 4. Tests

All in `scripts/test/plantime.test.mjs`, synthetic data only, numbered in file order:

1. classify: a tool result takes the kind of its call — *red*
2. classify: what woke the session — *red*
3. classify: a background command's notification is a wait on the command, a lane's on the lane — *red*
4. classify: records that only accompany a wake-up are deferred — *red*
5. split: a deferred gap goes to the wake-up record that follows it — *red*
6. split: a deferred gap followed by the model is other, never model — *red*
7. split: a deferred gap at the end of the window is other — *red*
8. split: an idle compaction is owner wait; a mid-turn one is compaction — *red*
9. split: gaps that cross the window edges are dropped — *red*
10. split: an owner record right after the window opens starts a turn — *red*
11. split: a record at the opener's own instant is not a turn after it — *red*
12. waitStats: median and max of any number of waits — *red*
13. split: owner turns count runs of owner records; a compaction or reminder between adds none — *red*
14. split: tool calls that hit their time limit, by the harness's record only — *red*
15. split: an AskUserQuestion answer is an owner turn; an interrupt is not — *red*
16. planStarts: plan commands for exactly this ticket — *red*
17. parsePlans: fields, comments, and refusals by line number — *red*
18. isIso: real instants only — *red*
19. sessionFile: a unique prefix; refusals do not name the path — *red*
20. records: unreadable lines and untimed records are counted, the rest sorted — *red*
21. isProbe: the default probe regex's verdict on every command, without its backtracking — *red*
22. cost: classifying four times the command or the notice costs at most six times the time (best of 3) — *red*
23. measure: one plan, its lanes nested at any depth, and a plan with no command — *red*
24. measure: a given start time overrides the plan command; a start after the brief is refused — *red*
25. lanes: links, loops, pipes and unreadable files are skipped and counted, never followed — *red*
26. unreadable inputs read NOT RUN by error code — *red*
27. output holds durations and counts only: no message text, command, session id or path — *guard*
28. measure: records not read are counted in the session and its lanes — *red*
29. measure writes nothing — *guard*
30. main: flags and usage — *red*
31. the CLI prints from any path to the script: a link, a %, a # — *red*
32. cost: four times the records costs at most six times the time (best of 3) — *red*

Red means: fails against `gates/plantime.stub.mjs` (the exports with no behaviour) copied to `scripts/plantime.mjs`. Every red fails at an assertion (AssertionError), never a TypeError. The executed assertion of each is the test body in the sketch file.

**Existing tests that change:** none. `node --test scripts/test/*.test.mjs` with the sketch in → 545 tests, 543 pass, 0 fail, 2 skipped (base `e93e92e`: 513 / 511 / 0 / 2).

Predicted red set on the tests commit (the stub in place of the meter; `gates/stub-run.txt`): **1–26, 28, 30, 31, 32** (30 red, all AssertionError); guards 27 and 29 green.

## 5. Accept gate

- suite, lint and review per run steps 3–4.
- live-data run: the orchestrator runs G1–G4 on its own machine, read-only, aggregates only. The transcripts are not in the repo; a worker reads `DRY-RUN ON STAND-IN` (the unit tests) and says so in the PR. Readings with no rule (the restated totals in §1) go in the PR's Verification.
- Paths below: `P=docs/plans/2026-10-18-skills-s262-plan-wall-clock-meter`, `B=~/.claude-personal/projects/-Users-jonathan-Documents-bigbrain`, `R=~/Documents/bigbrain/docs/retros`, `O6=$R/2026-10-08-shawarma-round-6/tools/plantime.py`, `O7=$R/2026-10-14-shawarma-round-7/tools/plantime_r7.py`, and `node scripts/plantime.mjs $B $P/gates/plans-r<k>.txt --json > /tmp/r<k>.json` first.

Rules, written now:

- **G1 work buckets equal the old meters.** `python3 -I $P/gates/oracle.py $O6 $B $P/gates/plans-r6.txt /tmp/r6.json` and the same with `$O7` and r7; reads the last line. Dataset: rounds 6 and 7, case by case (every plan, orchestrator and lanes; work buckets equal to the ms, wait buckets equal as a sum). Settle: once. PASS: `PASS 6/6` and `PASS 7/7` (dry run with the fix in, 2026-10-18). FAIL reading: M4 (a gap that crosses the window start counted) → `FAIL 6/6` and `FAIL 7/7` (2026-10-18). Cannot run (an old meter or the transcripts missing): `NOT RUN` from the shell, which differs from `PASS`. R4 keeps the round-6 transcripts past Nov 4 2026; if they are gone anyway, G1 reads round 7 alone and says so.
- **G2 every class change is named.** `python3 -I $P/gates/crosstab.py $O6 $B $P/gates/plans-r6.txt scripts/plantime.mjs` and the same with `$O7` and r7; reads the last line. Dataset: rounds 6 and 7, every in-window gap weighted by ms. Settle: once. PASS: `PASS` and `PASS` (dry run, 2026-10-18). FAIL reading: the first pass-3 F2 fix (tags only opening the text for every origin) → `FAIL 1 cells` on both rounds (2026-10-18). Cannot run: as G1.
- **G3 the wait split, read a second way.** `python3 -I $P/gates/g3.py $B $P/gates/plans-r6.txt /tmp/r6.json` and r7; reads the last line. It finds its own window and lanes and tells exec-wait from lane-wait by the harness's words; its origin and tag rules restate `classify`, so it does not grade them (tests 2–4 do). Dataset: rounds 6 and 7, case by case; the binding slice is round 7. Settle: once. PASS: `PASS 6/6` and `PASS 7/7` (dry run, 2026-10-18). FAIL readings, `python3 -I $P/gates/wrongfix.py <tree> $B $P/gates/plans-r7.txt`: W1 (another session's message is not a wake-up), W2 (deferred gaps are owner wait), W3 (compaction is owner wait) → `FAIL 1/7` each; W4 (no task-id mapping) and W5 (owner origin not read first) → `PASS 7/7`, no power on this data: tests 3 and 2 bind them. On round 6 all five read `PASS 6/6`. Cannot run: as G1.
- **G4 time-limit hits, counted a second way.** `python3 -I $P/gates/l3pop2.py ~/.claude-personal/projects` (reads `oracle <n>`; its own walk, parsing and string matching, no code or regex shared with the meter; both read the harness's same sentences, which tests 14 and 22 and `gates/stopsweep.mjs` grade) against `node $P/gates/limits.mjs $PWD/scripts/plantime.mjs ~/.claude-personal/projects` (reads `<n>`). Dataset: every local transcript, in aggregate. Settle: once, both counts taken in the same minute (transcripts grow). PASS: equal (150 and 150, 2026-10-18). FAIL readings (2026-10-18, final code, oracle 150): counting only `timedOutAfterMs` → 124; the harness's words anywhere in the result, as the old meters did → 167; no background-limit notices → 146; each notice counted, not each call → 153; `.*` before "Command timed out after" (M53) → 152. Wrong fixes reading 150 (M5, M6, M7) have no power on this data; test 14 binds them. Cannot run: `NOT RUN`.
- **G5 cost is linear.** Test 32 (records) and test 22 (command length): 4× the input costs ≤ 6× the CPU, best of 3. Probes (`node $P/gates/gen.mjs <dir> <records> <command length>` then `/usr/bin/time -l`): 100k records → 0.34 s user, 224 MB; 400k → 1.18 s, 472 MB; 100k × 1600-char commands (95 MB) → 0.41 s, 385 MB; 400k × 1600 (381 MB) → 1.48 s, 1015 MB. FAIL reading: the default probe regex in place of `isProbe` (M62) → test 22 red (20k → 4.4 s against 5k → 0.28 s, 16× for 4×). Cannot run: the tests fail, which differs from PASS.
- orchestrator follow-ups: D5 — the round-8 retro names the command in `retro.md` / `retro-workflow.js` and takes the first reading beside the size meter. R4 — after Nov 4 2026, check that the round-6 transcripts are still on disk (`ls -lT $B/eaecdad0*`).

## 6. Worst impact

A hostile or malformed transcript, plans file or subagents tree could make the meter hang, crash, print a path or message text, or print wrong durations without saying so. ⇒ adversarial lane (3a).

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines: the turn counting in `split` (pass-6 fix, graded by `gates/turns.mjs` only), the pass-8 fix lines (`isStopNotice`'s offset, the unknown-call keys in `limitCall`, the relay order in `classify`; graded by `gates/stopsweep.mjs`, `gates/classdiff.mjs` and G4 only) and H2 (no independent oracle) · the hostile corpus (FIFO, link loop, mode 000, `.jsonl` directory, ambiguous prefix, sentinel strings in every field, an over-long line, invalid UTF-8, BOM) · the `enumerate:` rows not pinned as §4 tests (E-origin), only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines:
- a FIFO, a link loop and a mode-000 file under `subagents/` → oracle: the run ends within 10 s and `lanesSkipped` counts each
- every error path with a sentinel in the ticket, session prefix, file names and record fields → oracle: `grep -c <sentinel>` on stdout+stderr is 0 outside ticket names
- a task notification with no known call, with and without the harness's words → oracle: the words' kind, read by hand
- owner text with no origin quoting each of the 5 tags mid-text → oracle: `human`
- 4× the records and 4× the command length → oracle: CPU-time ratio ≤ 6 (cost.md)
- `enumerate: origin.kind over every local transcript (human, peer, task-notification, coordinator; the bundle's switch adds channel, unclassified, observer, observer-activity, plugin, slack-ping) → oracle: the header's rules by hand` (E-origin)

Mutants for 3b (`python3 -I $P/gates/mutants.py $P/sketch` → `$P/gates/mutants.txt`; each row one replacement in `scripts/plantime.mjs`, its red tests by number in the final §4 file):

- `mutant:` M1 ` 'exec-wait', 'other-session-wait', 'idle-for-coordinator' ` → ` 'exec-wait', 'idle-for-coordinator' ` → tests 5
- `mutant:` M2 ` if (WAKE.has(k)) total += cg; else add(fallback, cg); ` → ` if (WAKE.has(k)) total += cg; else add(k, cg); ` → tests 6, 8
- `mutant:` M3 ` carried.push([g, k === DEFER ? 'other' : 'compaction']); ` → ` carried.push([g, 'other']); ` → tests 8
- `mutant:` M4 ` const inside = prev !== null && t0 <= prev && t <= t1; ` → ` const inside = prev !== null && t0 <= t && t <= t1; ` → tests 9, 13, 23, 30
- `mutant:` M5 ` const hit = typeof d.toolUseResult?.timedOutAfterMs === 'number' || (call?.name ` → ` const hit = (call?.name ` → tests 14
- `mutant:` M6 ` const LIMIT_TEXT = /^(?:<error>)?(?: ` → ` const LIMIT_TEXT = /^(?: ` → tests 14
- `mutant:` M7 ` (call?.name === 'Bash' && LIMIT_TEXT.test(text)) ` → ` LIMIT_TEXT.test(text) ` → tests 14
- `mutant:` M8 ` plan\\s+${t}(?![\\w-])[^<]*</command-args> ` → ` plan\\s+${t}[^<]*</command-args> ` → tests 16
- `mutant:` M9 ` if (d.type !== 'user' || d.isSidechain || d.isMeta) continue; ` → ` if (d.type !== 'user' || d.isSidechain) continue; ` → tests 16
- `mutant:` M10 `` const typed = new RegExp(`^\\s*/ `` → `` const typed = new RegExp(`/ `` → tests 16
- `mutant:` M11 ` if (!isIso(brief)) bad( ` → ` if (Number.isNaN(ts(brief))) bad( ` → tests 17
- `mutant:` M12 ` if (hits.length !== 1) throw ` → ` if (hits.length === 0) throw ` → tests 19
- `mutant:` M13 ` if (st.isDirectory()) walk(p); ` → ` if (st.isDirectory()) {} ` → tests 23, 25
- `mutant:` M14 ` if (!s.length || ts(s[0].timestamp) < t0 || ts(s[0].timestamp) > p.brief) continue; ` → ` if (!s.length) continue; ` → tests 23, 25
- `mutant:` M15 ` out.sort((a, b) => ts(a.timestamp) - ts(b.timestamp)); ` → (deleted) → tests 20
- `mutant:` M16 ` if (last !== 'human') { counted = inside; if (counted) waits.push(0); } ` → ` { counted = inside; if (counted) waits.push(0); } ` → tests 13
- `mutant:` M17 ` if (origin !== undefined && !OWNER_ORIGINS.has(origin) && !READ_ORIGINS.has(origin)) return 'external'; ` → (deleted) → tests 2
- `mutant:` M18 ` if (d.isCompactSummary) return 'compaction'; ` → (deleted) → tests 2, 8
- `mutant:` M19 ` if (d.isMeta || ACCOMPANYING_TAGS.test(text)) return DEFER; ` → ` if (d.isMeta) return DEFER; ` → tests 4
- `mutant:` M20 ` if (t0 === undefined) { notRun( ` → ` if (t0 === undefined) { continue; notRun( ` → tests 23
- `mutant:` M21 `` lines.push(`## ${p.ticket}: wall `` → `` lines.push(`## ${p.ticket} ${path}: wall `` → tests 23, 27, 31
- `mutant:` M22 ` counted = inside; ` → ` counted = true; ` → tests 13
- `mutant:` M23 ` if (OWNER_TAGS.test(text)) return 'human'; ` → (deleted) → tests 2
- `mutant:` M24 ` if (origin === 'peer' || has('<agent-message') || ` → ` if ( ` → tests 2
- `mutant:` M25 `   for (const [cg, fallback] of carried) add(fallback, cg);⏎  return ` → `   return ` → tests 7
- `mutant:` M26 ` try { d = JSON.parse(line); } catch { bad++; continue; } ` → ` try { d = JSON.parse(line); } catch { continue; } ` → tests 20, 28
- `mutant:` M27 ` if (call) return call.name === 'Bash' || call.name === 'Monitor' ? 'exec-wait' : 'lane-wait'; ` → ` if (call) return 'lane-wait'; ` → tests 3, 14
- `mutant:` M28 ` if (args[i] === '--json') { json = true; continue; } ` → (deleted) → tests 27, 30
- `mutant:` M29 ` if (origin === undefined && /^\s*\[Request interrupted by user/.test(text)) return 'interrupt'; ` → (deleted) → tests 2, 15
- `mutant:` M30 ` if (name === 'AskUserQuestion') return 'human'; ` → (deleted) → tests 1, 15
- `mutant:` M31 ` if (d.turnOrigin === 'scheduled' || d.origin?.subkind === 'scheduled-trigger' || ` → ` if (d.turnOrigin === 'scheduled' || ` → tests 2
- `mutant:` M32 ` if (has('<cross-session-message') || has('<teammate-message')) return ` → ` if (has('<cross-session-message')) return ` → tests 2
- `mutant:` M33 ` if (/^\s*<[a-zA-Z][\w-]*[\s>]/.test(text)) return 'external'; ` → (deleted) → tests 2
- `mutant:` M34 ` let from = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0; ` → ` let from = 0; ` → tests 20
- `mutant:` M35 `     if (isIso(d.timestamp)) out.push(d); else bad++; ` → `     if (!Number.isNaN(ts(d.timestamp))) out.push(d); else bad++; ` → tests 20
- `mutant:` M36 ` if (seen.has(key)) bad( ` → ` if (false) bad( ` → tests 17
- `mutant:` M37 ` if (!/^[0-9a-f-]{4,}$/.test(session)) bad( ` → ` if (false) bad( ` → tests 17
- `mutant:` M38 ` if (st.isDirectory()) walk(p);⏎      else if (st.isFile() && f.endsWith('.jsonl')) out.push(p); ` → ` if (st.isDirectory()) walk(p);⏎      else if (f.endsWith('.jsonl')) out.push(p); ` → tests HANG
- `mutant:` M39 ` const why = (e) => (e && typeof e.code === 'string' ? e.code : 'unreadable'); ` → ` const why = (e) => String(e?.message); ` → tests 26, 27, 31
- `mutant:` M40 ` [realpathSync(process.argv[1]), resolve(process.argv[1])] ` → ` [process.argv[1]] ` → tests 31
- `mutant:` M41 ` for (const f of raw.trim().split(/\s+/)) { if (f.startsWith('#')) break; if (f) fields.push(f); } ` → ` for (const f of raw.replace(/#.*/, '').trim().split(/\s+/)) { if (f) fields.push(f); } ` → tests 17
- `mutant:` M42 ` const hits = names.filter((f) => f.endsWith('.jsonl') && f.startsWith(prefix) && isFile(join(dir, f))); ` → ` const hits = names.filter((f) => f.endsWith('.jsonl') && f.startsWith(prefix)); ` → tests 19
- `mutant:` M43 `` || (task !== undefined && kinds.get(`task:${task}`)) `` → (deleted) → tests 3, 14
- `mutant:` M44 ``       if (call && typeof task === 'string') kinds.set(`task:${task}`, call);⏎ `` → (deleted) → tests 3, 14
- `mutant:` M45 `   if (OWNER_ORIGINS.has(origin) && !d.isMeta) return 'human'; ` → `   if (OWNER_ORIGINS.has(origin)) return 'human'; ` → tests 2, 4
- `mutant:` M46 `  || /^\s*<tick[\s>]/.test(text)) return 'scheduled'; ` → ` ) return 'scheduled'; ` → tests 2
- `mutant:` M47 ` return d.isSidechain ? 'idle-for-coordinator' : 'human'; ` → ` return 'human'; ` → tests 2
- `mutant:` M48 ` return mo >= 1 && mo <= 12 && d >= 1 && d <= days && h < 24 ` → ` return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h < 24 ` → tests 17, 18, 20
- `mutant:` M50 ` [realpathSync(process.argv[1]), resolve(process.argv[1])] ` → ` [realpathSync(process.argv[1])] ` → tests 31
- `mutant:` M51 ``   try { readdirSync(dir); } catch (e) { throw new Error(`transcripts dir not readable: ${why(e)}`); }⏎  const lines = []; `` → `   const lines = []; ` → tests 26, 31
- `mutant:` M52 `  || /^\s*<remote-review[\w-]*[\s>]/.test(text)) return 'lane-wait'; ` → ` ) return 'lane-wait'; ` → tests 2
- `mutant:` M53 ` (?:Exit code \d+\n)?Command timed out after ` → ` (?:Exit code \d+\n)?.*Command timed out after ` → tests 14
- `mutant:` M54 `   if (OWNER_ORIGINS.has(origin) && !d.isMeta) return 'human';⏎  if (d.turnOrigin ` → `   if (d.turnOrigin ` → tests 2, 14
- `mutant:` M55 ` const has = (tag) => (READ_ORIGINS.has(origin) ? text.includes(tag) : text.trimStart().startsWith(tag)); ` → ` const has = (tag) => text.includes(tag); ` → tests 2
- `mutant:` M56 ` const has = (tag) => (READ_ORIGINS.has(origin) ? text.includes(tag) : text.trimStart().startsWith(tag)); ` → ` const has = (tag) => text.trimStart().startsWith(tag); ` → tests 2
- `mutant:` M57 `   return BACKGROUND_TEXT.test(text) ? 'exec-wait' : 'lane-wait'; ` → `   return 'lane-wait'; ` → tests 3, 14
- `mutant:` M58 ` if (call) return call.name === 'Bash' ` → ` if (false) return call.name === 'Bash' ` → tests 3
- `mutant:` M59 ` if (k === 'human' && t0 < t && t <= t1) { ` → ` if (k === 'human' && t0 <= t && t <= t1) { ` → tests 11
- `mutant:` M60 `     if (isIso(d.timestamp)) out.push(d); else bad++; ` → `     if (isIso(d.timestamp)) out.push(d); ` → tests 20, 28
- `mutant:` M61 `   return { median: s.length ? s[Math.floor((s.length - 1) / 2)] : 0, max: s.length ? s[s.length - 1] : 0 }; ` → `   return { median: s.length ? s[Math.floor((s.length - 1) / 2)] : 0, max: Math.max(0, ...s) }; ` → tests 12
- `mutant:` M62 ` if (rx.probe.source === DEFAULTS.probe ? isProbe(c) : rx.probe.test(c)) ` → ` if (rx.probe.test(c)) ` → tests HANG
- `mutant:` M63 ` if (rx.probe.source === DEFAULTS.probe ? isProbe(c) : rx.probe.test(c)) ` → ` if (isProbe(c)) ` → tests 21
- `mutant:` M65 ` if (py && seg.indexOf('.py', py.index + py[0].length) >= 0) return true; ` → ` if (py && seg.indexOf('.py') >= 0) return true; ` → tests 21
- `mutant:` M66 ` for (const seg of c.split(/[|;&]/)) { ` → ` for (const seg of [c]) { ` → tests 21
- `mutant:` M67 ` if (/\bpython3? -c|\bnode -e/.test(seg)) return true; ` → (deleted) → tests 21
- `mutant:` M68 `       unread += lb;⏎ ` → (deleted) → tests 28
- `mutant:` M69 ` const has = (tag) => (READ_ORIGINS.has(origin) ? ` → ` const has = (tag) => (origin !== undefined ? ` → tests 2
- `mutant:` M70 `     let n = 0, limited = m.limited, unread = bad; ` → `     let n = 0, limited = m.limited, unread = 0; ` → tests 28
- `mutant:` M71 ` if (origin === undefined && /^\s*\[Request ` → ` if (/^\s*\[Request ` → tests 2
- `mutant:` M72 `       if (!s.length && lb) { skipped++; continue; } // nothing readable: its window cannot be known⏎ ` → (deleted) → tests 28
- `mutant:` M73 `     if (t0 <= t && t <= t1) {⏎      const call = limitCall(d, k, kinds); ` → `     if (true) {⏎      const call = limitCall(d, k, kinds); ` → tests 14
- `mutant:` M74 ` if (call && !limitedCalls.has(call)) { limitedCalls.add(call); limited++; } ` → ` if (call) limited++; ` → tests 14
- `mutant:` M75 `   if (k !== 'exec-wait' || !isStopNotice(text)) return null; ` → `   return null; ` → tests 14
- `mutant:` M76 ` if (k !== 'exec-wait' || !isStopNotice(text)) ` → ` if (!isStopNotice(text)) ` → tests 14
- `mutant:` M77 `` return noticeCall(text, kinds) ?? (id !== undefined ? `id:${id}` : task !== undefined ? `task:${task}` : {}); `` → ` return noticeCall(text, kinds) ?? {}; ` → tests 14
- `mutant:` M78 `` return hit ? call ?? `id:${r.tool_use_id}` : null; `` → `` return hit ? `id:${r.tool_use_id}` : null; `` → tests 14
- `mutant:` M79 ` return i >= 0 && text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length) >= 0; ` → ` return /<summary>Background command "[\s\S]*" was stopped after reaching its background time limit<\/summary>/.test(text); ` → tests HANG
- `mutant:` M80 ` && b.id !== undefined && !kinds.has(b.id)) kinds.set( ` → ` && b.id !== undefined) kinds.set( ` → tests 14
- `mutant:` M81 `   if (has('<cross-session-message') || has('<teammate-message')) return 'other-session-wait';⏎  if (has('<task-notification>')) return noticeKind(text, kinds); ` → `   if (has('<task-notification>')) return noticeKind(text, kinds);⏎  if (has('<cross-session-message') || has('<teammate-message')) return 'other-session-wait'; ` → tests 14
- `mutant:` M82 ` return i >= 0 && text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length) >= 0; ` → ` return i >= 0; ` → tests 14
- `mutant:` M83 `   if (origin === 'task-notification' || (origin === undefined && has('<task-notification>'))) return noticeKind(text, kinds);⏎ ` → (deleted) → tests 14
- `mutant:` M84 ` text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length) ` → ` text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length - 1) ` → tests 14
- `mutant:` M85 `` return hit ? call ?? `id:${r.tool_use_id}` : null; `` → ` return hit ? call ?? {} : null; ` → tests 14 (re-run alone after test 14 gained its case)
- M49 and M64: equivalent mutants, no input tells them apart (reasons in `gates/mutants.py`); not run.

83 of 83 red (80 by a failing test, M38, M62, M79 by a hang past 180 s, which the runner counts red); `⏎` is a newline in the patch. Red sets from `gates/mutants.txt`; M85's from a run alone after test 14 gained the case that catches it.

## 8. Out of scope

- Naming the command in the retro's text, and the first reading: the round-8 retro (D5).
- A true ask-round count: needs the marker skills-hekn adds (D2); noted for skills-lxpq.
- A per-plan reading written at each plan ending (Q1 option 3, not chosen).
- The old meters in bigbrain stay as they are.
- Out-of-diff review findings: ticket.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
| W0 | 2026-10-18 | default | base | `e93e92e` → `0057d3f` | `git diff --name-only e93e92e 0057d3f` touches only `.beans/` and this brief's folder, none of the sketch or §4 files; reds not re-run (not needed). The run's tests commit read the predicted red set: 30 red, all ERR_ASSERTION; guards 27, 29 green. |
| R5 | 2026-10-18 | the owner ("Go with reco") | §2, §3, §4 | the sketch as is → review round 1 fixes every wave-1 finding except two declined (a year-0000 date: Date.UTC maps years 0–99 to 1900+, and no harness writes that year; the 16 MB `isProbe` memory figure in What the planner saw: 600 MB, not 335 MB, an observation only), each with a test red on the pre-fix source, the header and the false claims corrected, the 9 header rules with no binding test given one, real-data readings checked unchanged, then a fresh review lane and the gate | Wave-1 review (an adversarial lane and a code-review lane on the meter as briefed) found a crash on a Bash command that is not text and on text nested 5000+ deep (the whole run lost), a hang on a plans file that is a device, and wrong counts: a start-time turn crossing the start through an accompanying record, harness words read inside a lane's own result, notices quoted by peer or coordinator records, a quoted plan command opening the window, directory links neither counted nor refused, a lane lost to one stray early record, five time-limit key shapes. |
| R6 | 2026-10-18 | the owner ("Go") | §3 (header, error rows), §4 | the meter as briefed (85ae60e) → review round 1 (4a5dc6a tests, db0d4eb fix): non-text commands and message text read safely; a plan that fails reads `NOT RUN (could not be measured: <error name>)`; new error rows `plans file not readable: not a file or pipe`, `plans file holds no plan`, `session transcript not readable: <code>` for a transcript that cannot be opened, and ` (records not read: N)` after `no plan command`; a pipe empty for 10 s is refused; an owner wait starts at the last record that is not a reminder, meta or compaction record (or the file's first record); notices are read one by one, before `<result>` only; task ids have their own map; only an owner-given command opens the window; directory links and a linked session folder are counted as skipped; a lane counts when any of its records is in the window; test 25 skips 5, not 4 | Each change fixes one R5 finding, with a test red on 85ae60e. Rounds 6 and 7 read byte-identical to 85ae60e; 0 of 135,951 records change class. |
| R7 | 2026-10-18 | the owner ("Go") | §5 G2 | `… crosstab.py $O6 $B $P/gates/plans-r6.txt scripts/plantime.mjs` → `… $PWD/scripts/plantime.mjs` (both rounds) | `crosstab.py` hands the path to `import()`, which reads a relative path as a package name: ERR_MODULE_NOT_FOUND, so G2 could not run as written. With the absolute path, as G4 has it: PASS and PASS on 85ae60e and on db0d4eb. |
| D9 | 2026-10-18 | default | §2 time-limit hits | — → a call moved to the background whose result names no task id, then stopped by a notice naming only that task id, counts twice | The two records share no id. Every real moved result names its task in `(ID: …)` (146 of 146 local), so the case is unreachable with the harness as it is. |
| D10 | 2026-10-18 | default | gate tools | `gates/turns.mjs` and `gates/stopsweep.mjs` restating the old wait-start and stop-notice rules → restating R6's | With the old rules `turns.mjs` could not see the owner-wait bug. Now on db0d4eb: 0 differ and 0 of 19,608; on 85ae60e: 42 differ and 1,128. |
| R8 | 2026-10-18 | the owner ("Go") | §3 (header), §4 | review round 1 (db0d4eb) → review round 2 (5bd4db5 tests, 2bb0014 fix): a notice is read in order up to its summary's end (the first `</summary>` followed by `<note>`, `<result>`, `<usage>`, `</task-notification>` or the end), and a further notice only right after a closed one, never inside a lane's `<result>`; a notice's ids only before its `<summary>`; a result whose call id is not text is a call of its own; a named pipe waits for a writer that opens late and is refused only after 10 s with nothing read (`plans file not readable: nothing read in 10 s`); the header says `<(…)` on macOS is read until its command ends | The fresh review lane on db0d4eb found: a lane's result quoting a stop notice counted a hit; a stop notice whose command holds `<result>` or the notice tags was missed; a nested non-string call id lost the plan; a late-opening pipe writer read "holds no plan". Each has a test red on db0d4eb. Rounds 6 and 7 read byte-identical to db0d4eb; 0 of 90,855 records change class. |
| R9 | 2026-10-18 | the owner ("I'd rather update them than leave outdated code that might stir further work in the wrong direction") | §5 G1, G3 tools | `gates/oracle.py` and `gates/g3.py` opening the window at any `plan <ticket>` record and counting a lane by its first record; `g3.py` reading notices by any tag anywhere → both open the window at the first owner-given command at or before the brief time and count a lane with any record in the window, links not followed; `g3.py` reads notices by R6's origin rule and the opening words of the summary; `gates/wrongfix.py` W4 re-pointed at `tasksOf` (ad2b0b4) | The tools restated the pre-R6 rules. On round 2 (2bb0014): G1 PASS 6/6, 7/7; G3 PASS 6/6, 7/7; FAIL readings as §5 records (W1–W3 FAIL 1/7 on round 7, W4 and W5 PASS 7/7; M4 FAIL 6/6, 7/7). On a synthetic session (a quoted opener, a lane opening before the window): the updated tools PASS round 2 and FAIL 85ae60e; the old G3 tool read the reverse. |
| D11 | 2026-10-18 | default | §2 time-limit hits | — → a command whose text holds `</summary>` directly followed by `<note>`, `<result>`, `<usage>` or `</task-notification>` ends its notice's summary early, so a completed command quoting the stop words that way would count a hit | No harness tag follows `</summary>` inside a real command; the case needs that exact tag pair quoted in the command. |

unruled: D8 — default accept (two records in one millisecond keep file order)
