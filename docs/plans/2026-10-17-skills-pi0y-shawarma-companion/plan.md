# skills-pi0y — shawarma companion mod: live plan/run row and pane

Ticket `skills-pi0y` (no folded siblings) · authority: the ticket's owner rulings 1–3 (2026-10-16), design-interview rulings R1–R4 and DEFAULT D1 (2026-10-16), plan rulings R5–R6 (2026-10-17), all on the ticket · planned 2026-10-17 (claude-opus-5-5; skill shawarma 0.7.0) at base `efbca68 chore(beans): pi0y design interview R1–R4, plan paused on 2 questions; hekn opened` · proposed branch `feat/pi0y-shawarma-companion` in `.worktrees/pi0y`, PR + squash merge. Lessons read: none — this repo has no `docs/plans/lessons.md` and no `docs/plans/README.md` (`ls docs/plans` → `primer-evals`), so the skill's defaults apply.

**Blocked by `skills-hekn`.** The mod reads a marker file and a decisions file that the shawarma skill does not write yet. skills-hekn adds those writes at the round-8 retro. `run` waits for skills-hekn to merge (R4). The mod is built and tested against hand-made files, so nothing in this brief depends on hekn's wording beyond the formats in §3.

## 1. What (the goal, measured)

A Claude Code mod that shows, while a shawarma plan or run is active: which ticket, which step, and how many decisions so far. It draws one row above the prompt and offers a pane with the recap, the decisions, the amendments and the predicted red set.

Evidence that the surfaces exist and what they allow, from the mod API types of Claude Code 2.1.301 (`claude-code.d.ts`, written by the bundled plugin-authoring skill; called **T** below):
- There is no banner at the top of the window. The row above the prompt is the `AbovePrompt` band, raised on the terminal and desktop surfaces only (T:10616, T:10665). VS Code draws no mod surface (T:3955).
- `$.fs.read` reads any path, up to 4 MiB (T:3311). `$.session.usage().startedAt` gives the session start (T:2897).

What is missing today: nothing shows plan progress or decisions. The research on 2026-10-16 (ticket, "Why") found no mod or status line that does. Path and context use are already covered by claude-hud and ccstatusline, so this mod leaves them out, except an optional context field (ticket, "The mod").

Terms used below:
- **marker**: the file `<tree root>/.shawarma/active` (§3, 3a).
- **plan dir**: the folder named on the marker's first line; it holds `plan.md` and `decisions.md`.
- **row**: the one line the mod draws in the `AbovePrompt` band.
- **own write**: a change of the marker seen across a Write or Edit tool call of this session whose `file_path` is the marker (R6). For a Write, the file must then hold exactly the text the Write sent. The record keeps the path, the modification time and the text.
- **check**: the 15-second stat of the drawn marker (R5).

## 2. The design

Whole-file sketches sit beside this brief in `sketch/`: `sketch/mods/shawarma-companion/` (every file of the mod), `sketch/marketplace.diff` and `sketch/marketplace.test.mjs`. All of them are `EXECUTED (inputs: the rows of the Partition table below; 39 mod tests, 2 marketplace tests)`. Copy them as they are; §3 freezes their shapes.

How it works, in order:

1. **Find the marker.** Two candidates, in this order: the marker path a Write/Edit of this session named (`known`), then `<git toplevel of the cwd>/.shawarma/active`. The git toplevel is read once per cwd with `git rev-parse --show-toplevel` and kept in a Map. The first candidate that exists wins.
2. **Read it.** `parseMarker` (2a) needs exactly two lines after trimming: the plan dir, then a step starting `plan ` or `run ` and a non-space. Anything else is malformed, and the row reads only `shawarma: <marker path> is malformed`.
3. **Read the plan dir.** The title is `plan.md`'s first line without `# `, else the plan dir's name. `decisions.md` is counted by `parseDecisions` (2b). A missing `plan.md` or `decisions.md` is normal (the plan is early). A missing plan dir adds `plan dir not found: <dir>` to the row.
4. **Label it.** The marker's modification time decides the label (2c):
   - older than the session start → `earlier session: `, dimmed;
   - newer, and an own write with the same modification time and text → no label;
   - newer, and not an own write → `unconfirmed: `, dimmed. The word means "this session did not see itself write it". It is true whether another session wrote the marker or this session wrote it some other way (R6).
