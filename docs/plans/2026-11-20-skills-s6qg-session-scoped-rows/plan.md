# skills-s6qg — shawarma-companion: each session shows the runs of its own worktrees

Ticket `skills-s6qg` · authority: the owner's rulings Q1, Q2, Q3, Q4, Q5 and defaults D2, D3, D4, D5, D6, D7, D8, D9, D10 in [decisions.md](decisions.md) (design interview and plan ending, 2026-11-20) · planned 2026-11-20 (claude-opus-5-5; skill 0.10.2) at base `2fd7b83 plan(skills-s6qg): session-scoped rows — design interview, four rulings, research report` · proposed branch `feat/s6qg-session-scoped-rows` in `.worktrees/s6qg`, PR + squash. Lessons read: none in the tagged `- Lesson (<tag>)` format (`grep -n '^- Lesson (' docs/plans/lessons.md` prints nothing, exit 1). The three untagged skills-v2tm lessons in that file were read: containment through links `matches §2 S1` (paths spelled through a link, written and listed); oracle from the contract's words `matches §4` (each new test asserts hand-written literals); mutants per round `matches §7` (32 mutants, run on each round's own lines).

## 1. What (the defect or goal, measured)

Every session in a repository draws a row for every marker in every worktree of that repository. `discover()` (`mods/shawarma-companion/hooks/register.tsx:166`, base) lists the trees with `git worktree list` from the session's working directory, and `snapshot()` reads markers from all of them (`register.tsx:318`). The session's own tree is only used to sort its rows first (`order()`, `hooks/model.ts:139`). So two sessions, each in its own worktree, each draw both runs, with nothing saying which is theirs.

Measured on the base: the test `band > a worktree's marker is drawn (git worktree list)` draws a marker in a worktree the session never entered as a plain row; with the final test file and no tree pre-claimed, 28 of the 209 older tests place markers only in trees the session never touched, and each draws them on the base.

The goal, from the rulings: full rows only for the worktrees the session works in (its *claimed* trees, Q1), the current one first and the others labelled (Q2), claims from file writes too (Q3) and from markers that appear during the session's own calls (Q5), kept across `/clear` and `--resume` (Q4). The direction that corrupts output is hiding one of the session's own runs under "other worktrees": the rule never errs that way. Showing another session's run is noise.

## 2. The design

The whole change is a patch beside this brief: [sketch/sketch.patch](sketch/sketch.patch), against `2fd7b83`, for `mods/shawarma-companion/` (`hooks/register.tsx`, `hooks/model.ts`, `types/index.d.ts`, `tests/band.test.tsx`, `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`; 7 files, 805 insertions, 74 deletions). `EXECUTED (inputs: the Partition rows below; `claude plugin test` on the sketch → `256 pass` / `0 fail`; probes P1–P5 against the real engine 2.1.329; the stand-in run G4; the three attack rounds' tests)`. Copy it as it is; §3 freezes its shapes.

- **2a Claims.** `claim($, trees, found, isSub)` returns the claimed tree roots: those already held (`$.state` key `claims` plus the module list `lastClaims`); the tree holding the main session's working directory (`mainCwd`) and the tree holding `$.session.root()`, each placed against every root's real path first (`byReal`), then by text; the trees of written folders (the last 64 across turns plus every folder of the current main turn, at most 4096), placed again at every refresh; and the trees of markers absent from the previous listing whose time falls within 2 s of one of the session's writing calls (Q5: the last 64 spans plus every span of the current turn, at most 4096). It merges into `$.state` with `update(prev => union)`.
- **2b Written paths.** Write and Edit give `file_path`, NotebookEdit `notebook_path` (relative ones against the hook's own cwd read before the call); a Bash call gives its result's internal `bashEditDiff.changedFiles` when that is a list of absolute strings, each folded with `resolvePath`. A written folder in no tree as written has its real path asked once per turn, at most 8 new folders per refresh.
- **2c Store.** On the first claim under a session id, the entry `claims:<id>` is read in; until that read succeeds the store is not written for that id. Then the entry is written whenever the claims or the session id change: `{ trees, at }`. The same pass examines at most 100 other `claims:` keys and deletes those untouched for 30 days, dated more than 30 days ahead, or malformed.
- **2d Drawing.** `pick()` draws only markers of claimed trees; the others are counted in the more-row as `1 run in another worktree` / `<n> runs in other worktrees`, and their tickets are listed in the pane under `In other worktrees:` (at most 20, sorted, each with line breaks drawn as spaces). The current tree is the working directory's, else the project root's (both through real paths); rows from other claimed trees start with `other tree: `.
- **2e Main cwd and turns.** `mainCwd` is read only outside subagent hooks: `session.start`'s `e.cwd`, a `tool.call` or `turn.complete` without `agentId`, and the 15 s timer. A subagent's call with no main cwd known claims and discovers from the root (its rejection falls back to the hook's cwd). The 15 s check runs the claim too. A main turn's end clears the turn lists only when its listing came from git, not the fallback.

Rejected options: a marker recording the session that wrote it (needs a skill-text change, which the hold forbids outside a retro: §8); "working directory only" and "project root only" (decisions.md Q1); greying other trees (Q2); any marker dated inside a call span (Q5).

**Sources** (plan step 1; research report `reports/research/report.md`, re-read by the round-1 attack lane, `reports/attack/report.md`):

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §2 2e · a shell `cd` does not move the root | `claude-code.d.ts:2975@2.1.325` | "A shell `cd` during the session does not move it" | verified |
| §2 2a · the root moves with `/cd` and worktree moves | `claude-code.d.ts:2975@2.1.325` | "where it started, or where `/cd`, a host's directory change or a worktree move took it" | verified |
| §2 2e · a subagent's hook reads its own cwd | `claude-code.d.ts:2971@2.1.325` | "keep the value read inside the hook if you need the hook's (a subagent's own)" | verified |
| §2 2c · `$.state` survives a hot reload | `claude-code.d.ts:3629@2.1.325` | "plain data that survives a hot reload of the plugin's code" | verified |
| §2 2c · the store is one file per plugin, 4 MiB | `claude-code.d.ts:3597,3615@2.1.325` | "This plugin's own key-value store, kept between sessions and hot reloads"; "Rejects … a store over 4 MiB of JSON text in all." | verified |
| §2 2c · `/clear` gives a new id and no `session.start` | `claude-code.d.ts:12343@2.1.325` | "the conversation ends, the process goes on under a new session id, and no `session.start` fires for it" | verified |
| §2 2b · Write and Edit carry `file_path`, NotebookEdit `notebook_path` | `claude-code.d.ts:19159,18580,18704@2.1.325` | `file_path`; `notebook_path` | verified |
| §2 2b · Bash's changed files are internal | `claude-code.d.ts:22948@2.1.325` | "@internal Per-file diff of the working-tree changes this command made … (changedFiles: absolute paths of every changed file…)" | paraphrased (the lane: the quote leaves out "at most 200; cut when shorter…") |
| §2 2d · `AbovePromptList` arranges whole plugin rows only | `claude-code.d.ts:107@2.1.325` | "Core stacks `rows`. A hook hides or reorders them in what `next(e)` gets" | verified |
| §8 · CwdChanged fires for a shell `cd` | https://code.claude.com/docs/en/hooks §CwdChanged | "Runs when a shell command in the main conversation changes the working directory" | verified |

**Probes** against the real engine (`claude-personal` 2.1.329, `-p`, a probe mod in `scratchpad/s6qg/probe-mod`, a scratch repo with one worktree):

- P1 Bash `cd .worktrees/wt` → `$.session.cwd()` reads `R/.worktrees/wt` on the next call, `root()` stays `R`; `classic.CwdChanged` did not fire (no log entry).
- P2 Bash `printf … > .shawarma/active-t1` with the cwd in that worktree → `bashEditDiff.changedFiles: ["R/.worktrees/wt/.shawarma/active-t1"]`; a call changing nothing → field absent.
- P3 From the main checkout, Bash writes into the worktree (a git-ignored marker and a new plain file) → `bashEditDiff` absent for both: the reason for Q5.
- P4 `--resume <id>` → the same session id; `$.state` value `n` read `None` at start.
- P5 A session started from `/tmp/x` → cwd and root `/private/tmp/x`; a Bash `cd /tmp/x/.worktrees/w` → cwd `/private/tmp/x/.worktrees/w`; a Write to `/tmp/x/.worktrees/w/x.txt` → `file_path` and `filePath` both `/tmp/…` as written.
- P6 EnterWorktree and `/clear`: `NOT RUN (a non-interactive run cannot answer EnterWorktree's permission ask; the bypass mode was refused by the auto-mode classifier; /clear needs an interactive session)`. The sketch reads the root at each refresh, and S21 covers a `/clear` that wipes `$.state`.

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| cwd in the current tree | engine, `$.session.cwd()` | S1 | claimed, rows first, no label |
| cwd moved by a shell `cd`, then back | engine | S3, A1 | both claimed; the old tree labelled |
| cwd in no tree | engine | S5, S19 | current = the root's tree; no real-path stat |
| root in another tree; moved with no tool call; its call failing | engine (EnterWorktree, `/cd`) | S4, S26, S15, S44 | claimed; by the 15 s check; cwd alone; rows still drawn |
| git spelling the roots through a link, cwd real; cwd in WT, root in main | git | S33, S41 | WT claimed and current |
| Write/Edit absolute, relative, `..`, `//`, through a link | the model | S6, S7, S17, A2 | the folded tree claimed; a link resolved by one stat |
| NotebookEdit | the model | S7 | `notebook_path`'s tree claimed |
| Bash changed files: present, `..`/`//`, malformed (6 shapes), 30 outside folders | engine (internal) | S8, S28, S9×6, S18 | claimed; folded; no claim; 8 stats |
| a worktree created and written in one turn; with 70 more writes and a subagent's turn end; listed only next turn; git failing at the turn end | git through Bash, then a Write | S22, S34, S40, S43 | claimed at the turn end, or the next turn |
| a new marker during the session's Bash call; 1.5 s before; 2.5 s after; another session's rewrite of an existing marker | any tool | S23, S35, S36, S42 | claimed; claimed; not; not |
| three sessions rewriting their markers every 30 s for 30 min (round-3 C3 population) | other sessions | `c3rerun` | none of the three claimed (store `["/repo"]`) |
| a subagent's call with its own cwd; with no main cwd known | engine | S27, S37 | current tree unchanged; WT not claimed by that cwd |
| two refreshes at once | engine | S25, S32 | both claimed (a true interleave: `NOT RUN`, §7 m16) |
| store: empty, own entry, failing read once, failing, 150 old keys, future-dated, malformed | the mod, another session, a corrupt file | S10–S14, S24, S29, S30, S39 | §4 readings |
| `$.state` wiped by a `/clear` | engine | S21 | the process list keeps the claims |
| no claimed run, only unclaimed runs | — | S2, S16, S20 | more-row only; the check reads nothing more |
| pane under a drawn row; with no row; a ticket name holding a line break | — | S31, S2, S38 | `In other worktrees:` line, on one line |
| older fixtures with no tree pre-claimed (the healthy population) | — | 209 older tests, `claimed: []` | 28 fold a run; each places its marker in a tree the session never touched: §2 S7 |

**Attack readings** (one per §7 line; raw values in the three reports):

- A1 → rows `[M,"1 run in another worktree"]`, `[W1,"other tree: "+M]`, then `[M,"other tree: "+W1]` through `/clear`; both ids' entries `["/repo","/repo/.worktrees/w"]`. Holds: S3, S12.
- A2 → 15 of 19 spellings matched; 4 differed. Changed the sketch: Bash paths folded (S28).
- A3 → malformed shapes: no claim, no extra stat; 1000 outside folders: 8 stats. Holds: S9, S18.
- A4 → a failed `store.get` overwrote the stored claims; 5 000 keys cost 721 ms. Changed the sketch: 2c (S24, S30).
- A5 → the labels push the ticket out below 30–40 columns. No change: the README says so (D2).
- A6 → every Q6 cost test at or under its bound with every tree claimed; store calls 3 at start, 0 after.
- A7 → two sessions, one per tree: each draws its own run, the other folded.
- A8 → the pane named no folded ticket. Changed the sketch: `In other worktrees:` (S2, S31).
- A9 → four lasting hidings and two transient ones. Changed the sketch: folders, spans, restore, merge, main cwd, the check's claim (S22–S27, S32).
- B1 → every round-1 reproduction reads as intended on the round-2 sketch.
- B2 → any-marker spans claimed another session's marker during a long call (B2a, B2c); a 1 s file-time floor missed (B2e); the clock jumping back `NOT RUN (the kit refuses a negative advance)`. Changed the sketch: Q5 (S42) and the 2 s slack (S35).
- B3 → 64 spans × 1000 markers: 17 ms per refresh, no file call added.
- B4 → past 64 calls in one turn the same-turn worktree was lost (B4a2). Changed the sketch: turn lists (S34).
- B5 → after each step of 64 sequences the run stayed drawn; the hot reload `NOT RUN (the kit cannot drop module variables and keep $.state)`.
- B6 → a line break in a listed ticket opened a Markdown line. Changed the sketch: names cleaned (S38).
- B7 → git spelling roots through a link folded the own run (B7a); a subagent first after a reload claimed its cwd (B7f). Changed the sketch: `byReal` (S33, S41) and `isSub` (S37).
- C1 → every round-2 reproduction reads as intended on the round-3 sketch.
- C2 → one failed real-path stat at discovery folds the own run for the turn and claims main (C2a3, C2c4); a link and its target both listed count the own run once more. Accepted: D8.
- C3 → any-marker spans claimed 3 of 3 concurrent sessions in the first call. Changed the sketch: Q5; re-run on the final sketch: 0 of 3 claimed (`c3rerun`).
- C4 → past 4096 distinct folders in one turn the run is lost (C4a). Accepted: D8.
- C5 → a subagent first with a failing root call blanked every row (C5d). Changed the sketch: the root call caught (S44). C5a, C5a2 `NOT RUN (the kit cannot seed the mod's rows atom)`.
- C6 → over 50 link-spelled worktrees, the own tree unscanned is folded (C6a); file times more than 2 s behind miss (C6c): accepted, D8. A turn end on the fallback cleared the turn lists (C6b3): changed the sketch (S43). The drawn row's own ticket keeps a line break in the pane (C6d): pre-existing, new bean `skills-enjt` (D9).

**What the planner saw**:

- S1 A Write path reaches the mod spelled as written (P5), and git may list roots through a link (B7a): every placement goes through real paths (2a, 2b).
- S2 `classic.CwdChanged` did not fire for a shell `cd` in a `-p` run (P1). Not hooked: the cwd is read at each refresh and every 15 s.
- S3 Bash's changed-files list is empty for writes outside the cwd's working tree (P3); Q5's new-marker span covers shawarma's Wave 0. Q3's recorded reason was wrong under Q1; Q5's decisions line corrects it.
- S4 Restoring at `session.start` alone missed sessions whose first refresh came from a tool call in the test kit; the sketch restores on the first claim per session id, which also covers `/clear`'s new id.
- S5 `hidden.others` and `hidden.otherTickets` are optional in the state contract: a value stored by 0.2.0 survives a hot reload and lacks them.
- S6 The pane reason "not shown (in another worktree)" was dropped: a chosen row is always in a claimed tree, and claims never shrink.
- S7 The test world seeds every tree a fixture names as claimed (D6). With `claimed: []`, 28 of the 209 older tests fold a run, each in a tree the session never touched.
- S8 The kit runs two tool calls one after the other, so the race of A9e cannot be forced (m16 survives). The merge is by construction; the run's adversarial lane re-tries it.
- S9 Cost: the claim adds no file call except one real-path stat per new written folder in no tree (≤ 8 per refresh, kept for the turn) and the store calls (3 at the first claim per id, 1 per change). The span comparison is in memory (B3: 17 ms at 64 × 1000).

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `hooks/register.tsx` | implementer | 2a–2e as in the sketch: `claim(…, found, isSub)`, `restore`, `byReal`, `remember`; module state `lastClaims`, `storedFor`, `restoredFor`, `folders`, `turnFolders`, `windows`, `turnWindows`, `lastSeen`, `mainCwd`, `folderReals`; exported caps `MAX_FOLDERS = 64`, `MAX_WINDOWS = 64`, `MAX_TURN = 4096`, `WINDOW_SLACK_MS = 2_000`, `MAX_RESOLVE = 8`, `MAX_PRUNE = 100`; `Trees.isFromGit`; `pick(found, trees, left, claims)` returns `{ picked, others, signature }`, the signature ending `#<others>`; `snapshot` claims after listing; `stale` reads the cwd and claims; `discover(…, isSub)` sets `own` through real paths |
| `hooks/model.ts` | implementer | `labelOf` adds `other tree: ` before the stale or earlier-session label when `isOtherTree`; `moreText(markers, trees, others = 0)`; `Claimed`, `CLAIM_TTL_MS = 30 days`, `claimKey(id) = 'claims:' + id`, `parseClaimed` (absolute-string trees, finite `at`, else null), `changedFiles` (absolute strings of `bashEditDiff.changedFiles`, else `[]`) |
| `types/index.d.ts` | implementer | `Snapshot.isOtherTree?: boolean`; `PluginState` gains `claims: string[]`; `hidden` gains `others?: number`, `otherTickets?: string[]` |
| `tests/band.test.tsx` | implementer | the world's new options (`root`, `id`, `store`, `claimed`, `cwdNow`, `bashDiff`; Bash `touch <abs>` and `mark <tree> <ticket> [<ms>]`) and the tests of §4 |
| `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json` | implementer | as in the sketch: "Which runs a session shows", the labels and more-row text, the pane line; version `0.3.0` |

Store entry shape: key `claims:<session id>`, value `{ trees: string[] (absolute roots as git lists them), at: number (ms) }`. Error surface (A4, B5): each engine call in 2a–2c is caught; a failure claims less that refresh and is logged to the debug log; the store is never written for an id whose entry could not be read.

## 4. Tests

All in `tests/band.test.tsx`, `describe('s6qg session-scoped rows')`, synthetic data only, expected values hand-written. Each red test fails on the base modules because the base draws every tree's run as a plain row and writes no store entry.

- S1 *red* — an unclaimed tree's run folds: `['main-1 · trivial', '1 run in another worktree']`.
- S2 *red* — only unclaimed runs: `['2 runs in other worktrees']`; pane `'No row drawn: 2 runs in other worktrees\nIn other worktrees: wt-1, wt-2'`.
- S3 *red* — cd into WT, back: `['wt-1 · trivial', 'other tree: main-1 · trivial']`, then `['main-1 · trivial', 'other tree: wt-1 · trivial']`.
- S4 *red* — root in WT: `['main-1 · trivial', 'other tree: wt-1 · trivial']`.
- S5 *red* — cwd in no tree: `['wt-1 · trivial', 'other tree: main-1 · trivial']`.
- S6, S7, S8 *red* — a Write; a NotebookEdit and a relative Write; a Bash changed file: their trees claimed (literal rows).
- S9 ×6 *red* — malformed changed-files fields: `['main-1 · trivial', '1 run in another worktree']`.
- S10 *red* — the entry's `at` is `STARTED + 120_000`; an unchanged claim leaves `at: 7`.
- S11 *red* — a stored `[WT]` draws `other tree: wt-1` at once.
- S12 *red* — a new id stores `[ROOT, WT]`.
- S13 *red* — prune leaves `['claims:sess-1', 'claims:young', 'other']`.
- S14, S15 *red* — a failing store, a failing root: `['main-1 · trivial', '1 run in another worktree']`.
- S16 *red* — a run appearing in an unclaimed tree while idle is counted within 15 s.
- S17 *red* — a Write through `/lnk` claims WT with one `stat /lnk/.worktrees/w/src resolve`.
- S18 *red* — 30 outside folders: 8 `stat /scratch/…` lines, no claim.
- S19, S20, S44 *guard* — no repository: no `resolve` stat; a steady unclaimed run: no `read` on the check; a subagent first with a failing root: rows drawn.
- S21 *red* — `$.state` claims answered empty: the run still drawn, labelled.
- S22, S34, S40, S43 *red* — a worktree made in the turn; with 70 more writes and a subagent's turn end; listed only next turn; git failing at the turn end: `['main-1 · trivial', 'other tree: n-1 · trivial']`.
- S23, S35 *red* — `mark <WT> wt-7` during a Bash call, at 0 and −1500 ms: `other tree: wt-7` drawn.
- S36, S42 *red* — a marker dated +2500 ms; another session's rewrite of an existing marker: `['main-1 · trivial', '1 run in another worktree']`.
- S24 *red* — one failed `store.get`: the entry stays `[WT]`, then `[ROOT, WT]`.
- S25, S32 *red* — two writes at once; a turn end racing a subagent's Write: `[ROOT, V, WT]`.
- S26 *red* — `/cd` with no tool call: claimed after 15 s.
- S27, S37 *red* — a subagent's cwd in WT: the main tree stays current; with no main cwd, WT not claimed.
- S28 *red* — `${ROOT}/x/..//.worktrees/w/a`: WT claimed.
- S29 *red* — the stored entry after a write: trees `[ROOT, WT]`, `at` `STARTED + 120_000`.
- S30, S39 *red* — 150 old keys: 51 left; a future-dated key deleted.
- S31, S38 *red* — the pane: `'**main-1** · trivial\n\nIn other worktrees: wt-1, wt-2\n\nTrivial run: no brief.'`; a name with a line break on one line.
- S33, S41 *red* — git through `/lnk`: `['wt-1 · trivial', '1 run in another worktree']`; with the root in main: `['wt-1 · trivial', 'other tree: main-1 · trivial']`.

**Existing tests that change** (plan step 2): each gains the `other tree: ` label on rows from a claimed tree that is not the current one (ruling Q2), and the world seeds every named tree as claimed (D6): band > a worktree's marker is drawn; review round 1 > a failed Edit of another session's worktree marker; review round 3 > F2; v2tm per-ticket markers > Q4 many markers, Q4 a cwd inside a linked worktree, Q4 two markers with the same mtime, Q4 one Button per row, Q4 /shawarma-companion opens the pane, Q2 a sibling-folder worktree, D3 prunable and bare, Q2 exits non-zero, Q2 prints garbage, Q2 process.run rejects ×4, Q3 a sibling marker rewritten while idle; Q5 a run that crashed; lane 3a round 2 > N2 a stale chosen row; lane 3a round 3 > R3-3 ×2; v2tm amendments > D11; review round 5 > N25 — 23 tests.

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|
| the 23 tests above | the row is in a claimed tree that is not the current one | the same text with `other tree: ` in front (the fallback tests map rows with `split(' · ')[0]`) | red on the base modules: all 23 among the 69 below |

Predicted red set on the tests commit (the final test file on the base modules, `claude plugin test`, pasted): **`187 pass` / `69 fail` / `Ran 256 tests across 1 file.`** — the 23 changed tests and the 46 new red tests; guards S19, S20, S44 green.

## 5. Accept gate

- suite, lint and review per run steps 3–4
- live-data run: `DRY-RUN ON STAND-IN — real run pending, orchestrator only`: the house rules give no live repository with parallel sessions to read; G4 runs the real engine on a scratch repository.
- rules:
  - **G1** mod tests: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin test mods/shawarma-companion`, reading the `N pass` and `M fail` lines, `<graded>/<expected>` = pass count / 256. Dataset: the synthetic tests of `tests/band.test.tsx`, read in aggregate. Settle: read once on the final commit. PASS: `0 fail` and 256 graded. Dry-run reading with the fix patched in (the sketch in `.worktrees/s6qg-spike`): `256 pass` / `0 fail` / `Ran 256 tests across 1 file.`. FAIL reading on the nearest wrong fix (labels without folding, `mine = found`): `237 pass` / `19 fail`; on the base modules: `187 pass` / `69 fail`. Cannot run: a missing folder reads `claude plugin test: /nonexistent-dir: no such plugin folder`, exit 1, no `pass` line — which differs from PASS.
  - **G2** manifest and state contract: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude-personal plugin validate mods/shawarma-companion`, reading the last line and the exit code. Dataset: the mod folder, one case. Settle: read once. Dry-run reading with the fix patched in: `✔ Validation passed`, exit 0. FAIL reading on a named wrong fix (`claims` dropped from `types/index.d.ts`): `shawarma-companion.claims is not declared: the manifest's types contract must name it …`, `✘ Validation failed`, exit 1. Cannot run: a missing folder reads `✘ Found 1 error:` / `✘ Validation failed`, exit 1, with the `Validating plugin manifest:` trace naming the wrong folder.
  - **G3** types: `~/.npm-global/bin/tsc -p <tsconfig>` (tsc 6.0.3), reading the exit code and `error TS` lines; `<tsconfig>` is the mod's own once the engine has laid `.claude-plugin/types/`, else a copy outside the repo whose `include` names the types file `plugin-authoring/types/claude-code.d.ts@2.1.325` and the mod's `hooks`, `types`, `tests`. Dataset: the mod's three source folders, one case. Settle: read once. Dry-run reading with the fix patched in: exit 0, no output. FAIL reading on a named wrong fix (`at: String(at)` in `parseClaimed`): exit 2, `hooks/model.ts(55,86): error TS2322: Type 'string' is not assignable to type 'number'.`. Cannot run: the types path wrong reads exit 2 with 495 `error TS` lines, 4 of them `TS2307` (cannot find module) — the TS2307 trace tells it from a FAIL.
  - **G4** real-engine claims on a stand-in: in a scratch repository with one worktree `.worktrees/wt`, `claude-personal -p --plugin-dir <mod> --allowedTools Bash` with the prompt "1) Bash: cd .worktrees/wt 2) Bash: cd <repo>", then the mod's store file `~/.claude-personal/plugins/store/shawarma-companion_inline-*.json` read for `claims:<that session id>`. Dataset: `DRY-RUN ON STAND-IN — real run pending, orchestrator only`, one session, case by case. Settle: read once. Dry-run reading with the fix patched in: `{"trees": ["R", "R/.worktrees/wt"], …}` (session `b0a2e6ac-…`, final sketch). FAIL reading with the base mod on the same steps: no `claims:` entry for that session (session `513c4c7b-…`: the file kept 1 key). Cannot run: `claude-personal` missing or the run refused reads no `session_id` in the JSON output and no new key — the trace is the JSON result line.
- orchestrator follow-ups: P6, in an interactive session (the owner's): open a session with the mod, `EnterWorktree` into a worktree, `/clear`, and read the store entry under both ids. Retro: the session id in the marker (§8). Bean `skills-enjt` (D9).

## 6. Worst impact

A session's own run drawn only as a count in "runs in other worktrees" — a false statement about which runs are the reader's — through a tree the claim misses (a spelling, a failed call, a lost update, a cap), or the mod's store file growing until the 4 MiB limit refuses writes. ⇒ adversarial lane.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines P6 (EnterWorktree and `/clear` on the real engine), m16 (two claims interleaved; the Partition's concurrent-refresh row), B2, B5 and C5 (a clock jumping back; a hot reload), a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests A2, A3, B2, C2, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (round 1, `reports/attack/report.md`):

- A1 cwd ROOT → WT → ROOT → a new session id → more calls → oracle band rows read through the kit's mount, against hand-written literals
- A2 enumerate: the ways a session's work reaches a tree — Bash `cd` relative and absolute, a root move, Write/Edit absolute, relative, with `..` escapes, `//`, through a link, NotebookEdit, Bash changed files absolute, with `..`, through a link, a subagent's call (research report §1, §7; probes P1–P2) → oracle the store entry in a test-owned Map, against hand-written tree lists
- A3 enumerate: `bashEditDiff` shapes — absent, null, string, number, `{}`, non-list, `[]`, `['']`, `['/']`, relative, non-strings, 1000 outside folders (P2; d.ts:22948) → oracle the fake fs log's `resolve` stat count and the store entry
- A4 hostile store contents, 10 000 trees, 5 000 keys, failing get/set/delete → oracle rows drawn, uncaught errors in the test output, the store's key list
- A5 labels at 10, 20, 30, 40 columns → oracle a substring check for the ticket, against the README's sentence
- A6 the Q6 cost tests with every tree claimed and with none → oracle the fake log's list/read/stat/run counts against those tests' bounds
- A7 two sessions, one repository → oracle each band's rows, literal
- A8 the pane on an other-tree row and with only the more-row → oracle the pane's text, literal
- A9 free attacks against the worst direction → oracle band rows and store entries, literal

Attack lines (round 2, `reports/attack-r2/report.md`):

- B1 every round-1 finding's reproduction on the round-2 sketch → oracle the store entry and band rows, literal
- B2 enumerate: false span claims — another session's marker during a long call, 1 ms outside a span, a `touch` during a span, fractional mtimes, a clock jumping back (kit: no negative advance) → oracle the store entry
- B3 span cost at 64 spans × 50 trees × 20 markers → oracle the kit's wall time and the fake fs log counts
- B4 more than 64 written folders; 100 outside folders over 3 turns → oracle the store entry and `resolve` stat counts per refresh and per turn
- B5 sequences of length 3 over a failing get, a failing set, a `/clear`, a hot reload, a turn end → oracle rows and the store entry after each step
- B6 the pane's `In other worktrees:` with 25 tickets, control and bidi characters, a chosen row → oracle the pane's text, literal
- B7 free attacks against the worst direction (subagents, a worktree removed and re-added, the fallback) → oracle band rows and store entries, literal

Attack lines (round 3, `reports/attack-r3/report.md`):

- C1 every round-2 finding's reproduction on the round-3 sketch → oracle rows and the store, literal
- C2 enumerate: spellings of the roots and the cwd — git through a link with the cwd real, the cwd through a link, a root that is a link inside another tree, a link and its target both listed → oracle rows and the store, literal
- C3 three sessions rewriting their markers every 30 s for 30 min, this session calling every 5 s for 0.2–60 s (seed 12345) → oracle the claimed trees at the end and the lane's own span arithmetic
- C4 5000 writes in one turn, distinct and repeated folders, a subagent's turn end midway → oracle rows after the main turn end, literal; time per refresh
- C5 the first event after a reload: the 15 s check, a subagent's turn end, a main call, a subagent with a failing root → oracle rows and the store, literal
- C6 free attacks on the worst direction through the round-3 changes → oracle rows and the store, literal

Mutants for 3b (each patched into the sketch's `hooks/register.tsx`, `claude plugin test` on the final §4 file; outputs in `scratchpad/s6qg/gates/mutants/<name>.txt`):

- mutant: `const mine = found; const others = []` (no folding) → S1, S2, S3, S9×6, S14, S15, S16, S18, S31, S33, S36, S37, S38, S42 (m1-nofold.txt)
- mutant: claim the cwd only, not the root → S4, S5, S26, S37, S41 (m2-noroot.txt)
- mutant: written folders never placed → S6, S7, S8, S10, S12, S17, S18, S21, S22, S25, S28, S29, S32, S34, S40, S43 (m3-nofolders.txt)
- mutant: Bash changed files ignored → S8, S18, S28 (m4-nobash.txt)
- mutant: stored claims never read in → 35 red (m5-norestore.txt)
- mutant: no pruning → S13, S30, S39 (m6-noprune.txt)
- mutant: `isOtherTree: false` → 44 red (m7-nolabel.txt)
- mutant: store not rewritten for a new id → S12, S24 (m8-noclearsave.txt)
- mutant: no MAX_RESOLVE cap → S18 (m9-nocap.txt)
- mutant: no real-path step for written folders → S17, S18 (m10-noresolve.txt)
- mutant: no root fallback for the current tree → S5 (m11-norootfallback.txt)
- mutant: no process list of claims → S21 (m12-nolastclaims.txt)
- mutant: the check's signature with every root claimed → S20 (m13-checkignoresclaims.txt)
- mutant: no span claims → S23, S35 (m14-nowindows.txt)
- mutant: `restoredFor` set before the read → S24 (m15-restoredearly.txt)
- mutant: `update(() => held)` with no merge → none red: `NOT RUN (the test kit does not interleave two claims)` (m16-nomerge.txt)
- mutant: `mainCwd` read in subagent hooks too → S27, S37 (m17-nomaincwd.txt)
- mutant: the check does not claim → S26 (m18-checknoclaim.txt)
- mutant: no MAX_PRUNE cap → S30 (m19-noprunecap.txt)
- mutant: Bash changed files not folded → S28 (m20-nofold-bash.txt)
- mutant: no `otherTickets` → S2, S31, S38 (m21-nootherlist.txt)
- mutant: written paths not kept across turns → S40 (m22-nowrites.txt)
- mutant: cwd and root placed by text only → S33, S41 (m23-nobyreal.txt)
- mutant: no turn lists → S34, S43 (m24-noturnlists.txt)
- mutant: `WINDOW_SLACK_MS = 1` → S35 (m25-noslack.txt)
- mutant: a subagent's cwd used when no main cwd is known → S37 (m26-noissub.txt)
- mutant: pane names not cleaned → S38 (m27-panenoclean.txt)
- mutant: a subagent's turn end clears the turn lists → S34 (m28-subclears.txt)
- mutant: `discover` sets `own` by text only → S41 (m29-discovernoreal.txt)
- mutant: any marker in a span claims (no `lastSeen`) → S42 (m30-anymarker.txt)
- mutant: the turn lists cleared on a fallback turn end → S43 (m31-clearonfallback.txt)
- mutant: the root call in `discover` uncaught → S44 (m32-uncaughtroot.txt)

## 8. Out of scope

- The marker recording which session wrote it: the exact signal, but it needs the shawarma skill to write the session id, and the hold forbids skill-text changes outside a retro. Retro candidate (already proposed by the per-ticket markers plan's Q1).
- Hooking `classic.CwdChanged` (ticket item 3): it did not fire in the probe (S2); each refresh and the 15 s check read the cwd and root.
- A `scope: session | repo` setting (ticket item 6): not added (D4).
- The residual foldings accepted in D8, and the pane's drawn ticket keeping a line break (bean `skills-enjt`, D9).
- Out-of-diff review findings: ticket, unless they show one of the session's own runs folded.

> **What this is about:** the plan's open defaults. The owner answered every question and default of this plan on 2026-11-20 ("Go with reco"); each is in decisions.md and the authority clause, so none is open.

unruled: none

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
| W1-1 | 2026-11-20 | default | §4 | S25, S32 read `store.get(…).trees` and S29 `JSON.parse(JSON.stringify(store.get(…)))` → the same reads null-safe (`?.`, `?? null`), expectations unchanged | On the base modules the store holds no entry, so these three reds threw a TypeError or SyntaxError before reaching their assertion; the run's tests-first rule needs each red to fail at its own assertion. Executed: 69 fail, all AssertionError. |
| Q6 | 2026-11-20 | the owner | §3 `hooks/register.tsx` | spans recorded at the call's end; scan order current then git's; store written when claims or id change; session and store calls unraced; an entry for every session → spans open from the call's start; current, then claimed, then the rest; rewritten until the last landed write holds every claim; session id, root and store calls raced against 2 s; no entry without a claim or a non-empty string id; a malformed key list read as none | The run's review lane folded the session's own run four ways, one on the real engine (a marker-writing call outliving a 15 s check), and a hanging store held every writing tool call. Regression tests Q6-1 to Q6-10. |
| W3-D1 | 2026-11-20 | default | §8 | — → right after a hot reload, the first listing claims no new marker (accepted) | Only an interactive session's reload reaches it. |
| W3-D2 | 2026-11-20 | default | §8 | — → a session started with `--fork-session` loses its parent's claims: bean skills-cq6n | Needs a link from the fork to its parent. |
| W3-D3 | 2026-11-20 | default | §8 | — → a working-directory call that never answers holds the tool call (pre-existing): bean skills-yxw1 | Out of this diff. |
| W3-D4 | 2026-11-20 | default | §8 | — → stored claims dated more than 30 days ahead are deleted, as ruled | The rule's consequence when a clock jumps back. |

