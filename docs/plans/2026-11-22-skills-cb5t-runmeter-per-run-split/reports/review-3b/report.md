# 3b code review: skills-cb5t (runmeter parts), run tree head 98e8d47 vs base 1f961fb

I found no real bugs. The three mutants each turn exactly the expected test red. My fuzzing turned up no broken sum, no crash and no new error surface. I have four low-severity prose findings, all in `scripts/runmeter.md`. None of them makes a §3 invariant false.

Scratch dir: `<session scratchpad>/cb5t-3b`. It holds copies `ctl/`, `m1/`, `m2/` and `m3/` of the run tree's `scripts/`, and the probe scripts in `probe/`. I wrote nothing to the repository and changed no git state.

## Control reading (unpatched copy `ctl/scripts`)
`cd ctl && node --test --test-reporter=spec scripts/test/runmeter.test.mjs`
```
ℹ tests 63
ℹ pass 63
ℹ fail 0
```

## Mutants
Each was applied by an exact string replace in its own copy. `diff` against the run tree confirms the change is one line.

| mutant | applied | ℹ tests / pass / fail | failing test | expected |
|---|---|---|---|---|
| m1: in `parts()`, delete the `firstPart` line (runmeter.mjs:313) | line deleted as given | 63 / 62 / 1 | `parts: a turn that runs into a command counts in the command's part; a message seen before a command stays in its first part` (T4) | T4, fail 1: **met** |
| m2: in `cuts()`, make `isMeta` records cut too (runmeter.mjs:169) | `if ((classify(d, kinds, PLANTIME_RX) === 'human' \|\| d.isMeta) && SKILL_COMMAND…` (the extra opening parenthesis was added before `classify`) | 63 / 62 / 1 | `parts: only a skill command the owner typed cuts; a built-in, a model-invoked skill and typed text do not` (T3) | T3, fail 1: **met** |
| m3: in `parts()`, drop every empty part (runmeter.mjs:323) | `if (p === 0 && !u.messages` → `if (!u.messages` | 63 / 62 / 1 | `parts: two commands in one turn, and commands at one instant, each keep their part; a lane ending at a command's instant does not cross it` (T7) | T7, fail 1: **met** |

## Findings
All four are low severity and concern the doc only. The code follows the brief and the rulings in every case.

**F1. The Minutes paragraph says part minutes can only add up to less than the session's. Rounding can make them add up to more.**
- Where: `scripts/runmeter.md:274` says "…so a session's part minutes can add up to less than its own." The code at `scripts/runmeter.mjs:329` rounds each part to one decimal on its own (`minutes(hi - lo)`).
- Brief D8 says "parts' minutes can sum below the session's". The doc never says they can also sum above it.
- Reproduction: `node probe/docs.mjs`, case (3). Two commands at 0 s and 3 s, with records at 0, 3, 3 and 6 s.
  ```
  (3) session minutes 0.1 · part minutes [0.1,0.1] · sum 0.2
  ```
- Each part lasts 3 s (0.05 min) and rounds up to 0.1. The session lasts 6 s and rounds to 0.1. With n parts, the sum can exceed the session's by up to about 0.05·n minutes. Minutes are outside the §3 sum invariant, so this is a doc gap, not a contract break.

**F2. The Parts bullet says a part "prints that label". In text, a session of one part prints no part line, so no part label appears.**
- Where: `scripts/runmeter.md:250` says "With `--labels`, a part opened by a command that gives a label prints that label." This follows D5 (part lines only for two parts or more, `sessionLines` in runmeter.mjs).
- Reproduction: `node probe/label1.mjs`. The command is on day D and the window is `--since E`, so only part 1 falls inside it.
  ```
  JSON session label null · parts [[1,"plan t-0001"]]
  text: ["## aaaaaaaa 2026-11-02 · 1m · orchestrator claude-opus-5-5 · effort ? · messages 1 · owner turns 1 · lanes 1 · orchestrator tokens in 1 out 2 cache-write 3 cache-read 4 · lane tokens in 1 out 2 cache-write 3 cache-read 4"]
  ```
- So the label shows only in JSON. The header comment at runmeter.mjs:5 and the intro at runmeter.md:11 say the same thing as F2's sentence, with the same gap in text output.

**F3. The Session label section now covers parts, but its "next skill command is then tried" fallback applies only to sessions.**
- Where: `scripts/runmeter.md:280` now says "A label says which command opened the session, or a part of it". The bullets under it (`:295`, "…that command gives no label. The next skill command is then tried.") describe only the session label. A part's label comes from its own command, with no fallback (`runmeter.mjs:328`).
- Reproduction: `node probe/label2.mjs`. The first command has `"quoted" words` as arguments, the second `run t-2`.
  ```
  session label "run t-2" · parts [[1,null],[2,"run t-2"]]
  ```
- The code matches the Parts section (line 250). The Session label section, which now says it covers parts too, reads as if part 1 would fall back to `run t-2`.