5. **Draw the row** (2d): `[label]<title> · <step> · since <HH:MM> · <r> ruled, <d> default`, then `· <n> unreadable in decisions.md`, `· <problem>`, `· ctx <p>%` when they apply. The time gets a `MM-DD ` prefix when it is not today. The row never exceeds `bodyColumns`: the title is cut first, then the line ends in `…`. Control characters become spaces, because the engine refuses a tree holding one (L6).
6. **Refresh** (R5, 2e): after every Write, Edit, NotebookEdit or Bash call, at `turn.complete`, and at `session.start`. While a row is drawn and the band setting is on, a check runs every 15 s. It stats the drawn marker and re-reads everything only when the marker is gone or its modification time changed. A stale row therefore lasts at most 15 s while the session is idle. A settings change re-registers the module and may not fire `session.start` (T:9706 says only that `register` runs again), so the band's render hook also starts the check when a row is drawn and none runs. `ui.render` fires on every plugin load (T:4071).
7. **Pane.** `/shawarma-companion` opens it, and so does a press on the row when the pane setting is on. It shows the title and step, §1 of `plan.md` (or "No brief yet"), the lines of `decisions.md` (or "None recorded"), §9 and the `Predicted red set` line of §4.
8. **Settings** (`userConfig`): `band` (default on), `pane` (default on), `context` (default off).

Rejected options: a top banner (no such surface, ticket "Why"); the mod injecting the method text (R1); one marker in the main checkout, or one inside `.git` (R2); a row with no time or label (R3); the method change in this PR (R4); the ticket's "no timer" refresh (R5, option 3); the `other session:` label and the Bash rule (R6, option 2); a session id in the marker (R6, option 3).

**Sources** (plan step 1):

| sentence (§ · label) | source | verbatim quote | attack-lane re-read |
|---|---|---|---|
| §1 · no top banner; band on terminal and desktop only | T:10616 @2.1.301 | "Raised on the terminal and desktop surfaces only." | verified (pass 1, T:10665-10720) |
| §1 · VS Code draws nothing | T:3955 @2.1.301 | "Claude Code for VS Code attaches no surface yet, so no `ui.render` names `vscode` today." | verified (pass 1) |
| §1, 3 · read limit | T:3311 @2.1.301 | "Rejects when missing, or over 4 MiB" | verified (pass 1) |
| §2 step 4 · session start for the label | T:2897 @2.1.301 | "const isOlder = stat.mtimeMs < (await $.session.usage()).startedAt" | verified (pass 1; also T:12202) |
| §2 step 1 · cwd and root | T:2826 @2.1.301 | "Returns the directory the session runs in, absolute." | verified (pass 1); L8a: a foreground `cd` moves it one call late |
| §2 step 8 · defaults filled | T:7812 @2.1.301 | "the fields its manifest's `userConfig` declares, defaults filled in." | verified (pass 1) |
| §2 step 6 · timer | T:3539 @2.1.301 | "Calls `fn` every `ms` milliseconds (at least 1) until `cancel()`." | verified (pass 2); it goes on "a refused period ends the interval" |
| §2 step 6 · a stopped timer stays stopped | T:13254 @2.1.301 | "Stops it; a stopped timer never fires again." | verified (pass 2) |
| §2 step 6 · reload cancels timers | T:3506 @2.1.301 | "a hot reload of the plugin cancels its pending waits with the old environment." | verified (pass 2) |
| §2 step 6 · session.start on reload | T:4440 @2.1.301 | "A later one runs its hooks alone: an enable, a worker respawn, or a reload (changed modules only…)" | verified (pass 2) |
| §2 step 6 · settings change | T:9706 @2.1.301 | "a change to them reloads the plugin and `register` runs again with the new object." | verified (pass 2); silent on `session.start` |
| §2 step 6 · render on load | T:4071 @2.1.301 | "once per input value (props, viewport width), plugin load or `$.ui.invalidate(\"ui.render\")`." | planner read; not re-read by the lane |
| §4 · the test clock | T:16161 @2.1.301 | "moves only when the test moves it: `clock.now` reads it, and each wait is held" | verified (pass 2) |
| §3 2c · built-in tools | T:17001 (Edit), T:17125 (NotebookEdit) @2.1.301 | — (`grep MultiEdit` over T finds nothing) | lane pass 2 finding; MultiEdit dropped |
| §3 3f · engine writes types into a loaded mod folder | plugin-authoring SKILL.md @2.1.301, "WHERE THE TYPES ARE" | "`<mod folder>/.claude-plugin/types/` holds the same for the editor" | not re-read by the lane; the `.gitignore` probe below executed it |
| R4 · skill changes only at a retro | `skills/shawarma/retro.md:3` @0.7.0 | "This skill changes only at a retro" | verified (pass 1) |

