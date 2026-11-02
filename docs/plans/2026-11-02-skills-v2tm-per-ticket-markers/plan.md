# skills-v2tm — shawarma-companion reads per-ticket markers in every worktree

Ticket `skills-v2tm` · authority: the owner's rulings Q1–Q6 and defaults D1–D6 in [decisions.md](decisions.md) · planned 2026-11-02 (claude-opus-5-5; skill 0.9.0) at base `f1fc87e ask(v2tm): design interview — Q1–Q4 ruled, D1–D6 by go; skills-mvfd filed` · proposed branch `feat/v2tm-per-ticket-markers` in `.worktrees/v2tm`, PR + squash. Lessons read: `none: the skill repo keeps no lessons file (no docs/plans/lessons.md)`.

## 1. What (the defect or goal, measured)

From 0.9.0 the shawarma skill writes one marker per ticket, `.shawarma/active-<ticket>`, at the root of the step's tree (`skills/shawarma/SKILL.md:19`). The mod reads only `.shawarma/active`, so with a 0.9 skill it draws no row:

- `mods/shawarma-companion/hooks/model.ts:4`: `export const MARKER_TAIL = '/.shawarma/active'`.
- `mods/shawarma-companion/hooks/register.tsx:52`: the cwd candidate is `${top}${MARKER_TAIL}`, `top` from `git rev-parse --show-toplevel` (`register.tsx:48`), so only the session's own git root is looked at.
- `mods/shawarma-companion/hooks/register.tsx:183`: a Write or Edit counts as a marker write only when its path ends in `MARKER_TAIL`.
- `mods/shawarma-companion/README.md:22`: "From 0.9.0 it writes one marker per ticket, `.shawarma/active-<ticket>`, which this mod reads only once skills-v2tm lands; until then it draws nothing with a 0.9 skill."

Measured: the final test file run on the base modules reads `26 pass` / `125 fail` (§4). On a real engine, the base stand-in prints `v2tmdump rows=0` / `(no row)` in a repo holding two live markers (§5 G4).

Goal (the rulings): one row per live marker, in the session's own tree and in every linked worktree; the labels `earlier session:` and `stale:`; a pane per row; caps and cost bounds per Q6.

## 2. The design

Whole-file sketches sit beside this brief in [sketch/](sketch/): `sketch/hooks/register.tsx`, `sketch/hooks/model.ts`, `sketch/types/index.d.ts`, `sketch/tests/band.test.tsx`, `sketch/README.md`, and `sketch/sketch.patch` (the diff of the mod folder against `f1fc87e`, 2454 lines; `git apply --check` applies). Every sketch is `EXECUTED (inputs: the rows of the Partition table below; `claude plugin test` on the sketch → `151 pass` / `0 fail`; probes P1 `$.fs.list` and `$.process.run` in a real session, P2 `$.session.repo()` and `$.fs.stat({ resolve: true })` in a real session, the cost probes of §2 Partition, the geometric probe, the G4 stand-in)`. Copy them as they are; §3 freezes their shapes.

How it works, in order:

1. **Find the trees.** `git worktree list --porcelain -z`, once per cwd per turn, with a 2 s timeout. The main checkout is the first record. Prunable and bare records are skipped; locked and detached ones are read (D3). If git fails, times out, is cut short or prints no record, the mod walks up from the cwd with the file API to find `.git`, then reads the main checkout, `<main>/.worktrees/*` and the cwd's own tree (Q2).
2. **List the markers.** One `$.fs.list(<tree>/.shawarma)` per tree, at most 50 trees, the own tree first. Each entry named `active-<ticket>` of kind `file` is a marker; its time comes from the listing.
3. **Pick the rows.** Order the listed markers: own tree first, then newest first, then ticket. Read at most 20. The rest are counted for the more-row (Q6).
4. **Read each picked marker** (2a), list its plan folder (one call gives `plan.md`'s and `decisions.md`'s times), and read `plan.md` and `decisions.md` only when their times changed.
5. **Label it** (2c): `stale:` when not rewritten for 12 h or dated more than 1 min ahead; else `earlier session:` when not newer than the session start + 1 ms; else no label (current).
6. **Draw** one row per marker in a column Box, one Button per row when the pane setting is on, and a dimmed more-row when markers or trees were left out.
7. **Refresh** after Write, Edit, NotebookEdit and Bash calls, at turn end and at session start. While a row or the more-row is drawn, a 15 s check lists the trees and the drawn plan folders, refreshes when the drawn set or a plan file changed, and flips rows to `stale:` on the clock.
8. **Pane.** A row press opens the pane on that ticket; `/shawarma-companion` opens it on the first row. The title line carries the label; the header lists the other tickets with their labels; when the chosen marker is not drawn, the pane says why from what the last scan found.

Rejected options: each ruling in [decisions.md](decisions.md) names the option taken; the options set aside are research.md's open questions A–J ([reports/research.md](reports/research.md)).

**Sources** (plan step 1) — one row per outside behaviour a brief sentence relies on:

| sentence (§ · label) | source (URL or `path:line@version`) | verbatim quote | attack-lane re-read (verified · paraphrased · not found) |
|---|---|---|---|
| §2 step 2 · 2b markers listed | `types/claude-code.d.ts:3367@2.1.316` | "Lists a directory by name: `{ name, kind, size, mtimeMs, isLink }` per entry, each entry as it stands." | verified (probe P1: `[{"name":"active-t1","kind":"file","size":3,"mtimeMs":1793638817817.5598,"isLink":false}]`) |
| §3 2b · a missing folder rejects (D6) | `types/claude-code.d.ts:3367-3379@2.1.316` (silent) | — | not found in the types; settled by probe P1: missing `failed: ENOENT`, a file `failed: ENOTDIR`, mode 000 `failed: EACCES` |
| §2 step 1 · 2b git runs | `types/claude-code.d.ts:3616@2.1.316` | "Runs a command on the host by its argument vector (no shell) and resolves `{ exitCode, stdout, stderr }` once it exits, any exit code." | verified (probe P1: `exit 0` in the main checkout, `exit 128` in `/`, `rejected … failed to start: ENOENT` for a missing binary) |
| §3 2b · timeout | `types/claude-code.d.ts:3624-3625@2.1.316` | "`{ cwd, env, stdin, timeoutMs }` (cwd the session's by default; timeout 30 s by default, ten minutes at most)" | verified (lane 3a A9: real `sleep 31` without `timeoutMs` rejected after 30058 ms; C9: hung git with the sketch → fallback after 2005 ms) |
| §3 2b · cut output | `types/claude-code.d.ts:8295-8296@2.1.316` | "its first 4194304 bytes (4 MiB), the rest read and dropped (`isStdoutTruncated`)." | verified (lane 3a C3: truncated → fallback, kit; a real 4 MiB output NOT RUN) |
| §3 2b · `-z` framing | `git help worktree@2.48.1`, option `-z` | "Terminate each line with a NUL rather than a newline when --porcelain is specified with list. This makes it possible to parse the output when a worktree path contains a newline character." | verified (spike: `od -c` of the real output, records end `\0\0`; lane 3a C3: a real path `a\n\nworktree <S>/evil` parsed as one path) |
| §2 S6 · `-z` needs git 2.36 | `Documentation/RelNotes/2.36.0.txt:110-112` (Homebrew git-doc 2.48.1) | "\"git worktree list --porcelain\" did not c-quote pathnames and lock reasons with unsafe bytes correctly, which is worked around by introducing NUL terminated output format with \"-z\"." | verified (text); a real git older than 2.36 NOT RUN (lane 3a: a fake `git` exiting 129 with `unknown switch 'z'` → fallback) |
| §2 step 1 · main checkout first | `git help worktree@2.48.1`, `list` | "The main worktree is listed first, followed by each of the linked worktrees." | verified (research §2; spike `git worktree list --porcelain` on this repo) |
| §3 2c · session start | `types/claude-code.d.ts:12475-12476@2.1.316` | "When the session these figures count from began, in `$.clock.now()`'s milliseconds: its launch, or for a resumed session its first launch." | verified (lane 3a A6: real `startedAt` `1793640052251` whole ms; mtimes fractional, `1793640057987.6892`) |
| §2 step 6 · band height | `types/claude-code.d.ts:10946-10947@2.1.316` | "A tree of at most `maxRows` rows shows whole; a taller one scrolls in a window of `scroll.bodyRows`." | paraphrased (kit mounts with `maxRows` 40; a real band of 21 rows NOT RUN) |
| §3 2b · timeout timer | `types/claude-code.d.ts:3565@2.1.316` | "Calls `fn` once after `ms` milliseconds; `cancel()` before then stops it." | verified (test 115 on `mock.clock`; lane 3a C9: not done at 1999 ms, done at 2000 ms) |
| §3 2g · the check | `types/claude-code.d.ts:3572@2.1.316` | "Calls `fn` every `ms` milliseconds (at least 1) until `cancel()`." | verified (pi0y §2 Sources; tests 26, 149) |
| §3 2c · now | `types/claude-code.d.ts:3544@2.1.316` | "Resolves milliseconds since the epoch, now." | verified (lane 3a C6: `stale:` flips within one check after 12 h) |
| §2 S7 · repo root (not used) | `types/claude-code.d.ts:12238@2.1.316` | "The repository's root, absolute: the main working tree's for a worktree." | verified (probe P2: `root` `/Users/jonathan/Documents/strandic-skills` from the main checkout and from `.worktrees/plan-handoff`) |
| §2 S7 · real path (not used) | `types/claude-code.d.ts:3389@2.1.316` | "With `{ resolve: true }` also `realPath`, where the path lands, absent when it leads nowhere" | verified (probe P2: `/tmp` → `realPath` `/private/tmp`) |