**F4. Privacy rule 3 mixes plural and singular.**
- Where: `scripts/runmeter.md:440` says "The labels of sessions and parts are the one exception to rule 1. It is printed only with `--labels`. It is two words at most…". "It" refers back to the plural "labels".
- Reading: `grep -n "one exception to rule 1" scripts/runmeter.md` prints that line, as quoted.

## Checks that held, each with its executed reading
- **§3 invariants, fuzzed** (`node probe/fuzz.mjs <run scripts> <base scripts> 1500 7`; `fuzz2.mjs` is the same with the text checks added):
  - Input: 1500 random synthetic sessions over 18 record kinds. They include same-instant records and day changes, commands without an origin, unlabelled commands, repeated message ids, records with no id, synthetic records, bad lines and untimed records. Some files are reversed. Each session has 1–4 lanes, some unreadable, some crossing a command or a day.
  - Every window was tried: none, each day as `--since`, as `--until`, and as both.
  - Each window is checked for: parts' ownerTurns, messages, lanes and all 8 token fields summing to the session's; no label without `--labels`; turns never negative, parts in order; every command inside the window opening a kept part; every lane's part listed; each lane's part and `crossesCommand` against an independent time oracle (Q1, D10); every other JSON field equal to the base runmeter's; no `SECRET` in the output; a label with `--labels` always being 1–2 plain words.
  - Reading: `one-part windows 4188 · multi-part windows 4749 · sessions 1500 · windows checked 8937 · crashes 0 · failures 0`.
  - The fuzz has power. Run on 300 sessions against the mutants: m1 gives 293 failures (`sum messages`), m2 gives 510 (`lane placement`), m3 gives 530 (`command part dropped`).
- **D1/D2 placement against an independent oracle** (`node probe/oracle.mjs <run scripts> 5000`): it calls `cuts`, `owner` and `parts` directly on random sequences. These mix owner text, commands, messages, repeated ids, meta records, built-ins, compaction summaries, interrupts and synthetic records. The oracle computes turns per part (each turn in the part of its last owner record) and messages per part (each in the part of its first record). Reading: `sequences 5000 · mismatches 0`.
- **One-part sessions print as before** (D5, A7): in fuzz2, text in the 4188 one-part windows equals the base's, the crossing line aside. In the 4749 multi-part windows, removing the part lines gives back the base's text, and the count of lane lines equals the count of lanes. `docs.mjs` case (4): `one part, text identical to base: true`.
- **The doc's example part line** (runmeter.md:255) equals the output on a T1-shaped session with `--labels` (`docs.mjs` case 1, byte-identical).
- **JSON `day`, "the day of its first lane when it has no record"**: `docs.mjs` case (2) gives `[[0,"2026-11-02",0,0,1],[1,"2026-11-02",1,1,0]]`. Part 0's day is the lane's, and its minutes are 0.
- **A lane crossing a command that lies outside the window**: `docs.mjs` case (5). The session prints as one part and the totals print `lanes that end under a later command: 1`. This agrees with the doc's totals row and with D9.
- **No new error surface** (`node probe/errs.mjs`, run-tree CLI against base CLI, 12 malformed inputs × 5 flag sets): an empty session file, or one with only bad lines; missing or invalid timestamps; an empty lane file, a lane with only untimed records, every lane unreadable; records out of order with UTC offsets; duplicate command lines and message ids; odd content shapes (an array with null or number entries, `message: null`, content as an object, message as a string, a numeric id); a window that excludes every command; a lane earlier than every session record; a tool_result and command text in one record. Every one of the 60 runs: exit code equal to the base's (all 0), stderr empty on both, and the rest of the output equal to the base's once the part lines and the crossing line are removed (JSON: the 4 new keys).
- **The `--labels` privacy rule for part labels**: in fuzz, no label without `--labels`, and with it every label matched `^[A-Za-z0-9._-]{1,24}( …)?$`. That held even with `"SECRET" /etc/passwd` and `plan t-N SECRET` as arguments. No `SECRET` ever appeared in JSON or text.
- **Prose read against the runs**: the Parts section's bullets (cut set, numbering, message and turn placement, lane placement, crossing at the instant, kept parts, sums, "Part 0 never has one") match the code, as shown by the oracle, the fuzz and T3/T7. The JSON table and the window paragraph match (T6, the fuzz windows). The Minutes sentence on time between parts is true but incomplete on rounding (F1). Limits: "a run started with typed text has no part of its own" holds (T3, oracle). Header comment, intro, Session label, Privacy rule 3: see F2–F4.

## NOT RUN
- Limits sentence "A run resumed in a new session file, or after `/clear`, is a part of that new session". Checking whether `/clear` starts a new file needs real transcripts, which this lane may not read.
- Behaviour on real transcripts, and the gates R2 (`gate/parts-sum.mjs`) and A1/A3: these are other lanes', and they need real data.
- Lint and the full `scripts/test/*.test.mjs` suite: outside the 3b cell.