**Partition** (spike q2), per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| marker text (2a) | the skill (hekn), by hand, a crash mid-write | L1: 17 texts — empty, one line, CRLF, padded, 3 lines, absolute, trailing `/`, empty dir, wrong verb, upper case, U+0009, U+00A0, BOM | matches the expected table after the two fixes listed under Attack readings |
| marker place (step 1) | Write/Edit path; cwd's git root; worktree | tests "worktree marker written by path wins over the cwd", "a Write of a relative marker path is this session's" | green |
| decisions.md line (2b) | the skill (hekn), by hand | L2: 11 lines — empty, blanks, 4 fields both labels, lower case, 3 fields, 5 fields, leading pipe, `\|` in text, CR, header | 5 fields and `\|` in text count as decisions (DEFAULT: a `\|` inside a decision is allowed) |
| plan.md (step 3) | the skill (brief template), missing early on | L6: over 4 MiB, ESC in title, no §1; L7 a–d | over 4 MiB → nothing drawn; ESC → cleaned (was refused) |
| label (2c) | own Write/Edit; NotebookEdit; Bash; script; other process before/after start; another writer inside or right after an own Write | L10, L13 | expected table matched every row (after the L13 fix) |
| timing (2e) | tool calls; turn end; idle; other writer; reload | L9, L11, L12 | L9 0 violations; L11 within 3e; L12 NOT RUN |
| row width (2d) | `bodyColumns` 0–200 | L3: 189 combinations | no length violation |
| settings | `userConfig`, none given | tests "band off", "pane off", "no options given", "context on" | green |
| surface | terminal, desktop | test "desktop surface draws the row" | green |

**Attack readings** (one per §7 line; pass 1 ran on the first sketch, pass 2 on the re-spiked one):

- L1 → two fixes: `'d\nrun W0\nextra'` was accepted (now malformed, test "parseMarker: exactly two lines, trailing slashes dropped"); `'d/\nrun W1'` drew no title (trailing `/` now dropped, same test). Rest matched.
- L2 → `'a | RULING | b | c | d'` and `'a | RULING | b|c | d'` count as decisions. Kept: DEFAULT, a `|` inside a decision's text is allowed (ticket, plan pause note).
- L3 → 189 combinations: no row longer than its columns; the step is never cut while the untitled line fits. The malformed line carries no label, as the contract says it is shown alone (row "problem only" in 2d).
- L4 → 200 Bash calls in one cwd: `process.run` once in total; with a marker, 10 fs calls per tool call. Bound in §3 3e.
- L5 → (a) rm then Write: label correct each step. (b) another writer replaced the marker: stale until the next call — led to R5. (b2) a Bash call naming `.shawarma/` drew another writer's plan unlabelled — led to R6. (c) 60 own writes: still unlabelled. (d) NOT RUN (the kit has no reload call); see L12.
- L6 → plan dir `../../..` draws `..`, `/etc` draws `etc` (DEFAULT: a plan dir outside the repo shows its name; reads only). Over 4 MiB: nothing drawn. ESC: the engine refused the tree (`ui.render (AbovePrompt) refused: a text child holds a control character`) — fixed with `clean` (test "control characters in the title are not drawn"). 10,000 decision rows: 19 ms. A relative Write path was labelled as another session's — fixed (test "a Write of a relative marker path is this session's").
- L7 → pane (a)–(d) drawn, nothing refused; 1,000 decision lines → 33,989 characters of Markdown.
- L8 → real engine (`claude -p --plugin-dir` probe, debug log): (a) cwd follows a foreground `cd` one call late; (b) `clockTime` matches `date +%H:%M` (local zone); (c) `$.fs.read` reads outside the session root.
- L9 → 584 sequences from each of two starting states (empty tree; after one own Write), 1,168 in all: 0 violations (`claude-personal plugin test lane2` → 1218 pass, 0 fail). The oracle has power: with `CHECK_MS = 16_000` it reports 20 violations, e.g. `S0 W,X,T15 => "… run W1 …" | stale`. Its first run reported 114 violations, all from an oracle bug (events ordered by clock time instead of index), fixed before the final run. 110 cases draw nothing while a marker exists: another writer's marker landing while no row is drawn waits for the next tool call or turn end. That is the allowed failure (shows less), with no time bound. Holds on the fixed sketch: planner re-run → 1219 pass, 0 fail.
- L10 → Write absolute, Write relative, Edit: no label. NotebookEdit, Bash echo, Bash script, another process after start: `unconfirmed: `. Before start: `earlier session: `. Matched the table written beforehand. Finding: `MultiEdit` is not a tool in 2.1.301 (dropped from the sketch). Pinned by tests 2, 3, 4, 5, 17.
- L11 → row drawn, marker unchanged: exists/stat/read/run/cwd = `1/1/0/0/0` in each of 240 periods. Band off, or no marker: `0/0/0/0/0` ×240. Marker deleted by another writer: `3/0/0/0/1` once, then `0/0/0/0/0` ×19. A probe whose timer first stats `/__tick` fired 0 times in the 5 minutes after the row went; the never-cancel mutant fired 20 times. Pinned by tests 24, 37, 38.
- L12 → NOT RUN: the test kit has no reload call (TestOptions holds only `plugins`, `timeoutMs`, `options`). From the sources: a reload cancels the timer (T:3506), `session.start` fires on a module reload (T:4440) and restarts it; a settings change is not said to fire `session.start` (T:9706). Changed the sketch: the band's render hook now starts the check (2e). Mutant M31 (that line removed) survives for the same reason.
- L13 → on the re-spiked sketch, two violations: another writer replacing the marker inside this session's Write (later mtime) drew `skills-x — the thing · run OTHER · …` unlabelled; a replacement after the call with the same mtime (a coarse file clock) drew the same, unlabelled. Changed the sketch: an own write now needs the Write's text to match the file, and records the text (2c). On the fixed sketch both read `unconfirmed: skills-x — the thing · run OTHER · …`. Pinned by tests 18, 19.