**Partition** (spike q2) — per changed line:

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| marker count (2f) | the skill, one per ticket | 0, 1, many, 20, 21 markers: tests 1, 72, 77, 130, 131 | 0 → nothing; 21 → 20 rows + `+1 more not shown`; pass |
| marker place (2b) | the skill writes at the root of the step's tree | own tree, `.worktrees/` worktree, sibling-folder worktree: tests 7, 77, 78, 82 | own first, then newest first; pass |
| marker text (2a) | the skill, by hand, a crash mid-write | plan, run, trivial, 1 line, 3 lines, empty, bad step, `TRIVIAL`: tests 72, 75, 94, 95 | four malformed rows `shawarma: <t>: malformed marker`; pass |
| marker name (2a) | any tool | `active-`, `.gitignore`, a dir named `active-dir`, U+202E in the name: tests 74, 111 | not a marker / drawn with a space; pass |
| marker time vs start (2c) | the skill; another session; a crash | `== start`, `+0.5`, `+1`, `+1.25`, `+2`, `−0.5` ms: tests 98, 109 | current only past start + 1 ms; pass |
| marker age (2c) | a crashed run; a clock skew | 12 h −20 s → +10 s on the clock, 12 h exact, 12 h + 1 ms, +30 s, +2 min, +60000, +60001 ms: tests 123, 124, 151 | flips to `stale:` on the check with 0 reads; boundary strict `>`; pass |
| earlier and stale together (2c) | an old leftover | a day and 13 h before start: tests 99, 125 | `stale:` wins; pass |
| process.run (2b) | git on the host | ok, reject for every command, reject then walk, exit 129, garbage, truncated, never resolves: tests 82, 84, 85, 86, 106, 114, 115 | fallback each time; the call answers by 2 s; pass |
| porcelain records (2b) | git | prunable, locked, detached, bare, a path holding `\n\nworktree /X`, `worktree /`: tests 83, 96, 105, 107, 108 | prunable and bare skipped, no injected tree, `/` kept; pass |
| file-API walk (2b) | the fallback | cwd in main, 2 levels deep in a linked worktree, no `commondir`, sibling cwd, no `.git` up to `/`, a transient `EACCES`: tests 86–92, 112, 113 | main + `.worktrees/*` + own tree; sibling missed; retried at turn end; pass |
| `.shawarma` folder (2b) | the skill; a user | missing, a file, unreadable: test 93; real engine probe P1 | that tree draws nothing, others still draw; pass |
| plan dir (2a) | the marker's line 1 | missing, created while idle, missing in one row only: tests 13, 61, 101 | `plan dir not found: <dir>` in that row only; pass |
| two markers, same mtime (2e) | two sessions | test 79 | ticket order; pass |
| caps (2f) | many worktrees or markers | 50 / 51 / 52 trees, 20 / 21 markers, both caps: tests 128–131, 135–138 | `1 worktree not scanned`, `+1 more not shown · 1 worktree not scanned`; pass |
| check signature (2g) | another session | hidden marker touched each period; hidden marker rising into the top 20: tests 139, 140 | `[21, 21, 21, 21]` fs calls; risen marker drawn in 15 s; pass |
| cost (2h) | every refresh | W=3,M=2 and W=6,M=4 cold, steady, check: tests 126, 127 (cost probe in §2 What the planner saw S9) | 11/7/5 and 22/14/10 fs calls; pass |
| pane reasons (2i) | press, command, deletion, cap, read failure, reload | tests 122, 132, 142–148 | each reason as 2i; pass |
| `clean` (2j) | titles, steps, tickets, plan dirs | C0, DEL, C1, bidi, U+2028, U+2029: tests 46, 110, 111, 141 | spaces; pass |
| cwd through a symlink (2e) | a shell `cd /tmp/...` | lane 3a A10, real engine | the engine resolves the cwd and git the paths; holds |
| reload (2g, 2i) | a hot reload or a settings change | kit cannot reload (pi0y L12) | NOT RUN; state seeded through `state.get` instead (tests 56, 145) |
| real git older than 2.36 (2b) | an old host | fake `git` exiting 129 (lane 3a C3) | NOT RUN on a real old git; the fake falls back |
| symlinked plan dir (2a) | a user | lane 3a A2 | NOT RUN in the kit; pi0y L6 DEFAULT stands (a plan dir outside the repo shows its name, reads only) |

**Attack readings** (one per §7 line): `<line> → <reading>`. Lane ids are this brief's: A1–A10 and B1–B5 are lane 3a round 1 (its A1–A10, NR-1–NR-4, Q5), C1–C10 round 2 (its R-A1–R-A9, cost.md, R-pane), E1–E18 round 3 (its N1a–N6 rows and the A5 re-run).

- A1 hostile marker names → no row for `active-`; `..`, `a b`, U+202E drawn (fixed by F5, test 111); FIFO and links skipped; reads stay inside the tree.
- A2 hostile plan dirs and marker texts → `/etc` lists and reads `/etc/plan.md` (pi0y L6 DEFAULT); 10 MB read rejects, no row; CRLF parsed; bidi step fixed by F5; symlinked plan dir NOT RUN in the kit.
- A3 real porcelain with a newline path → injected `<S>/evil` row before the fix; with `-z` one path (test 105).
- A4 fallback oddities (`gitdir: /`, long `commondir`, depth 200) → terminates; a cached failed walk fixed by F8 (tests 112, 113).
- A5 enumerate 512 sequences → 32 violations, all `sameMtime` then `check` (F4, kept as S1).
- A6 mtime boundaries and a crashed run → current for 6 h before the fix; Q5 and F3 now (tests 109, 123, 151).
- A7 W and M grids → cold W+4M, steady W+2M, check W+M; Q6 caps (tests 126–131).
- A8 each `$` call rejecting → every hook answers, rows `[]` where a read fails; `$.command.run` NOT RUN in the kit (by code `openOn` catches).
- A9 a git that never answers → held 30 s before the fix; 2 s now (test 115).
- A10 cwd `/tmp` against git `/private/tmp` → the real engine resolves both; holds.
- B1 real prunable and locked worktrees → prunable left out, locked kept; holds (test 83).
- B2 plan dir not readable (real `chmod 000`) → no ticket in the row before F10; ticket first now (tests 116, 118).
- B3 real `.git` file, fallback through a denied `process.run` → main and own tree drawn, siblings missed (S5, test 89).
- B4 real engine, full mod, marker in the own tree → `Shawarma pane opened.` and the row drawn; holds (G4).
- B5 module state across a reload → NOT RUN (the kit loads a fresh module per test; pi0y L12).
- C1 hostile names again → no bidi in a row; U+2028 drawn before N6, a space now (test 141).
- C2 bidi in step, title, plan dir → `bandBidi:false`, `paneBidi:false`; holds (test 111).
- C3 `-z` parser and git answers (exit 129, newline form, empty, truncated) → each falls back; holds (tests 96, 105–107).
- C4 F8 retry and no repo → retried at turn end; 102 stats per turn with no repo (S10).
- C5 enumerate 1000 sequences → 85 violations: 84 F4, 1 oracle bug; 0 label or order errors.
- C6 Q5 boundaries → 12 h exact current, 12 h + 1 ms stale, +60000 current, +60001 stale; holds (test 151).
- C7 caps and costs → caps hold; a hidden marker in tree 51 and units mixed (N3), a hidden marker touched each period 41 calls (N4); fixed (tests 128–131, 135–139).
- C8 cost.md spot-check W∈{8,64} × M∈{8,256} → per call min(W,50) + 2·min(M,20); holds.
- C9 hang, late, early answer, turn end → done at 2000 ms; a late answer ignored until the next turn; holds (test 115).
- C10 pane after a push past 20, a stale chosen row → `no longer active` and no label before N1, N2; fixed (tests 132–134).
- E1 chosen pushed past 20 → `k5: not shown (past the 20-row limit)`; holds (test 132).
- E2 chosen deleted → `a: no longer active`; holds (test 144).
- E3 chosen tree moved past 50 trees → `no longer active` before R3-1; `x: not shown (not in the last scan)` now (test 142).
- E4 chosen marker unreadable → blamed the row limit before R3-2; `a: could not be read` now (test 143).
- E5 a failed refresh → `No shawarma plan or run is active.` before R3-3; `Shawarma state could not be read.` now (test 146).
- E6 `lastScan` across a real reload → NOT RUN (the kit cannot reload); seeded state reads `b: not shown (not in the last scan)` (test 145).
- E7 stale, earlier, current, malformed chosen → pane labels right; band malformed row unlabelled before R3-4, labelled now (tests 133, 134, 150).
- E8 only marker in tree 51 → more-row alone drawn; pane and check fixed by R3-3 (tests 148, 149).
- E9 `moreText` units → `+1 more not shown`, `+3 more not shown · 1 worktree not scanned`, `2 worktrees not scanned`; holds (tests 135–138).
- E10 25 markers, 52 trees, 20 columns → more-row cut to 20 columns; holds.
- E11 a hidden marker touched, stays hidden → 22 calls, 0 reads; holds (test 139).
- E12 a hidden marker rises into the top 20 → drawn first, 43 calls (a refreshing check); holds (test 140).
- E13 two hidden markers swap times → 22 calls, 0 reads; holds.
- E14 a hidden marker deleted → `+5 more` → `+4 more` in 15 s; holds.
- E15 the own tree's oldest marker rewritten → drawn first; holds.
- E16 one of the top 20 unreadable → 19 rows + `+5 more not shown` (S3).
- E17 U+2028, U+2029, U+0085 → spaces; U+200B, U+FEFF, U+00AD still drawn (invisible, no reordering).
- E18 enumerate 1000 sequences re-run → 85 violations, the same as C5; no regression.

**What the planner saw** — spike findings that did not stop the plan:

- S1 A same-mtime rewrite of a marker is not seen by the 15 s check, which only lists (lane 3a A5, C5, E18: 84 of 85 violations); the next tool call or turn end shows it. It goes to the owner as a DEFAULT; no ruling covers it, and Q3/Q6 forbid reads in an unchanged check.
- S2 At widths below the label plus the ticket, the ticket is cut before the label (lane 3a round 2 N7). Q1 asks that each row names its ticket; at 20 columns it still does (`stale: skills-v2tm …`).
- S3 A picked row whose files fail to read is dropped and not replaced (E16); the pane says `could not be read`. D5 (b) names drawing less as the acceptable direction.
- S4 A real reload was never run (B5, E6); state seeded through `state.get` stands in (tests 56, 145). No ruling or gate needs a real reload.
- S5 With git unavailable, sibling-folder worktrees are not found (B3, tests 84, 86, 89). Q2 names exactly this fallback; the README says so.
- S6 A git older than 2.36 has no `-z`, so the mod always uses the fallback there (Sources row 7). The README says so; no supported host was found older than 2.36 (lane 3a: Homebrew 2.48.1, Apple 2.54.0).
- S7 `$.session.repo().root` gives the main checkout and `$.fs.stat(path, { resolve: true })` a real path (probe P2); neither is used: git already prints resolved paths (A10), and the walk is needed for the own tree.
- S8 The more-row reads `1 worktree not scanned` for one tree (singular); the coordinator's text gave `<k> worktrees not scanned`. Wording only.
- S9 Cost, executed (`fs / reads / process.run`): W=3,M=2 cold 11/6/1, steady 7/2/0, check 5/0/0; W=6,M=4 22/12/1, 14/4/0, 10/0/0; W=51,M=1 54/3/1, 52/1/0, 51/0/0 with `1 worktree not scanned`; W=2,M=21 82/60/1, 42/20/0, 22/0/0 with `+1 more not shown`. Geometric probe (one `claude plugin test` subprocess per size, best of 3, 120 s wall cap, 2 GiB summed-RSS cap polled with `ps`; `ulimit -v` is refused on macOS): work counts stop at the caps (W 64 → 256: 54/52/51; M 64 → 256: 81/41/21; both: 130/90/70); process CPU (user+sys of `/usr/bin/time -l`) 0.34–0.47 s and max RSS 141–224 MB, the growth at 256 from the kit's fake file map. The base reads no `active-*` marker, so it has no head-against-base cost reading. Q6's bound is met with no margin on the cold path (11 of 11).
- S10 With no repository at all, the file walk re-runs at each turn end (102 stats per turn at depth 101, C4), as F8 asks: a failed walk is retried.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `mods/shawarma-companion/hooks/register.tsx` | worker | as `sketch/hooks/register.tsx`: 2b, 2c, 2f, 2g, 2h, 2i, the error surface |
| `mods/shawarma-companion/hooks/model.ts` | worker | as `sketch/hooks/model.ts`: 2a, 2c, 2d, 2e, 2f, 2j, and `parseWorktrees`, `ownTree`, `under`, `parentOf`, `resolvePath`, `parseGitdir` |
| `mods/shawarma-companion/types/index.d.ts` | worker | as `sketch/types/index.d.ts`: 2k |
| `mods/shawarma-companion/tests/band.test.tsx` | tests commit | as `sketch/tests/band.test.tsx` (151 tests) |
| `mods/shawarma-companion/README.md` | worker | as `sketch/README.md`: the rows, labels, caps, pane reasons, fallback limits |