**What the planner saw:**
- The ticket's row shape was `<n> decisions · <k> unruled`. The sketch draws `<r> ruled, <d> default`. Same two numbers: in shawarma, a DEFAULT is a decision nobody ruled. The words match decisions.md's labels. DEFAULT.
- The ticket said "missing files show a short line naming the file". A missing plan.md or decisions.md is the normal state early in a plan, so only a malformed marker or a missing plan dir draws a problem line. DEFAULT (plan pause note).
- `claude plugin validate .` passes even when a marketplace entry's `source` names a folder that does not exist (executed: source `./mods/shawarma-companio` → `✔ Validation passed`). Test 40 pins it instead.
- The engine writes `.claude-plugin/types/` into a loaded mod folder. The mod's own `.gitignore` keeps them out of git (executed: `git check-ignore -v` → `mods/shawarma-companion/.gitignore:2:.claude-plugin/types/`).
- Mutant M22 (the check is never cancelled after the row goes) survives every test. Each extra period reads only the mod's own state, with no file call (L11). The test kit refuses a second `clock.every` hook next to `mock.clock` (executed: `on("clock.every") registered twice`), so no test can count periods. L11's probe shows the sketch does stop it. The review lane gets it as a mutant to judge.
- Mutant M31 (no check restart from the render hook) survives: only a reload reaches that line, and the kit cannot reload (L12).
- R6's accepted leftover was "a race inside one Write call". With the L13 fix it narrows further: another writer counts as own only if it writes the exact text this session's Write sent, which draws nothing false. An Edit has no full text to compare, so an Edit racing another writer can still be taken as own. Accepted under R6.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `mods/shawarma-companion/.claude-plugin/plugin.json` | worker | new, as `sketch/`: name `shawarma-companion`, version `0.1.0`, `types`, `userConfig` 3f |
| `mods/shawarma-companion/hooks/hooks.json` | worker | new: `{ "modules": ["./register.tsx"] }` |
| `mods/shawarma-companion/hooks/model.ts` | worker | new, as `sketch/`: 2a, 2b, 2d and `clean`, `redSet`, `parseTitle`, `section`, `clockTime` |
| `mods/shawarma-companion/hooks/register.tsx` | worker | new, as `sketch/`: 2c, 2e, 3e |
| `mods/shawarma-companion/types/index.d.ts` | worker | new, as `sketch/`: `Snapshot` and the `PluginState` entry |
| `mods/shawarma-companion/tests/band.test.tsx` | tests commit | new, as `sketch/` (39 tests) |
| `mods/shawarma-companion/tsconfig.json`, `.gitignore` | worker | new, as `sketch/` |
| `mods/shawarma-companion/README.md` | worker | new: 3g |
| `.claude-plugin/marketplace.json` | worker | 9 added lines, as `sketch/marketplace.diff`; no existing line changes |
| `scripts/test/marketplace.test.mjs` | tests commit | new, as `sketch/` (2 tests) |

Labelled lines (contract text):

- **2a, marker.** `<tree root>/.shawarma/active`. After trimming each line and dropping trailing empty lines: exactly 2 lines. Line 1: the plan dir, absolute or relative to the tree root; trailing `/` dropped; not empty. Line 2: matches `/^(plan|run) \S/`. Else malformed. This format is skills-hekn's contract; change it only together with hekn.
- **2b, decisions.md.** One row per line: `<date> | RULING|DEFAULT | <decision> | <why>`. A line with at least 4 `|`-separated fields whose second field, trimmed, is `RULING` or `DEFAULT` counts as that. Blank lines are skipped. Every other line counts as unreadable.
- **2c, labels.** `isEarlier = mtimeMs < startedAt`. `isUnconfirmed = !isEarlier && !own.includes(`${marker}@${mtimeMs}@${text}`)`. Only a Write or Edit whose `file_path` (relative paths resolved against the cwd) ends `/.shawarma/active` records an own write, and only for that path, only when its modification time changed across the call, and, for a Write, only when the file then holds exactly the Write's `content`. `own` keeps the last 50. The tools watched for a refresh are Write, Edit, NotebookEdit and Bash.
- **2d, row.** As §2 step 5. `rowText(row, columns, now)` returns `''` when `columns < 1`; a malformed marker returns `shawarma: <problem>` alone. The head is `earlier session: ` or `unconfirmed: ` or nothing. Every drawn string passes through `clean`.
- **2e, refresh.** `refresh` never throws: an error logs to debug and clears the row. The check: `CHECK_MS = 15_000`, started when a refresh leaves a row and the band setting is on, or when the band's render hook draws a row and no check runs; cancelled when either stops. One period: `fs.exists` + `fs.stat` of the drawn marker; `refresh` only when the marker is gone or its `mtimeMs` changed.
- **3e, cost bound.** Per tool call: at most one `git rev-parse` per new cwd (cached), at most 10 fs calls. Per check period with an unchanged marker: 2 fs calls, 0 reads.
- **3f, settings.** `band`, `pane`, `context`: booleans, each with a `title` (validate fails without one, executed), defaults true, true, false.
- **3g, README.** Plain language. It holds: what the row and pane show; the install line `/plugin install shawarma-companion@strandic`; terminal and desktop only (D1); the three settings; the two labels and what each means; that the shawarma skill writes the marker from round 8 (skills-hekn); that claude-hud or ccstatusline cover path and context better.

Error surface: none reaches the caller. Every hook catches its own errors; the effect is an empty row (the allowed failure).

## 4. Tests

All in `mods/shawarma-companion/tests/band.test.tsx` unless named. Synthetic files only, through the `world()` fake (fs, git, cwd, usage, clock, tools). Each test's name states the one thing that turns it red.