Labelled lines (contract text). Where a line replaces a pi0y frozen line (`docs/plans/2026-10-17-skills-pi0y-shawarma-companion/plan.md` §3), it says which and the ruling that changes it.

- **2a, marker** (replaces pi0y 2a; D4). Path `<tree>/.shawarma/active-<ticket>`; the ticket is the name after `active-`, not empty, entry kind `file`. After trimming each line and dropping trailing empty lines: exactly 2 lines. Line 2 `trivial`: line 1 (the ticket id) must not be empty and is not compared with the name. Else line 2 matches `/^(plan|run) \S/` and line 1, trailing `/` dropped and not empty, is the plan dir, absolute or `under(tree, line1)`. Else malformed. The file `.shawarma/active` is not read (A1, D4).
- **2b, discovery** (Q2, D3, D6). `run(['git', 'worktree', 'list', '--porcelain', '-z'], cwd)`: `timeoutMs: 2000` and a `$.clock.after(2000)` race; null on reject, timeout or `isStdoutTruncated`. Cached per cwd until `turn.complete` or `session.start`. `parseWorktrees` reads NUL-framed records (a field `''` ends one), `null` for output with no NUL or no `worktree /` record; a root of `/` stays `/`. Prunable and bare records are dropped; locked and detached kept. A null list or an exit code other than 0 starts the walk: one `$.fs.stat(<dir>/.git)` per level from the cwd up to `/`; a folder → that folder is the main checkout and the own tree; a file → its `gitdir:` line (relative to the folder), then `<gitdir>/commondir` (empty or unreadable → `../..`), the main checkout the folder above a common dir ending `/.git`. Roots: the main checkout, the folders under `<main>/.worktrees/`, the own tree, deduped. A walk that found a repo is kept per cwd for the session; one that did not is retried at the next discovery (F8, A4). A `$.fs.list` that rejects (`ENOENT`, `ENOTDIR`, `EACCES`, probe P1) means that tree has no markers.
- **2c, labels** (replaces pi0y 2c; Q1, Q5, F3). `isEarlier = !(at > startedAt + 1)`; `isStale = now - at > STALE_MS || at > now + FUTURE_MS` with `STALE_MS = 12 * 3600 * 1000`, `FUTURE_MS = 60_000`, `now = await $.clock.now()`; a row is current when `!isEarlier && !isStale`. The label is `stale: ` when `isStale`, else `earlier session: ` when `isEarlier`, else empty (`labelOf`); a row with a label is dimmed. No `unconfirmed:` label, no Write/Edit claim (Q1). The check re-tests `isStale` on the clock with no file call (A6, C6).
- **2d, row text** (amends pi0y 2d; Q1, D1, F10). `[label]<ticket><rest> · <step> · since <HH:MM> · <n> decision(s)[ · <problem>][ · ctx <p>%]`. `rest` is the title after the ticket when the title equals the ticket or starts with `<ticket> ` (`namesTicket`), else ` · <title>`. Trivial: `[label]<ticket> · trivial · since <HH:MM>`. Malformed: `[label]shawarma: <ticket>: malformed marker`. At most `bodyColumns`: the title is cut first, then the problem text, then the line's end. `ctx` on the first row only. The line passes through `clean`.
- **2e, order** (Q4). The own tree first (`ownTree`: the longest root that is the cwd or a parent of it), then `since` newest first, then the ticket in code-unit order.
- **2f, caps** (Q6). `MAX_TREES = 50` roots scanned, the own tree first. `MAX_ROWS = 20` markers picked from the listings in 2e order before a read. The more-row is `moreText(markers, trees)`: `+<n> more not shown` (listed, not read), `<k> worktree not scanned` / `<k> worktrees not scanned` (trees past the cap), joined by ` · `; drawn dimmed after the rows, and drawn alone when no row is (R3-3, E8).
- **2g, refresh and check** (replaces pi0y 2e's check body; R5's 15 s kept; Q6, N4). Refresh at `session.start`, after `tool.call` of Write, Edit, NotebookEdit and Bash, and at `turn.complete`. `CHECK_MS = 15_000`; the check runs while a row or the more-row is drawn and the band setting is on, and is started by the band's render hook after a reload. One period lists the scanned trees' `.shawarma` and the drawn rows' plan dirs, then refreshes (reusing those listings) when the signature (the 20 picked marker keys from the listings, the hidden marker count, the unscanned tree count) or a drawn row's `plan.md` or `decisions.md` time changed, or a plan dir the row calls missing now lists; else it flips `isStale` from the clock.
- **2h, cost** (replaces pi0y 3e and W3-R1's bound; Q3 then Q6). With W the scanned trees (at most 50) and M the read markers (at most 20): a cold or changed tool call at most W + 4M file calls; a steady tool call at most W + 2M; a check period at most W + M with 0 reads when nothing changed (C7, C8). At most one `git worktree list` per cwd per turn. `plan.md` and `decisions.md` are read only when their time from the plan-dir listing changed (cached by path and time); the marker file is read on each pass.
- **2i, pane** (Q4, N1, N2, R3). `chosen` is a marker path: a row press sets it; `/shawarma-companion` sets the first row's. The title line is `<label>**<title>** · <step>` (trivial `<label>**<ticket>** · trivial`, then `Trivial run: no brief.`; malformed `<label>shawarma: <ticket>: malformed marker (<path>)`). The header is `Other tickets: <ticket>[ (stale)| (earlier session)], …`. A chosen marker that is not drawn reads, from `lastScan` alone: `<ticket>: not shown (not in the last scan)` when no scan succeeded since load or its tree's listing did not answer; `<ticket>: could not be read` when it was picked and its files failed; `<ticket>: not shown (past the 20-row limit)` when listed and not picked; `<ticket>: no longer active` when its tree answered and it was not listed. With no row: `Shawarma state could not be read.` after a failed refresh or check; `No scan has run since the mod loaded.`; `No row drawn: <more-row text>`; else `No shawarma marker in the last scan.` (E1–E8).
- **2j, `clean`**. Each of C0 (`\n` kept when asked), DEL, C1, U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069, U+2028, U+2029 becomes a space (A1, C1, E17).
- **2k, state** (`types/index.d.ts`). `PluginState['shawarma-companion'] = { rows: Snapshot[]; chosen: string | null; hidden: { markers: number; trees: number } }`. `Snapshot = { ticket, marker, tree, title, step, since, isEarlier, isStale, decisions, planDir, planAt, decisionsAt, problem? }`. The pi0y keys `snap`, `marker` and `own` are dropped; a reload with old values reads `rows` as `[]` until the first refresh.

Error surface — each `$` failure, what it draws; no error reaches the caller (A8):

| failure | effect | what the person can do |
|---|---|---|
| `$.process.run` rejects, times out, exits other than 0, is cut, or prints no record | the file walk (2b) | install git 2.36 or newer to see sibling-folder worktrees |
| a walk `$.fs.stat` rejects | that level counts as no `.git`; no repo → no rows, retried at the next turn | — |
| `$.fs.list` of a `.shawarma` rejects | that tree draws no row; the pane says `not in the last scan` for its marker | fix the folder's permissions |
| `$.fs.read` of a picked marker, `plan.md` or `decisions.md` rejects | that row is dropped; the pane says `could not be read` | — |
| `$.fs.list` of a plan dir rejects | `plan dir not found: <dir>` (`$.fs.exists` false) or `plan dir not readable: <dir>` | fix the marker's line 1 |
| `$.session.cwd` or `$.session.usage` rejects in a refresh | rows `[]`, `lastScan` failed; the pane says `Shawarma state could not be read.` | the next tool call or turn end retries |
| the check throws | the same as a failed refresh | — |
| `$.ui.open` rejects | the command answers `Shawarma pane could not open: <error>`; a press is swallowed | — |
| `$.command.register` rejects | logged to debug; the rows still draw | — |

## 4. Tests

Numbered as the runner prints them, file `mods/shawarma-companion/tests/band.test.tsx`, one reason to go red each; *red* = fails on the tests commit (the final test file with the base modules), *guard* = green on both. Synthetic data only. The quoted assertion is the test's last `expect` line.

1. *guard* — `tests/band.test.tsx` · band > no marker: nothing drawn — `expect(await bandText($)).toBe(undefined)`
2. *red* — `tests/band.test.tsx` · band > marker this session wrote, plan and decisions: the row — `expect(await bandText($)).toBe('skills-x — the thing · run W3 review · ${SINCE(1)} · 2 decisions')`
3. *red* — `tests/band.test.tsx` · band > marker written through Bash: no label (Q1) — `expect(await bandText($)).toBe('skills-x — the thing · plan 2 spike · ${SINCE(1)} · 0 decisions')`
4. *red* — `tests/band.test.tsx` · band > marker changed by a call that did not name it: no label (Q1) — `expect(await bandText($)).toMatch(/^skills-x — the thing · plan 2 spike/)`
5. *red* — `tests/band.test.tsx` · band > marker older than the session: earlier-session label — `expect(await bandText($)).toMatch(/^earlier session: skills-x — the thing · plan 2 spike/)`
6. *red* — `tests/band.test.tsx` · band > marker another session wrote after this one started: no label (Q1) — `expect(await bandText($)).toMatch(/^skills-x — the thing · plan 3/)`
7. *red* — `tests/band.test.tsx` · band > a worktree's marker is drawn (git worktree list) — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W0 · /)`
8. *red* — `tests/band.test.tsx` · band > marker deleted by a Bash call: the row goes — `expect(await bandText($)).toBe(undefined)`
9. *guard* — `tests/band.test.tsx` · band > band off: nothing drawn — `expect(await bandText($)).toBe(undefined)`
10. *red* — `tests/band.test.tsx` · band > context on: ctx field — `expect(await bandText($)).toMatch(/ · ctx 42%$/)`
11. *red* — `tests/band.test.tsx` · band > malformed marker: a problem line — `expect(await bandText($)).toBe('shawarma: ${TICKET}: malformed marker')`
12. *red* — `tests/band.test.tsx` · band, more > an edit of decisions.md updates the count — `expect(await bandText($)).toMatch(/ · 1 decision$/)`
13. *red* — `tests/band.test.tsx` · band, more > plan dir missing: the row says so — `expect(await bandText($)).toMatch(/ · plan dir not found: \/repo\/docs\/plans\/2026-10-16-skills-x-thing$/)`
14. *red* — `tests/band.test.tsx` · band, more > a Write of a relative marker path is drawn — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W1/)`
15. *red* — `tests/band.test.tsx` · band, more > control characters in the title are not drawn — `expect(text).toMatch(/^skills-x  \[31mred · run W1/)`
16. *guard* — `tests/band.test.tsx` · band, more > a survey above the prompt: nothing drawn — `expect((await ui.find({ type: 'Text' }))?.text).toBe(undefined)`
17. *red* — `tests/band.test.tsx` · band, more > earlier-session rows are dimmed, current rows are not (Q1) — `expect((await (await mount()).find({ type: 'Text' }))?.props.dimColor).toBe(false)`
18. *red* — `tests/band.test.tsx` · band, more > desktop surface draws the row — `expect((await ui.find({ type: 'Text' }))?.text).toMatch(/run W1/)`
19. *red* — `tests/band.test.tsx` · band, more > no options given: the manifest defaults apply (band on, context off) — `expect(text).not.toMatch(/ctx/)`
20. *red* — `tests/band.test.tsx` · writes of the marker (was: own writes, R6) > an Edit of the marker path is drawn — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W2 · /)`
21. *red* — `tests/band.test.tsx` · writes of the marker (was: own writes, R6) > another writer landing inside this session's Write: its text, no label — `expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER · /)`
22. *red* — `tests/band.test.tsx` · writes of the marker (was: own writes, R6) > replaced after the call with the same mtime: the new text, no label — `expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER · /)`
23. *red* — `tests/band.test.tsx` · writes of the marker (was: own writes, R6) > turn end re-reads the marker — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)`
24. *red* — `tests/band.test.tsx` · session start > a marker already there at session start is drawn before any tool call — `expect(await bandText($)).toMatch(/^earlier session: skills-x — the thing · plan 2 spike/)`
25. *red* — `tests/band.test.tsx` · check every 15 s (R5) > marker replaced while idle: the row follows within 15 s, not before — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)`
26. *red* — `tests/band.test.tsx` · check every 15 s (R5) > marker deleted while idle: the row goes within 15 s — `expect(await bandText($)).toBe(undefined)`
27. *red* — `tests/band.test.tsx` · check every 15 s (R5) > unchanged files: at most W + 2M fs calls a period, no re-read (Q3) — `expect(calls.length <= 4 * (2 + 2 * 1)).toBe(true)`
28. *guard* — `tests/band.test.tsx` · check every 15 s (R5) > no row drawn: no check runs — `expect(log.length).toBe(before)`
29. *guard* — `tests/band.test.tsx` · check every 15 s (R5) > band off: no check runs — `expect(log.length).toBe(before)`
30. *red* — `tests/band.test.tsx` · pane > recap, decisions, amendments, red set — `expect(text).toMatch(/### Red set\n\nPredicted red set: \*\*t1, t2\*\*/)`
31. *red* — `tests/band.test.tsx` · pane > no brief yet — `expect(await pane($)).toMatch(/_No brief yet: the plan is in progress._\n\n### Decisions\n\n_None recorded._$/)`
32. *red* — `tests/band.test.tsx` · pane > pane on: the command is registered and a press on the row opens the pane — `expect(log.filter(line => !/^(exists|stat|read|list|run) /.test(line))).toEqual(['command shawarma-companion', 'open shawarma-companion'])`
33. *guard* — `tests/band.test.tsx` · pane > pane off: no command, no button — `expect(log.filter(line => !/^(exists|stat|read|list|run) /.test(line))).toEqual([])`
34. *red* — `tests/band.test.tsx` · model > parseMarker — `expect(parseMarker('', ROOT)).toBe(null)`
35. *red* — `tests/band.test.tsx` · model > parseMarker: exactly two lines, trailing slashes dropped — `expect((parseMarker('d/\nrun W1\n\n', ROOT) as any)?.planDir).toBe('${ROOT}/d')`
36. *guard* — `tests/band.test.tsx` · model > clean and redSet — `expect(redSet('## 4. Tests\n\nnone\n')).toBe(null)`
37. *guard* — `tests/band.test.tsx` · model > parseDecisions counts dated rows only — `expect(parseDecisions([`
38. *guard* — `tests/band.test.tsx` · model > clockTime adds the day only when it is not today — `expect(clockTime(at, at + 86_400_000)).toBe('10-16 14:02')`
39. *guard* — `tests/band.test.tsx` · model > rowText cuts the title first, never past columns — `expect(rowText(row, 200).startsWith('a long ticket title · run W3')).toBe(true)`
40. *red* — `tests/band.test.tsx` · review round 1 > decisions.md written while idle: the count follows within 15 s — `expect(await bandText($)).toMatch(/ · 2 decisions$/)`
41. *red* — `tests/band.test.tsx` · review round 1 > plan.md retitled while idle: the title follows within 15 s — `expect(await bandText($)).toMatch(/^skills-x — renamed · run W1/)`
42. *guard* — `tests/band.test.tsx` · review round 1 > a Bash call with two markers: at most W + 3M fs calls (Q3) — `expect(fsCalls(log, n0).length <= 2 + 3 * 2).toBe(true)`
43. *guard* — `tests/band.test.tsx` · review round 1 > a marker Write, one marker: at most W + 3M fs calls (Q3) — `expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)`
44. *guard* — `tests/band.test.tsx` · review round 1 > parseDecisions splits on \r\n, \r and \n — `expect(parseDecisions(rows.join('\r\n'))).toEqual({ decisions: 3 })`
45. *red* — `tests/band.test.tsx` · review round 1 > a failed Edit of another session's worktree marker: its text, no label — `expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER/)`
46. *guard* — `tests/band.test.tsx` · review round 1 > clean blanks C1 controls — `expect(clean('a\u009f\nb', true)).toBe('a \nb')`
47. *red* — `tests/band.test.tsx` · review round 1 > a C1 control in the title: the row is still drawn — `expect(await bandText($)).toMatch(/run W1/)`
48. *red* — `tests/band.test.tsx` · review round 1 > a C1 control in decisions.md: the pane is still drawn — `expect((await (await pane($)).find({ type: 'Markdown' }))?.props.text).toMatch(/### Decisions/)`
49. *red* — `tests/band.test.tsx` · review round 1 > pane: a read that fails draws a short line, not an error — `expect((await (ui as any).find({ type: 'Text' }))?.text).toMatch(/could not be read/)`
50. *guard* — `tests/band.test.tsx` · review round 1 > row: a failing usage call with context on draws nothing, not an error — `expect(await bandText($).catch((err: unknown) => 'threw ${String(err)}')).toBe(undefined)`
51. *guard* — `tests/band.test.tsx` · review round 1 > command: the pane failing to open is said, not thrown — `expect(out.text).toMatch(/^Shawarma pane could not open: /)`
52. *red* — `tests/band.test.tsx` · review round 1 > session start: a failed command registration still draws the row — `expect(await bandText($)).toMatch(/^earlier session: .* plan 2/)`
53. *guard* — `tests/band.test.tsx` · review round 1 > tool call: the cwd failing after the call still returns the result — `expect(out?.result?.text).toBe('ok')`
54. *guard* — `tests/band.test.tsx` · review round 1 > the check stops when the row goes — `expect(log.slice(n0).filter(line => line === 'list ${ROOT}/.shawarma')).toEqual([])`
55. *red* — `tests/band.test.tsx` · review round 1 > row, gone, row again: one check, not two — `expect(log.slice(n0).filter(line => line === 'list ${ROOT}/.shawarma').length).toBe(4)`
56. *red* — `tests/band.test.tsx` · review round 1 > reload with a row kept in state: the first drawing restarts the check — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)`
57. *red* — `tests/band.test.tsx` · review round 3 (W3-R4) > F2 a worktree marker and the cwd marker: both rows, the own tree first (Q4) — `expect(texts[1]).toMatch(/^skills-x · tree plan · run W1 · /)`
58. *red* — `tests/band.test.tsx` · review round 3 (W3-R4) > F2 an Edit whose before-call stat fails: drawn, no label — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)`
59. *red* — `tests/band.test.tsx` · review round 3 (W3-R4) > F4 a CR-only plan.md: title, recap and decision lines — `expect(text).toMatch(/- 2026-10-16 \| Q1 RULING \| a \| b\n- 2026-10-16 \| D1 DEFAULT \| c \| d/)`
60. *red* — `tests/band.test.tsx` · review round 3 (W3-R4) > F5 a malformed marker: the pane says so and reads no plan file — `expect(fsCalls(log, n0)).toEqual([])`
61. *red* — `tests/band.test.tsx` · review round 3 (W3-R4) > F6 plan dir created while idle: the problem line goes within 15 s — `expect(await bandText($)).toBe('skills-x · 2026-10-16-skills-x-thing · run W1 · ${SINCE(1)} · 0 decisions')`
62. *guard* — `tests/band.test.tsx` · review round 3 (W3-R4) > F1 a failed Edit of a missing marker, cwd marker, plan dir missing: at most W + 3M fs calls — `expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)`
63. *guard* — `tests/band.test.tsx` · review round 3 (W3-R4) > F1 a failed Write of a new marker, cwd marker, plan dir missing: at most W + 3M fs calls — `expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)`
64. *red* — `tests/band.test.tsx` · review round 3 (W3-R4) > F3 a press on the row when the pane cannot open: nothing escapes — `expect(await bandText($)).toMatch(/run W1/)`
65. *guard* — `tests/band.test.tsx` · review round 3 (W3-R4) > D9 each check period: at most W + 2M fs calls, plan dir missing — `expect(fsCalls(log, n0).length <= 2 + 2 * 1).toBe(true)`
66. *guard* — `tests/band.test.tsx` · review round 4 (W3-R5) > N1 a failed Edit of a missing marker, no brief yet: at most W + 3M fs calls — `expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)`
67. *guard* — `tests/band.test.tsx` · review round 4 (W3-R5) > N1 a failed Write of a missing marker, no brief yet: at most W + 3M fs calls — `expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)`
68. *guard* — `tests/band.test.tsx` · review round 4 (W3-R5) > N1 a failed Edit of a missing marker, plan dir with neither file: at most W + 3M fs calls — `expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)`
69. *red* — `tests/band.test.tsx` · review round 4 (W3-R5) > N2 an Edit of a missing marker that another writer creates inside the call: drawn, no label — `expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER/)`
70. *red* — `tests/band.test.tsx` · review round 4 (W3-R5) > N3 a failed Write, the file already holding its text: drawn, no label — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W1 #fail · /)`
71. *red* — `tests/band.test.tsx` · review round 4 (W3-R5) > a successful Write whose before-call stat fails: drawn, no label — `expect(await bandText($)).toMatch(/^skills-x — the thing · run W1 · /)`
72. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > the marker is .shawarma/active-<ticket>, the ticket from its name — `expect(await bandText($)).toBe('skills-x — the thing · run W3 · since 14:00 · 2 decisions')`
73. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > D4 the old .shawarma/active is not read — `expect(log.filter(line => line === 'read ${ROOT}/.shawarma/active')).toEqual([])`
74. *guard* — `tests/band.test.tsx` · v2tm per-ticket markers > a name that is not active-<ticket> is no marker — `expect(await bandText($)).toBe(undefined)`
75. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > D1 a trivial marker: <ticket> · trivial · since HH:MM, no plan file read — `expect(log.filter(line => /^(list|read|stat|exists) .*docs/.test(line))).toEqual([])`
76. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > D1 a trivial marker: the pane reads "Trivial run: no brief" with the ticket — `expect(text).toMatch(/Trivial run: no brief/)`
77. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q4 many markers: the own tree first, then newest first, one Text each — `expect(all.map(line => line.split(' — ')[0])).toEqual(['own-1', 'a-1', 's-1'])`
78. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q4 a cwd inside a linked worktree: that tree is own — `expect((await texts($)).map(line => line.split(' — ')[0])).toEqual(['a-1', 'own-1'])`
79. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q4 two markers with the same mtime: ticket order — `expect(await texts($)).toEqual(['aa · trivial · since 14:00', 'zz · trivial · since 14:00'])`
80. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q4 one Button per row, keyed per ticket; a press opens the pane on that ticket, the header lists the others — `expect(text).toMatch(/^\*\*s-1 — sibling\*\* · run W2\n\nOther tickets: own-1\n\n### Recap\n\nrecap of s-1 — sibling/)`
81. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q4 /shawarma-companion opens the pane on the first row — `expect((await pane.find({ type: 'Markdown' }))?.props.text).toMatch(/^\*\*own-1 — mine\*\* · plan 2\n\nOther tickets: s-1/)`
82. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 a sibling-folder worktree is found by git worktree list — `expect(await bandText($)).toMatch(/^s-1 — sibling · run W2/)`
83. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > D3 prunable and bare records skipped; locked and detached read — `expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['l', 't'])`
84. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 git worktree list exits non-zero: the file-API fallback, main plus <main>/.worktrees/*, a sibling missed — `expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['m', 'a'])`
85. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 git worktree list prints garbage: the fallback — `expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['a'])`
86. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 process.run rejects for every command, cwd in main: main and .worktrees/* drawn, the sibling not (known limit) — `expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['m', 'a'])`
87. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 process.run rejects, cwd deep in a linked worktree under .worktrees: that tree first, then main — `expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['a', 'm'])`
88. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 process.run rejects, a linked worktree with no commondir file: gitdir/../.. is the common dir — `expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['a', 'm'])`
89. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 process.run rejects, cwd in a sibling worktree: its own tree, main and .worktrees/*, not other siblings — `expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['s', 'm', 'a'])`
90. *guard* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 process.run rejects, no .git up to /: nothing drawn — `expect(await bandText($)).toBe(undefined)`
91. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q2 the walk: one stat per level, kept per cwd across calls and turns — `expect(walkCalls(n0)).toEqual([])`
92. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > parseGitdir, resolvePath, parentOf — `expect([parentOf('/a/b'), parentOf('/a'), parentOf('/')]).toEqual(['/a', '/', '/'])`
93. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > D6 .shawarma missing, a file, or unreadable in one tree: the others still draw — `expect(await texts($)).toEqual(['m · trivial · since 14:00'])`
94. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > malformed markers: 1 line, 3 lines, empty, bad step, each its own row — `expect(await texts($)).toEqual(['one', 'three', 'empty', 'bad'].map(t => '${t === 'bad' ? 'earlier session: ' : ''}shawarma: ${t}: malformed marker'))`
95. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > parseMarker: trivial, and a plan dir that says trivial is not — `expect(parseMarker('skills-t\nTRIVIAL\n', ROOT)).toBe(null)`
96. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > parseWorktrees: records, flags, garbage — `expect(parseWorktrees('fatal: not a git repository\n')).toBe(null)`
97. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > order: own first, newest first, ticket on a tie — `expect(order([r('b', '/s', 5), r('a', '/s', 5), r('o', '/own', 1), r('c', '/s', 9)], '/own').map(x => x.ticket))`
98. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > D5 a marker as old as the session start reads earlier session; one newer than start + 1 ms reads current (F3) — `expect(found.map((one: any) => [one.text, one.props.dimColor])).toEqual([`
99. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > D2 a leftover marker stays, dimmed (a day old: stale, Q5), beside a live one — `expect(await texts($)).toEqual(['new-1 — live · plan 1 · since 14:00 · 0 decisions',`
100. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > a title not naming its ticket gets the ticket in front (Q1) — `expect(await bandText($)).toMatch(/^skills-q · Untitled thing · plan 1/)`
101. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > plan dir missing in one row only — `expect(await texts($)).toEqual(['ok-1 — here · plan 1 · since 14:00 · 0 decisions',`
102. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q3 W=3, M=2: per tool call at most W + 3M fs calls and one git worktree list per turn — `expect(runs()).toBe(2)`
103. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q3 W=3, M=2: per check at most W + 2M fs calls, no read, no process — `expect(calls.filter(line => /^(read|run) /.test(line))).toEqual([])`
104. *red* — `tests/band.test.tsx` · v2tm per-ticket markers > Q3 a sibling marker rewritten while idle: the row follows within 15 s, one marker read — `expect(log.slice(n0).filter(line => line.startsWith('read '))).toEqual(['read ${ROOT}/.shawarma/active-own-1', 'read ${SIB}/.shawarma/active-s-1'])`
105. *red* — `tests/band.test.tsx` · lane 3a fixes > F1 a worktree path holding "\n\nworktree /X" injects no tree (-z) — `expect(log.filter(line => line === 'list /X/.shawarma')).toEqual([])`
106. *red* — `tests/band.test.tsx` · lane 3a fixes > F1 a truncated worktree list is a failed list: the fallback — `expect(await names($)).toEqual(['m'])`
107. *red* — `tests/band.test.tsx` · lane 3a fixes > F1 parseWorktrees reads NUL-framed records, a "/" root kept as "/" — `expect(parseWorktrees('worktree /a\nHEAD 1\n\nworktree /b\nHEAD 2\n')).toBe(null)`
108. *red* — `tests/band.test.tsx` · lane 3a fixes > F1 a worktree at "/": its .shawarma is /.shawarma — `expect(log.filter(line => line.startsWith('list ') && line.includes('.shawarma'))).toEqual(['list /.shawarma'])`
109. *red* — `tests/band.test.tsx` · lane 3a fixes > F3 fractional mtimes against a whole-ms start: current only past start + 1 ms — `expect((await found($)).map(one => [one.text.replace(/ · since.*/, ''), one.dim])).toEqual([`
110. *red* — `tests/band.test.tsx` · lane 3a fixes > F5 clean blanks bidi controls — `expect(clean('a\u202Eb\nc', true)).toBe('a b\nc')`
111. *red* — `tests/band.test.tsx` · lane 3a fixes > F5 a ticket holding U+202E draws no bidi control — `expect(row?.text).toBe('ev il · trivial · since 14:00')`
112. *red* — `tests/band.test.tsx` · lane 3a fixes > F8 a walk that failed once is tried again at the turn end — `expect(await names($)).toEqual(['m'])`
113. *red* — `tests/band.test.tsx` · lane 3a fixes > F8 a walk that failed once is tried again at session start — `expect(await names($)).toEqual(['m'])`
114. *red* — `tests/band.test.tsx` · lane 3a fixes > F9 every process.run carries timeoutMs 2000 — `expect(inits.every((init: any) => init?.timeoutMs === 2000)).toBe(true)`
115. *red* — `tests/band.test.tsx` · lane 3a fixes > F9 git never answers: the tool call answers by 2 s on the clock, from the fallback — `expect(await names($)).toEqual(['m'])`
116. *red* — `tests/band.test.tsx` · lane 3a fixes > F10 plan dir missing, long path, 120 columns: the row keeps its ticket — `expect(row!.text.length <= columns).toBe(true)`
117. *red* — `tests/band.test.tsx` · lane 3a fixes > F10 malformed marker, 120 columns: shawarma: <ticket>: malformed marker — `expect(row!.text).toBe('shawarma: skills-mal: malformed marker')`
118. *red* — `tests/band.test.tsx` · lane 3a fixes > F10 plan dir missing, long path, 40 columns: the row keeps its ticket — `expect(row!.text.length <= columns).toBe(true)`
119. *red* — `tests/band.test.tsx` · lane 3a fixes > F10 malformed marker, 40 columns: shawarma: <ticket>: malformed marker — `expect(row!.text).toBe('shawarma: skills-mal: malformed marker')`
120. *red* — `tests/band.test.tsx` · lane 3a fixes > F10 rowText: the title and problem are cut before the ticket — `expect(text.startsWith('earlier session: skills-x')).toBe(true)`
121. *red* — `tests/band.test.tsx` · lane 3a fixes > the ticket prefix needs the exact ticket at the title start — `expect(await bandText($)).toMatch(/^skills-x · skills-x2 — other · plan 1/)`
122. *red* — `tests/band.test.tsx` · lane 3a fixes > a pane whose chosen ticket is gone says so, not another row — `expect(text).toMatch(/^s-1: no longer active/)`
123. *red* — `tests/band.test.tsx` · Q5 liveness (stale) > Q5 a run that crashed after the start reads current until 12 h, then stale on the check, no file change — `expect(log.slice(n0).filter(line => line.startsWith('read '))).toEqual([])`
124. *red* — `tests/band.test.tsx` · Q5 liveness (stale) > Q5 dated 2 min in the future: stale; 30 s in the future: current — `expect((await found($)).map(one => [one.text.replace(/ · since.*/, ''), one.dim])).toEqual([`
125. *red* — `tests/band.test.tsx` · Q5 liveness (stale) > Q5 both earlier and stale: stale wins — `expect((await found($)).map(one => [one.text.replace(/ · since.*/, ''), one.dim])).toEqual([`
126. *red* — `tests/band.test.tsx` · Q6 cost bounds and caps > Q6 W=3, M=2: cold (session start; every plan file changed) <= W + 4M, steady <= W + 2M, check <= W + M — `expect(fsCalls(log, n0).length <= W + Mk).toBe(true)`
127. *red* — `tests/band.test.tsx` · Q6 cost bounds and caps > Q6 W=6, M=4: cold (session start; every plan file changed) <= W + 4M, steady <= W + 2M, check <= W + M — `expect(fsCalls(log, n0).length <= W + Mk).toBe(true)`
128. *red* — `tests/band.test.tsx` · Q6 cost bounds and caps > Q6 50 worktrees: all scanned, no more-row — `expect((await texts($)).map(one => one.text).filter(text => text.includes('more not shown'))).toEqual([])`
129. *red* — `tests/band.test.tsx` · Q6 cost bounds and caps > Q6 51 worktrees (FAIL size): 50 scanned, the own tree among them, one dimmed "1 worktree not scanned" (N3) — `expect(rows.at(-1)).toEqual({ text: '1 worktree not scanned', dim: true })`
130. *red* — `tests/band.test.tsx` · Q6 cost bounds and caps > Q6 20 markers: 20 rows, no more-row — `expect(rows.filter(one => one.text.includes('more not shown'))).toEqual([])`
131. *red* — `tests/band.test.tsx` · Q6 cost bounds and caps > Q6 21 markers (FAIL size): 20 read and drawn, the oldest own-tree marker kept, "+1 more not shown", no read for the 21st — `expect(fsCalls(log, 0).length <= 2 + 4 * 20).toBe(true)`
132. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N1 a chosen ticket pushed past the 20-row limit: "not shown", not "no longer active" — `expect(await paneOf(pane)).toBe('k5: no longer active')`
133. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N2 a stale chosen row: the pane title carries "stale: ", the header labels the others — `expect(await paneOf(await mountPane($))).toMatch(/^stale: \*\*dead — x\*\* · run W2\n\nOther tickets: old \(stale\)\n\n### Recap/)`
134. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N2 an earlier-session chosen row: labelled in the pane; a current other listed bare — `expect(await paneOf(await mountPane($))).toMatch(/^earlier session: \*\*old\*\* · trivial\n\nOther tickets: live\n\nTrivial run: no brief/)`
135. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N3 the only marker in an unscanned 51st tree: one dimmed "1 worktree not scanned" row — `expect(await band($)).toEqual(['1 worktree not scanned'])`
136. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N3 markers in tree 1 and 51: the row counts no unlisted marker — `expect(await band($)).toEqual(['one · trivial · since 14:00', '1 worktree not scanned'])`
137. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N3 52 trees, none past 50 holding markers: "2 worktrees not scanned", no "+n" — `expect(await band($)).toEqual(['one · trivial · since 14:00', '2 worktrees not scanned'])`
138. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N3 both caps: "+1 more not shown · 1 worktree not scanned" — `expect(rows[20]).toBe('+1 more not shown · 1 worktree not scanned')`
139. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N4 a hidden marker touched each period: no refresh, each check <= W + M — `expect(ops).toEqual([21, 21, 21, 21])`
140. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N4 a hidden marker rewritten to the newest: drawn within 15 s — `expect((await band($))[0]).toMatch(/^k0 · trivial/)`
141. *red* — `tests/band.test.tsx` · lane 3a round 2 fixes > N6 clean blanks U+2028 and U+2029 — `expect(clean('a`
142. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-1 the chosen marker's tree moved past 50 worktrees: "not shown (not in the last scan)" — `expect(await paneText($)).toBe('x: not shown (not in the last scan)')`
143. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-2 the chosen marker cannot be read: "could not be read" — `expect(await paneText($)).toBe('a: could not be read')`
144. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-1 the chosen marker deleted, every tree scanned: "no longer active" — `expect(await paneText($)).toBe('a: no longer active')`
145. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3 reload window: rows and chosen kept in state, no listing since load: "not in the last scan" — `expect(await paneText($)).toBe('b: not shown (not in the last scan)')`
146. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-3 a failed refresh: "Shawarma state could not be read." — `expect(await paneText($)).toBe('Shawarma state could not be read.')`
147. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-3 no marker anywhere: "No shawarma marker in the last scan." — `expect(await paneText($)).toBe('No shawarma marker in the last scan.')`
148. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-3 only the more-row: the pane names it, and the 15 s check still runs — `expect(await band($)).toEqual(['later · trivial · since 14:02', '1 worktree not scanned'])`
149. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-3 only the more-row drawn: the 15 s check still runs — `expect(await band($)).toEqual(['later · trivial · since 14:02', '1 worktree not scanned'])`
150. *red* — `tests/band.test.tsx` · lane 3a round 3 fixes > R3-4 a stale malformed marker: the band row carries "stale: " as the pane does — `expect(await band($)).toEqual(['stale: shawarma: bad: malformed marker'])`
151. *red* — `tests/band.test.tsx` · Q5 boundaries (lane 3a R-A6) > isStaleAt: age exactly 12 h current, 12 h + 1 ms stale; +60000 ms ahead current, +60001 stale — `expect([isStaleAt(now - H12, now), isStaleAt(now - H12 - 1, now), isStaleAt(now - H12 + 1, now),`

**Existing tests that change** (plan step 2). The base-tree reading is the final test file on the base modules (with the stubs named below), executed:

| test | why it breaks | new expectation | reading on the tests-commit tree (executed) |
|---|---|---|---|
| every existing test with `MARKER` | the marker is `/repo/.shawarma/active-skills-x` (2a, D4) | the same text at the new path | red where a row is expected (the base draws none), e.g. test 2 `toBe` fails with `undefined` |
| marker written through Bash; changed by a call not naming it; another session after start (tests 3, 4, 6) | `unconfirmed:` dropped (Q1) | no label | red ×3 |
| a worktree's marker is drawn (test 7, was "worktree marker written by path wins") | no Write/Edit claim; trees from `git worktree list` (Q1, Q2) | drawn | red |
| a Write of a relative marker path is drawn; an Edit of the marker path is drawn (tests 14, 20, was "…is this session's") | no own write (Q1) | renamed only | red ×2 |
| earlier-session rows are dimmed, current rows are not (test 17) | `unconfirmed:` dropped | third step not dimmed | red |
| another writer inside a Write; replaced with the same mtime; turn end re-reads; replaced while idle; reload kept in state (tests 21, 22, 23, 25, 56) | no label; mtimes moved from 8–15 min ahead to `STARTED + 130_000` (Q5: future → stale); reload seeds `rows` | `^skills-x — the thing · run …` | red ×5 |
| unchanged files: at most W + 2M (test 27) | the check lists instead of statting (2g) | 4 lists of `/repo/.shawarma`, 0 reads | red |
| no row drawn: no check runs; band off: no check runs (tests 28, 29) | no stat now | the log length does not move | guard ×2 (green on the base) |
| pane on: press opens the pane; F3 a press when the pane cannot open (tests 32, 64) | keys per ticket (Q4) | key `row:skills-x` | red ×2 (`HooksError: no Button … keyed "row:skills-x"`) |
| pane off (test 33) | log filter adds `list` and `run` | `[]` | guard |
| parseMarker; exactly two lines (tests 34, 35) | second argument is the tree root; `kind` field (2a) | `{ kind: 'plan', planDir, step }` | red ×2 |
| two markers, at most W + 3M; one marker Write; F1 ×2; N1 ×3; D9 (tests 42, 43, 62, 63, 65, 66, 67, 68) | 3e replaced (Q3, Q6) | the old names keep a stricter `<= 2 + 3·1` pin | guard ×8 (vacuous on the base: it reads no `active-*`) |
| row, gone, row again (test 55) | counts lists, not stats | 4 lists | red |
| F2 a worktree marker and the cwd marker (test 57) | one row per marker (Q4) | two rows, own first, `skills-x · tree plan · run W1` | red |
| F2 an Edit, N2, N3, a successful Write (tests 58, 69, 70, 71) | no own write (Q1) | drawn, no label | red ×4 |
| malformed marker (test 11) and malformed ×4 (test 94) | F10, R3-4 wording | `shawarma: skills-x: malformed marker`; the fourth reads `earlier session: shawarma: bad: …` (F3) | red ×2 |
| F5 a malformed marker: the pane (test 60) | F10 pane wording | `shawarma: skills-x: malformed marker (/repo/.shawarma/active-skills-x)` | red |
| F6 plan dir created while idle (test 61) | exact ticket prefix | `skills-x · 2026-10-16-skills-x-thing · …` | red |
| Q4 one Button per row; Q4 the command (tests 80, 81) | `Other live tickets:` → `Other tickets:` (N2) | `Other tickets: own-1` | red ×2 |
| D5 and F3 (test 98) | current only past start + 1 ms | the current marker at `STARTED + 2` | red |
| D2 a leftover (test 99) | Q5: a day old reads `stale:` | `stale: old-1 — crashed …` | red |
| parseWorktrees (test 96) | NUL framing (F1) | NUL-framed input | red |
| Q6 51 worktrees (test 129) | N3 units | `1 worktree not scanned` | red |


Predicted red set on the tests commit (plan step 2's run, pasted): the final test file with the base modules from `git show f1fc87e:mods/shawarma-companion/hooks/{model.ts,register.tsx}` and `types/index.d.ts`, plus stubs appended to the base `model.ts` so the file links (`export const order: any = () => []`, `parseWorktrees`, `parentOf`, `parseGitdir`, `resolvePath`, `isStaleAt`, each `() => undefined`):

```
 26 pass
 125 fail
Ran 151 tests across 1 file. [2.32s]
 111 AssertionError
  10 HooksError   ($.ui.press: no Button … is drawn — the base draws no row)
   4 TypeError    (undefined is not an object (evaluating 'row.text') — the base draws no row)
red per describe: band 9 · band, more 7 · writes of the marker 4 · session start 1 · check every 15 s 3 · pane 3 · model 2 · review round 1 9 · review round 3 6 · review round 4 3 · v2tm per-ticket markers 31 · lane 3a fixes 18 · Q5 liveness 3 · Q6 cost bounds and caps 6 · lane 3a round 2 fixes 10 · lane 3a round 3 fixes 9 · Q5 boundaries 1
```

**the 125 items marked *red* above**; guards green (the 26 marked *guard*).

## 5. Accept gate

- suite, lint and review per run steps 3–4
- live-data run: `DRY-RUN ON STAND-IN` (G4): a scratch repo with a sibling worktree and two synthetic markers; no real plan data is read. Observations with no rule: the probes P1 and P2 of §2.
- rules, written now:
- **G1** mod tests: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin test mods/shawarma-companion`, reading the `N pass` and `M fail` lines. Dataset: the 151 synthetic tests of `tests/band.test.tsx`, read in aggregate. Settle: read once on the final commit. PASS: `0 fail`. Dry-run reading with the fix patched in (the sketch in `.worktrees/v2tm-spike`): `151 pass` / `0 fail` / `Ran 151 tests across 1 file. [3.24s]`. FAIL reading on the base modules (with the §4 stubs): `26 pass` / `125 fail`. Cannot run: a folder with no test file reads `claude plugin test: no *.test.ts or *.test.tsx under <dir>`, exit 1; a missing folder `claude plugin test: /nonexistent-dir: no such plugin folder`, exit 1 — no `pass` line, which differs from PASS.
- **G2** manifest and state contract: `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude plugin validate mods/shawarma-companion`, reading the last line. Dataset: the mod folder, one case. Settle: read once. PASS and dry-run reading with the fix patched in: `✔ Validation passed`, exit 0. FAIL reading on a named wrong fix (the `hidden` key dropped from `types/index.d.ts`): `✘ Validation failed`, `shawarma-companion.hidden is not declared: the manifest's types contract must name it`, exit 1. Cannot run: a missing folder reads `✘ Found 1 error:` / `✘ Validation failed`, exit 1 (the cannot-run trace is the `Validating plugin manifest: <dir>` line naming the wrong folder).
- **G3** types: `npx --offline -y -p typescript@5 tsc -p <tsconfig>`, reading the exit code and `error TS` lines, where `<tsconfig>` is `mods/shawarma-companion/tsconfig.json` once the engine has laid `.claude-plugin/types/`, else a copy outside the repo whose `include` names the types file `plugin-authoring/types/claude-code.d.ts@2.1.316` and the mod's `hooks`, `types`, `tests` (pi0y G3 recipe). Dataset: the mod's three source folders, one case. Settle: read once. PASS and dry-run reading with the fix patched in: exit 0, no output. FAIL reading on a named wrong fix (`step: 'trivial'` → `step: 1` in `rowOf`): exit 2, `hooks/register.tsx(200,67): error TS2322: Type 'number' is not assignable to type 'string'.`. Cannot run: the types path wrong reads exit 2 with 336 errors, among them `error TS2307: Cannot find module 'claude-code'` ×3 and `'claude-code/testing'` ×1 — the TS2307 trace tells it from a FAIL.
- **G4** real engine: `DRY-RUN ON STAND-IN`. From a scratch repo (`git init`, one sibling worktree by `git worktree add --detach <repo>-sib`, `.shawarma/active-skills-zz` = `docs/plans/p` / `plan 2 spike` with `plan.md` and a 2-row `decisions.md`, and `<repo>-sib/.shawarma/active-skills-yy` = `skills-yy` / `trivial`), run `CLAUDE_CONFIG_DIR=$HOME/.claude-personal claude -p "/v2tmdump" --plugin-dir <stand-in>/shawarma-companion`, where the stand-in is the mod plus one command `v2tmdump` that refreshes and prints `rowText` of each row and the more-row; reading the `v2tmdump rows=<n>` line and the rows. Dataset: that stand-in repo, read case by case. Settle: read once. Dry-run reading with the fix patched in: `shawarma-companion: v2tmdump rows=2` / `earlier session: skills-zz — stand-in plan · plan 2 spike · since 19:26 · 2 decisions` / `earlier session: skills-yy · trivial · since 19:26` (both written before the session started). FAIL reading on the base modules (the same stand-in command reading `snap`): `shawarma-companion: v2tmdump rows=0` / `(no row)`. Cannot run: a missing `--plugin-dir` reads the model's reply `` `/v2tmdump` didn't run and nothing was changed. `` with no `v2tmdump rows=` line, exit 0, and costs one model turn.
- orchestrator follow-ups: the owner's DEFAULT on S1 (F4, same-mtime rewrite); skills-mvfd (session id in the marker); a version bump of `mods/shawarma-companion/.claude-plugin/plugin.json` and the marketplace entry at release (no file in §3 holds it).

## 6. Worst impact

A hostile worktree path or marker in a repository the session runs in draws a forged row as a current run (a newline path once injected a tree, A3), or a hung git holds each turn end; ⇒ adversarial lane (3a ran three rounds at plan time), then the code-review lane 3b on the diff.

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | §6's worst impact and §3's error surface, by attacks of the lane's own design · the `NOT RUN` lines A2, A8, B5, E6, and the Partition and Sources rows reading NOT RUN, a planner re-run included · the hostile corpus · the `enumerate:` rows not pinned as §4 tests A5, C5, E18, only where the implementation differs from §2's executed sketch (the orchestrator pastes the diff); executed, each finding with a reproduction and marked `listed` or `own` |
| 3b code review | read-only, scratch dir | the `mutant:` rows below · invariants and this brief · claims check on prose · §3's error surface, by attacks of its own |

Attack lines (ids as in §2 Attack readings):

- A1 hostile marker names (`active-`, 4096×z, U+202E, `a\nb`, `.active-dot`, `active-..`, a dir, a link to `/etc/passwd`, a FIFO) → oracle hand table of expected rows
- A2 hostile plan dirs and texts (`/etc`, `../../..`, 10 MB, 4 MiB−1, CRLF, NUL, bidi step, a symlinked dir) → oracle hand table of expected rows
- A3 real porcelain with a path `a\n\nworktree <S>/evil`, a locked reason with a newline, `/`, a relative path, 1000 records → oracle real git output fixture
- A4 fallback with `gitdir: /`, a long `commondir`, `/etc/.git`, a 10 MB `.git`, cwd `/`, depth 200, a transient read failure → oracle hand-walked paths
- A5 enumerate: 512 length-3 sequences over {appear, sameMtime, delete, wtAdd, wtRemove, runFails, turnEnd, check}, source lane 3a round 1 → oracle independent recomputation from the fake fs
- A6 mtime `==` start, `+0.5`, `−0.5`, `+1 year`, a crashed sibling after start over 6 h of checks → oracle Q5 and D5 rule table
- A7 W=1..8 × M=0..8 and M=16…4096 → oracle W+4M, W+2M, W+M counts
- A8 each of list, read, stat, exists, run, usage, cwd, open, register rejecting → oracle hook answers and §3 error surface
- A9 a `process.run` that never resolves; a real `sleep 31` → oracle the kit clock and the real wall clock
- A10 cwd `/tmp` against git `/private/tmp`, kit and real engine → oracle the real engine's resolved paths
- B1 real prunable and locked worktrees → oracle D3
- B2 plan dir not readable, real `chmod 000` → oracle Q1 (each row names its ticket)
- B3 real `.git` file with `process.run` denied → oracle Q2 fallback roots
- B4 real engine, full mod, marker in the own tree → oracle the stand-in dump
- B5 module state across a reload → NOT RUN (the kit cannot reload)
- C1 hostile names, round 2 (empty, 4096×z, U+202E, U+2066/U+2069, `a\nb`, U+2028, 70 emoji, `..`) → oracle bidi and separator regex over the drawn text
- C2 bidi in step, title, LRI title, plan dir → oracle bidi regex over band and pane
- C3 `-z` parser and git answers (exit 129, exit 0 newline form, empty, truncated) → oracle real `-z` fixture and the fallback roots
- C4 F8 retry after a transient failure; no repository → oracle walk call counts per turn
- C5 enumerate: 1000 length-3 sequences over {appear, sameMtime, delete, wtAdd, wtRemove, runFails, turnEnd, check, h12, future}, source lane 3a round 2 → oracle independent recomputation of rows, labels and order
- C6 Q5 boundaries (12 h exact, ±1 ms, +60000, +60001, +60000.5) → oracle Q5 rule table
- C7 caps and costs (50/51/52 trees, 20/21 markers, W=60 M=30, W=100 M=200, hidden marker touched) → oracle Q6 bounds and the more-row units
- C8 cost.md spot-check W∈{8,64} × M∈{8,256}, 10 calls each → oracle min(W,50) + 2·min(M,20)
- C9 git hang, late answer, early answer, turn end → oracle the kit clock at 1999 and 2000 ms
- C10 pane after a push past 20 rows; a stale chosen row → oracle 2i reasons and labels
- E1 chosen pushed past 20 → oracle 2i reasons
- E2 chosen deleted → oracle 2i reasons
- E3 chosen tree reordered past 50 trees → oracle 2i reasons
- E4 chosen marker read fails → oracle 2i reasons
- E5 refresh fails after a press → oracle 2i empty-band texts
- E6 `lastScan` across a real reload → NOT RUN (the kit cannot reload)
- E7 stale, earlier, current, malformed chosen → oracle 2c labels on band and pane
- E8 only marker in tree 51 → oracle 2f more-row and 2g check
- E9 `moreText` units → oracle 2f wording
- E10 25 markers, 52 trees, 20 columns → oracle 2d width
- E11 hidden marker touched, stays hidden → oracle W+M check count
- E12 hidden marker rises into the top 20 → oracle 2e order within 15 s
- E13 two hidden markers swap times → oracle W+M check count
- E14 hidden marker deleted → oracle 2f count within 15 s
- E15 own tree's oldest marker rewritten → oracle 2e own first
- E16 one of the top 20 unreadable → oracle D5 (b)
- E17 U+2028, U+2029, U+0085 in ticket, step, title, recap → oracle 2j
- E18 enumerate: the C5 1000 sequences re-run on the round-3 sketch, source lane 3a round 3 → oracle independent recomputation of rows, labels and order

Mutants for 3b (executed on the final §4 files; outputs under the planner's scratch `brief/`):

- mutant: `return now - at > STALE_MS` → `return now - at >= STALE_MS` in `model.ts isStaleAt` → red: Q5 boundaries > isStaleAt: age exactly 12 h current … (150 pass, 1 fail) (`reports/mutants/mutant-m1.txt`)
- mutant: `export const MAX_ROWS = 20` → `21` → red: Q6 21 markers (FAIL size); N1 chosen pushed past the 20-row limit; N3 both caps; N4 a hidden marker touched each period (147 pass, 4 fail) (`reports/mutants/mutant-m2.txt`)
- mutant: `['git', 'worktree', 'list', '--porcelain', '-z']` → without `'-z'` → red: 26 tests, among them Q4 many markers, Q2 a sibling-folder worktree, D3 prunable and bare, Q6 ×6, N3 ×4, R3-1, R3-3 ×2 (125 pass, 26 fail) (`reports/mutants/mutant-m3.txt`)
- mutant: `{ cwd, timeoutMs: RUN_MS }` → `{ cwd }` → red: F9 every process.run carries timeoutMs 2000 (150 pass, 1 fail) (`reports/mutants/mutant-m4.txt`)
- mutant: `[U+061CU+200EU+200FU+202A-U+202EU+2066-U+2069U+2028U+2029]` → `[U+2028U+2029]` in `clean` → red: F5 clean blanks bidi controls; F5 a ticket holding U+202E (149 pass, 2 fail) (`reports/mutants/mutant-m5.txt`)
- mutant: `isEarlier: !(at > startedAt + 1)` → `isEarlier: !(at > startedAt)` → red: malformed markers ×4; F3 fractional mtimes (149 pass, 2 fail) (`reports/mutants/mutant-m6.txt`)

## 8. Out of scope

- skills-mvfd: the session id in the marker (Q1's retro proposal); the marker format here has no session line.
- skills-lhdg: cleanup of markers left by a crash (D2 carried); this change only labels them `stale:`.
- VS Code: no mod surface (pi0y D1).
- The shawarma skill's own text (`skills/shawarma/SKILL.md`): changes only at a retro.
- The plugin and marketplace version strings: bumped at release, outside this diff.
- Out-of-diff review findings: ticket, unless they show wrong output in a row or pane this diff draws.

Plan ending (2026-11-02): the brief. Its open items are DEFAULTs; the go accepts each, a struck one becomes a RULING at Wave 0.

> **What this is about:** a sibling session's marker rewritten with the same time stamp is caught at the next tool call or turn end, not by the 15 s check (S1).

unruled: D7 same-mtime rewrite missed by the 15 s check — default accept: the check stays listing-only; this machine's file system stores sub-millisecond times, so it was reached only by a forced `touch -m` (lane 3a A5, 84 of 1200 points)

> **What this is about:** at a width below the label plus the ticket, the ticket is cut before the label (S2).

unruled: D8 very narrow rows cut the ticket before `stale:` — default accept: below about 20 columns only

> **What this is about:** a drawn marker whose plan files cannot be read is dropped from the band, not replaced or counted, and the pane says it could not be read (S3).

unruled: D9 an unreadable drawn row is dropped, not counted — default accept: the acceptable error direction (no row) of D5

> **What this is about:** eight carried-over tests still say "W + 3M" in their names while asserting a stricter count.

unruled: D10 test names that say W + 3M — default rename them to the Q6 bounds in the tests commit, assertions unchanged

> **What this is about:** a marker can name a plan folder anywhere on disk, and the mod then reads its plan.md and decisions.md; a cloned repo could ship such a marker.

unruled: D11 plan folders outside the marker's own tree — default refuse them: the plan dir, path-normalised, must sit under the marker's tree root, else a problem row `<ticket>: plan dir outside its tree` that reads no file (replaces pi0y L6's "a plan dir outside the repo shows its name; reads only")

> **What this is about:** the pane follows a symlinked plan.md that the band skips.

unruled: D12 pane and band read the same files — default the pane reads only entries its plan-dir listing shows as regular files that are not links, else treats them as missing

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why (reads without the conversation: no id this brief does not define) |
|---|---|---|---|---|---|
| W0 | 2026-11-02 | default | base | `f1fc87e` → `b882344` | `git diff --name-only f1fc87e b882344` ∩ the mod files the sketch changes and §4's test file: none (the diff holds the plan folder and the ticket only) · reds not needed; the tests commit `46557be` read 26 pass / 125 fail anyway, its red set equal by name to §4's 125 reds |
| D7 | 2026-11-02 | default (accepted by the go) | §2 What the planner saw (S1) | open → accepted: the 15 s check stays listing-only; a same-time rewrite of a marker shows at the next tool call or turn end | the check reads no file when nothing listed changed (Q3, Q6); this machine's file system stores sub-millisecond times, and the case was reached only by a forced `touch -m` |
| D8 | 2026-11-02 | default (accepted by the go) | §2 What the planner saw (S2) | open → accepted: below about 20 columns the ticket is cut before the label | each row still names its ticket at 20 columns |
| D9 | 2026-11-02 | default (accepted by the go) | §2 What the planner saw (S3) | open → accepted: a picked row whose files cannot be read is dropped, not replaced or counted; the pane says `could not be read` | drawing less is the acceptable error direction (D5 b) |
| D10 | 2026-11-02 | default (accepted by the go) | §4 tests 42, 43, 62, 63, 66, 67, 68, 102 | names `… at most W + 3M fs calls[ (Q3)]` → `… at most W + 3M fs calls, inside the Q6 bound W + 4M[ (Q6)]`; assertions unchanged | the names cited a bound Q6 replaced; applied in the tests commit `46557be` |
| D11 | 2026-11-02 | the owner (the go, after the plan ending quoted this change) | §3 2a; error surface | 2a "the plan dir, absolute or `under(tree, line1)`" → the plan dir is `resolvePath(tree, line1)`; when it is neither the tree root nor under it (a `/` boundary, so `/repo-evil` is outside `/repo`), the row is `[label]shawarma: <ticket>: plan dir outside its tree`, `planDir` empty, and no file there is listed or read by the refresh, the check or the pane; the pane line is `[label]shawarma: <ticket>: plan dir outside its tree (<marker path>)` | a marker in a cloned repo could name any folder on disk and have its `plan.md` and `decisions.md` read and shown; replaces pi0y L6's "a plan dir outside the repo shows its name; reads only". It edits a frozen §3 line, so it is recorded as a ruling. Tests: describe `v2tm amendments (D11, D12)`, the seven D11 tests (commit `e4d922c`) |
| D12 | 2026-11-02 | default (accepted by the go) | §3 2i (pane reads) | the pane read `plan.md` and `decisions.md` after a `$.fs.stat`, which follows links → it lists the plan dir once and reads a file only when the listing shows it as kind `file` and not a link, else treats it as missing; a plan dir that does not list and does not exist reads both as missing; one that exists and does not list reads `The plan files could not be read: <error>`; the band's plan-dir listings also skip links | the band already read only listed regular files; the pane followed a linked `plan.md` to any file on disk. Tests: the three D12 tests (commit `e4d922c`) |
| R1 | 2026-11-02 | the owner ("Go with recos") | §3 2a (D11's check), 2h (Q6 cold bound), error surface | D11 compares the folded path text with the tree root → the plan dir's real path, from one `$.fs.stat(dir, { resolve: true })` cached per marker path and marker time, is compared with the tree root (`isInside`); with no real path (the stat rejects or gives none) the text check stands. A call that reads a new or rewritten marker costs at most W + 5M file calls (was W + 4M); a call where only plan files changed stays at most W + 4M, a steady call W + 2M, a check W + M | a symlinked folder inside the tree led a plan dir anywhere on disk, and band and pane showed its `plan.md` and `decisions.md` (review round 1, both lanes, real engine); the same check refused an absolute line 1 spelled `/tmp/…` where git gives `/private/tmp/…`. Residue: a link swapped later without the marker changing is seen only when the marker changes. Executed cost before the fix: cold 13 of 11 and 26 of 22 at W=3,M=2 and W=6,M=4 |
| R2 | 2026-11-02 | the owner ("Go with recos") | §3 2i (pane with no row) | `Shawarma state could not be read.` · `No scan has run since the mod loaded.` · `No row drawn: <more-row text>` · `No shawarma marker in the last scan.` → the same, with `<n> marker could not be read.` / `<n> markers could not be read.` before `No row drawn` and the last one, when the last scan listed markers whose files failed to read | the pane said "No shawarma marker in the last scan." while the scan had listed a marker it could not read (review round 1, lane 3b) |
| R1a | 2026-11-02 | the owner (R1) | §4 D11 tests (describe `v2tm amendments (D11, D12)`) | their filters forbade any `exists`, `stat`, `read` or `list` at an outside path → the same, except the one `stat <dir> resolve` R1 asks | R1 requires that stat even where the text check says outside (the `/tmp` test); D11's text bars listing and reading only. Found by the round-2 implementer lane; pre-fix code with the edited tests still reads the same 7 reds |
| R3 | 2026-11-02 | the owner ("Go with reco") | §3 2a (D11 and R1's check), 2b (roots), 2h (cost), error surface; §4 R1 and R1a tests | R1's check (one `stat(dir, {resolve})` per marker path and time, `isInside(root, real ?? dir)`) → (1) `isInside(root, dir)` on the folded text first: outside as written → the problem row with no file call; (2) inside as written → `stat(dir, {resolve})` raced against `RUN_MS` (2 s): a `realPath` is cached per marker path, marker time and plan dir, and the dir is inside iff `isInside(realRoot, realPath)`; an answer with no `realPath`, or no answer in 2 s, reads outside and is not cached; a stat that rejects (the folder missing) is not cached and the row goes on as before (`plan dir not found` / `not readable`); (3) each scanned tree root's real path is resolved once per discovery (per cwd per turn, the same cache as `git worktree list`), the root as given when it has none; (4) cost: the first refresh of a turn may add one stat per scanned tree, and each row whose plan folder is missing one stat per refresh; the 15 s check adds none. Tests that change: the `/tmp`-spelled absolute line 1 now reads `plan dir outside its tree`; a withheld real path now reads outside; R1a's allowance is withdrawn (no call at an outside-spelled path) | the round-2 check stat'ed any marker-spelled path before containment (automated security review), cached a missing folder's empty answer so a link made later led outside (lane r2 A), and compared with an unresolved root so inside folders were refused (lane r2 B). Residue: an absolute line 1 spelled through a link (`/tmp/…`) is refused (safe direction; the skill writes relative paths); a link swapped while the marker is unchanged |