*red* (33 tests, red on the tests commit with stubbed modules):
1. `band > marker this session wrote, plan and decisions: the row` — `toBe('skills-x — the thing · run W3 review · since 14:01 · 1 ruled, 1 default')`
2. `band > marker written through Bash, even naming the path: unconfirmed label` — `toBe('unconfirmed: skills-x — the thing · plan 2 spike · since 14:01 · 0 ruled, 0 default')`
3. `band > marker changed by a call that did not name it: unconfirmed label` — `toMatch(/^unconfirmed: skills-x — the thing · plan 2 spike/)`
4. `band > marker older than the session: earlier-session label` — `toMatch(/^earlier session: skills-x — the thing · plan 2 spike/)`
5. `band > marker another session wrote after this one started: unconfirmed label` — `toMatch(/^unconfirmed: skills-x — the thing · plan 3/)`
6. `band > worktree marker written by path wins over the cwd` — `toMatch(/^skills-x — the thing · run W0 · /)`
7. `band > marker deleted by a Bash call: the row goes`
8. `band > context on: ctx field`
9. `band > malformed marker: a problem line` — `toBe('shawarma: /repo/.shawarma/active is malformed')`
10. `band, more > an edit of decisions.md updates the count`
11. `band, more > plan dir missing: the row says so`
12. `band, more > a Write of a relative marker path is this session's`
13. `band, more > control characters in the title are not drawn`
14. `band, more > earlier-session and unconfirmed rows are dimmed, own row is not`
15. `band, more > desktop surface draws the row`
16. `band, more > no options given: the manifest defaults apply (band on, context off)`
17. `own writes (R6) > an Edit of the marker path is this session's` — `toMatch(/^skills-x — the thing · run W2 · /)`
18. `own writes (R6) > another writer landing inside this session's Write: unconfirmed` — `toMatch(/^unconfirmed: skills-x — the thing · run OTHER · /)`
19. `own writes (R6) > replaced after the call with the same mtime: unconfirmed` — `toMatch(/^unconfirmed: skills-x — the thing · run OTHER · /)`
20. `own writes (R6) > turn end re-reads the marker` — `toMatch(/^unconfirmed: .* run W2/)`
21. `session start > a marker already there at session start is drawn before any tool call`
22. `check every 15 s (R5) > marker replaced while idle: the row follows within 15 s, not before`
23. `check every 15 s (R5) > marker deleted while idle: the row goes within 15 s`
24. `check every 15 s (R5) > unchanged marker: stat only, no re-read` — `expect(count('stat ')).toBe(stats + 4)` over 60 s
25. `pane > recap, decisions, amendments, red set`
26. `pane > no brief yet`
27. `pane > pane on: the command is registered and a press on the row opens the pane`
28. `model > parseMarker`
29. `model > parseMarker: exactly two lines, trailing slashes dropped`
30. `model > clean and redSet`
31. `model > parseDecisions counts unreadable lines` — `toEqual({ ruled: 1, defaults: 0, unreadable: 3 })`
32. `model > clockTime adds the day only when it is not today`
33. `model > rowText cuts the title first, never past columns`

*guard* (green before and after):
34. `band > no marker: nothing drawn`
35. `band > band off: nothing drawn`
36. `band, more > a survey above the prompt: nothing drawn`
37. `check every 15 s (R5) > no row drawn: no check runs`
38. `check every 15 s (R5) > band off: no check runs`
39. `pane > pane off: no command, no button`

`scripts/test/marketplace.test.mjs`:
40. *guard* `every marketplace entry names a plugin.json with the same name and version` — green on the base manifest; red when the entry's source is mistyped (executed).
41. *red* `the companion mod is listed beside strandic` — red on the base manifest (executed).

Times in assertions are the literal `14:01`, not `clockTime`'s output (pass-1 oracle finding).

**Existing tests that change:** none. `node --test scripts/test/*.test.mjs` → base 511 pass, 0 fail, 2 skipped; with the sketch 513 pass, 0 fail, 2 skipped (the 2 new). The 2 skips need a pinned 2.1.250 CLI and name no changed symbol.

Predicted red set on the tests commit (tests 1–41 with `register.tsx` and `model.ts` stubbed, executed: `claude-personal plugin test` → 6 pass, 33 fail; `node --test scripts/test/marketplace.test.mjs` on the base manifest → 1 pass, 1 fail): **tests 1–33 and 41**; guards 34–40 green.

## 5. Accept gate

- suite, lint and review per run steps 3–4. The repo suite is `node --test scripts/test/*.test.mjs`.
- live-data run: `DRY-RUN ON STAND-IN — real run pending, orchestrator only`. There is no dataset: the mod reads files that only skills-hekn's skill writes. Stand-in: one interactive session started with `claude-personal --plugin-dir mods/shawarma-companion` in a scratch git repo holding a hand-written marker, plan.md and decisions.md. Observation, no rule: a screenshot of the row and of the pane in the PR's Verification. The real run (a shawarma plan with hekn's skill) is the ticket's "Done when" screenshot, in the round-8 retro record.
- rules, written now:

| rule | command, output fields read | data | settle | dry-run reading (fix in) | FAIL reading | reading when it cannot run |
|---|---|---|---|---|---|---|
| G1 mod tests all pass (invariant) | `claude-personal plugin test mods/shawarma-companion` → the `N pass` and `M fail` lines | the 39 synthetic tests | once | `39 pass`, `0 fail` | stubbed modules (the unfixed base): `6 pass`, `33 fail` | `claude-personal` missing → `command not found`, exit 127 |
| G2 mod validates (invariant) | `claude-personal plugin validate mods/shawarma-companion` → last line | the mod folder | once | `✔ Validation passed` | `title` dropped from `band`: `✘ Validation failed` | as G1 |
| G3 types check (invariant) | `npx -y -p typescript@5 tsc -p <tsconfig>` → exit code, where `<tsconfig>` is `mods/shawarma-companion/tsconfig.json` once the engine has laid `.claude-plugin/types/`, else a copy outside the repo whose `include` names T's path and the mod's `hooks`, `types`, `tests` | the mod folder | once | exit 0 | `isUnconfirmed` dropped from `Snapshot`: exit 2, `error TS2339: Property 'isUnconfirmed' does not exist on type 'Snapshot'` | T path wrong or missing: exit 2, `error TS2307: Cannot find module 'claude-code' or its corresponding type declarations.` |
| G4 marketplace entry installs (invariant) | `node --test scripts/test/marketplace.test.mjs` → `ℹ pass` / `ℹ fail`; and `claude-personal plugin validate .` → last line | the repo's manifest | once | `ℹ pass 2`, `ℹ fail 0`; `✔ Validation passed` | source `./mods/shawarma-companio`: `ℹ fail 2` (validate alone still passes: why the test exists) | as G1 |

- orchestrator follow-ups: after skills-hekn merges, the real plan run and its screenshots go in the round-8 retro record (ticket "Done when"). Then close skills-pi0y. skills-lhdg (refuse to start on a tree another session holds) is separate and does not block this.

## 6. Worst impact

A hostile or malformed marker, plan.md or decisions.md can at worst make the row show nothing, or show a wrong title or count *with* a dimmed `unconfirmed:`/`earlier session:` label. A file over 4 MiB, a control character, or a thrown read gives an empty row. Nothing is written: the mod only reads. ⇒ adversarial lane (3a).

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines L5d, L12, a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests L1, L2, L3, L9, L10, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (L1–L8 pass 1 on the first sketch, L9–L13 pass 2 on the re-spiked one):

- L1 `enumerate: marker texts — '', 'd', 'd\n', 'd\nplan', 'd\nplan 2', 'd\nrun W0', 'd\r\nrun W0\r\n', '  d  \n  run W3 review  ', 'd\nrun W0\nextra', '/abs/d\nrun W1', 'd/\nrun W1', '\nrun W0', 'd\nwalk W0', 'd\nPLAN 2', 'd\nplan\u0009 2', 'd\nrun W0', '﻿d\nrun W0' (source: 2a) → oracle: an expected table written before running parseMarker`
- L2 `enumerate: decisions.md lines — '', '   ', 'a | RULING | b | c', 'a|DEFAULT|b|c', 'a | ruling | b | c', 'a | RULING | b', 'a | RULING | b | c | d', '| a | RULING | b | c |', 'a | RULING | b|c | d', 'a | RULING | b | c\r', 'date | label | decision | why' (source: 2b) → oracle: a count table written before running`
- L3 `enumerate: rowText over columns {0,1,2,5,20,40,80,120,200} × title {'', 'x', 60 chars} × each flag alone and all together (source: 2d) → oracle: separate code checking length ≤ columns, step whole when the untitled line fits, label present when the line is not cut`
- L4 `200 Bash calls in one cwd (worst case: a marker present, the most fs calls per call) → oracle: counting hooks on process.run and fs.*`
- L5 `state follow-up: (a) Write, Bash rm, Write; (b) own write then another writer replaces it; (b2) a Bash call naming .shawarma/ while another writer replaces it; (c) 60 own writes; (d) reload with $.state kept → oracle: the band text against the label rule 2c`
- L6 `hostile corpus: plan dir '../../..' and '/etc'; plan.md over 4 MiB; ESC in title and step; 10,000 decision rows; marker path a directory; relative Write path → oracle: band text or absence, and whether the engine refused the tree`
- L7 `pane with no snapshot, no plan.md, no §1, 1,000 decision lines → oracle: the Markdown drawn and the engine's refusal line`
- L8 `real engine (claude -p --plugin-dir probe): cwd after a foreground cd; clockTime vs date +%H:%M; fs.read outside the root → oracle: the probe's debug-log lines and date`
- L9 `enumerate: every sequence of length 1–3 over {own Write, other writer replaces, other writer deletes, Bash rm, +14 s, +1 s, +15 s, unrelated Bash} (source: 2e) → oracle: a separate state model asserting a drawn step is the true one unless under 15 s since an unobserved change, nothing drawn without a marker after a refresh, label '' only after an own write`
- L10 `enumerate: marker writers — Write absolute, Write relative, Edit, MultiEdit, NotebookEdit, Bash echo naming the path, a script not naming it, another process before start, after start (source: 2c) → oracle: an expected label table written before running`
- L11 `one idle hour with a row drawn and the marker unchanged; band off; no marker; row then deleted by another writer (worst case: a row drawn for the whole hour) → oracle: counting hooks on fs.exists, fs.stat, fs.read, process.run, session.cwd per period`
- L12 `reload with snap non-null: does the check restart before the next tool call or turn end? → oracle: the kit's reload call if any, else NOT RUN with the source line`
- L13 `own Write and another writer's replacement inside the same tool call → oracle: the band text against 2c`

Mutants for 3b (executed on the final sketch; output `mutants-v3.txt` in the planner's scratch, re-run by 3b on the PR tree):

- `mutant: WRITERS without 'Bash' → tests 2, 3, 4, 5, 7, 14, 19 red`
- `mutant: parseMarker without the 2-line check → test 29 red`
- `mutant: parseMarker keeps a trailing '/' → test 29 red`
- `mutant: step regex /^(plan|run)/ → test 28 red`
- `mutant: plan dir never resolved against the root → 17 tests red (1–6, 10–13, 17–19, 21, 25, 28, 29)`
- `mutant: RULING counted as 0 → tests 1, 10, 31 red`
- `mutant: unreadable lines not counted → test 31 red`
- `mutant: clockTime always same-day → test 32 red`
- `mutant: no problem-only line → test 9 red`
- `mutant: no 'earlier session: ' head → tests 4, 21 red`
- `mutant: rowText never cuts → test 33 red`
- `mutant: clean is a no-op → tests 13, 30 red`
- `mutant: isEarlier always false → tests 4, 21 red`
- `mutant: relative file_path not resolved → test 12 red`
- `mutant: no 'plan dir not found' problem → test 11 red`
- `mutant: row never a Button → test 27 red`
- `mutant: CHECK_MS = 30_000 → tests 22, 23, 24 red`
- `mutant: the check never starts → tests 22, 23, 24 red`
- `mutant: the check re-reads every period → test 24 red`
- `mutant: isBandOn always true → test 38 red`
- `mutant: own write recorded for every changed marker, not only the named path → tests 2, 3, 6, 14 red`
- `mutant: the check is never cancelled → no test red (survives; §2 What the planner saw, L11)`
- `mutant: no 'unconfirmed: ' head → tests 2, 3, 5, 18, 19, 20, 22 red`
- `mutant: unconfirmed row not dimmed → test 14 red`
- `mutant: hasSurvey ignored → test 36 red`
- `mutant: no refresh at session.start → test 21 red`
- `mutant: a Write's text not compared → test 18 red`
- `mutant: decision label read from rows under 4 fields → test 31 red`
- `mutant: own key without the text → test 19 red`
- `mutant: no refresh at turn.complete → test 20 red`
- `mutant: no check restart from the render hook → no test red (survives; L12)`

## 8. Out of scope

- The method change: the marker and decisions.md writes, Wave 4's table (skills-hekn, round 8). This PR changes no file under `skills/`.
- Refusing to start a plan or run on a tree another session holds (skills-lhdg, round 8). Until then the `unconfirmed:` label is the only signal.
- VS Code: no mod surface exists (T:3955).
- Path and context segments beyond the optional `ctx` field (claude-hud, ccstatusline).
- The root README's skills table: the mod is not a skill. A one-line pointer to the mod's README is allowed; nothing else in it changes.
- Out-of-diff review findings: ticket, unless the finding is false output drawn by this mod.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|

unruled: none
