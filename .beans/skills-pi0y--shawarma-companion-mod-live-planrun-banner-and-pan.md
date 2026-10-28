---
# skills-pi0y
title: 'shawarma companion mod: live plan/run banner and pane'
status: in-progress
type: feature
priority: normal
tags:
    - shawarma
    - mod
created_at: 2026-10-16T18:08:30Z
updated_at: 2026-10-28T10:49:29Z
---

A Claude Code mod that shows, while a shawarma plan or run is active, which ticket is in progress, what step it is at, and the decisions made so far. It ships in this repo's marketplace as a second plugin next to `strandic`.

## Why

Research on 2026-10-16 found no existing mod or status line that shows plan progress or a decisions log. Project path and context use are already well covered by claude-hud (28.6k stars) and ccstatusline (13.3k), both of which let you turn segments on and off. So this mod covers only what is specific to shawarma and leaves the generic parts to those tools.

Facts about the mod API (build 2.1.301):
- There is no top banner. The always-visible place is the band above the prompt (`AbovePrompt`), which all mods share. A pane is a sidebar in fullscreen layout and sits inline otherwise. The VS Code extension does not draw the band.
- `$.fs` reads any file, `$.session.cwd()`/`root` give paths, `$.session.usage()` gives context tokens and percent, and `tool.call` hooks see edits as they happen.

## Rulings (owner, 2026-10-16)

1. **Decisions are written as they are made (option 1a).** Shawarma itself records each RULING and DEFAULT in a file when it is decided. The mod does not try to guess decisions from the transcript. At Wave 4 the PR's Decisions table is built from this file.
2. **A marker file names the active plan.** Shawarma writes it at the start of a plan or run and removes it at the stop. The mod does not search for the newest plan.md.
3. **Same repo.** The mod lives here, versioned with the skill.

## Change to the method (shawarma)

- [ ] Marker: `.shawarma/active` at the root of the working tree, holding the plan dir path and the phase (`plan` or `run`). Gitignored. Written at plan step 1 and run Wave 0 (the run is in its own worktree, so it gets its own marker), and removed at the stop.
- [ ] Decisions file: `decisions.md` in the plan dir, one line appended per RULING or DEFAULT: `<date> | RULING|DEFAULT | <decision> | <why>`. Run Wave 4 builds the PR Decisions table from it, instead of writing the table from memory.
- [ ] Step tracking: the mod needs the current step. Either the marker's phase line is updated at each plan step and run wave (`plan 2 spike`, `run W3 review`), or the mod infers it from §9 rows and commits. Prefer updating the marker: it is one write per step and leaves nothing to guess.
- [ ] Size check: these edits must stay within the round-7 plan-load target (skills-p4oc, plan ≤ 6.5k tokens). If they don't fit, the marker and decisions writes go into house rules, not SKILL.md.

## The mod

Location: `mods/shawarma-companion/` (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.tsx`, `types/index.d.ts`), with an entry in `.claude-plugin/marketplace.json`.

- [ ] **Band row**, drawn only while `.shawarma/active` exists, otherwise `next(e)` so it takes no space: `<ticket> <short name> · <phase step> · <n> decisions · <k> unruled`. Fits on one line at the band width (`bodyColumns`), and cuts the name first when space is short.
- [ ] **Pane**, opened with `/shawarma-companion` (and by clicking the row where clicks work):
  - the recap: brief §1
  - the decisions so far, from decisions.md
  - the §9 amendments
  - the predicted red set, if there is one
- [ ] **Refresh:** re-read the files when a `tool.call` writes or edits a path under the plan dir or the marker, and on `session.start`. No polling timer.
- [ ] **Optional context field** in the row (`ctx 42%` from `$.session.usage()`), off by default.
- [ ] **Settings** through `userConfig`: `band` (on), `pane` (on), `context` (off).
- [ ] Missing or malformed files show a short line saying which file is missing; the mod never throws.

## Done when

- [ ] `claude plugin validate mods/shawarma-companion` is clean, and `tsc -p` passes.
- [ ] `claude plugin test` covers: no marker → empty band; marker plus plan → row text; an edit of decisions.md updates the count; a malformed marker → a short error line; each setting turned off.
- [ ] One real shawarma plan run with the mod loaded, with a screenshot of the band and the pane in the retro record.
- [ ] README: install line `/plugin install shawarma-companion@strandic` and a note that path and context are better covered by claude-hud or ccstatusline.

## Open

- Does the marker stay out of the repo (gitignored) or get committed with the plan? Default: gitignored, because it is per-session state.
- Pane layout in VS Code, where there is no band: the pane only, opened by the command.


## Design interview (2026-10-16)

Research: plan step 1 lane (mod API types 2.1.301, plugin CLI, marketplace probe, shawarma files). Size reading: `python3 scripts/size_paths.py skills/shawarma <out> && claude-personal --plugin-dir <out> plugin details szp` → plan-brief ~7.1k, run ~7.1k today; with a ~70-word "State files" section in SKILL.md → ~7.2k / ~7.2k.

- **R1 (method text placement).** Asked: SKILL.md (+0.1k, gap to the 6.5k R0 target grows ~0.6k → ~0.7k, absorbed by round 8 / skills-jk6n) vs the mod injecting the text vs a split. Owner: "Go with reco" → the state-files text goes in SKILL.md. The bean's "else house rules" fallback is struck (house rules live in each user's repo). Residue: note on skills-p4oc / skills-jk6n.

- **R2 (marker location).** Asked: per-tree `.shawarma/active` with a self-ignoring `.shawarma/.gitignore` (`*`), mod follows Write/Edit paths ending `.shawarma/active` this session and checks only the cwd's git root at session start vs one marker in the main checkout vs inside the git dir. Reading: scratch repo, `git status --porcelain` empty, `git check-ignore -v` → `.shawarma/.gitignore:1:*` for both files. Owner: "Go with reco" → option 1.

- **R3 (error directions).** (a) shows false state: stale or un-updated marker → corrupts, never allowed; (b) shows less: marker never written → empty band. Asked: age on every row + `earlier session:` dimmed label when `mtimeMs < $.session.usage().startedAt` (T:2897) vs this-session markers only vs no age. Owner: "Go with reco" → option 1; residue: a test for the dimmed earlier-session row.
- **DEFAULT D1.** VS Code draws no mod UI today (T:3955, T:10797): the "pane only in VS Code" line is struck; README says terminal and desktop only.

- **R4 (shipping).** retro.md:3: the skill changes only at a retro; method part and mod share no file and the method part ships alone. Asked: split, method part to the round-8 retro, mod blocked by it vs split with a retro now vs one PR. Owner: "Go with reco" → skills-hekn holds the method part (blocking this); this ticket is the mod only, built against mocked marker and decisions.md.

Interview closed: rulings R1–R4 and D1 above supersede the 'Change to the method (shawarma)' section, whose items moved to skills-hekn.


## Plan paused: 2 questions (2026-10-16)

Spike: sketch in the throwaway worktree `.worktrees/pi0y-spike` (branch `spike/pi0y`, kept for the re-spike): `mods/shawarma-companion/` + a marketplace entry. Readings on the sketch:
- `claude-personal plugin test mods/shawarma-companion` → 29 pass, 0 fail; `tsc -p` (scratch tsconfig on the 2.1.301 types) → exit 0; `claude-personal plugin validate mods/shawarma-companion` and `claude-personal plugin validate .` → ✔ Validation passed.
- Repo suite `node --test scripts/test/*.test.mjs` → 511 pass, 0 fail, 2 skipped, the same with and without the sketch (the skips need a pinned 2.1.250 CLI). No existing test changes.
- Stubbed module → 13 of the first 15 tests red, 2 green (the empty-band guards).
- Mutants M1–M16 each turned at least one test red (M14 only after its test stopped writing the absolute path too).
- Attack lane (8 lines): fixed in the sketch: a marker with extra lines now malformed; trailing slash on the plan dir; control characters (the engine refused the tree: `ui.render (AbovePrompt) refused: a text child holds a control character`); a relative Write path; the test's time oracle (was clockTime itself); uncovered checklist items now tested (pane, command, row press, survey, dim, desktop, defaults, decisions edit). Real engine (`claude -p --plugin-dir`): cwd follows a foreground `cd` one call late; clockTime matches `date +%H:%M` (local zone); `$.fs.read` reads outside the session root.

Q1 (refresh — the ticket's design text): the ticket says re-read only on writes under the plan dir or the marker, no timer. Readings: a marker removed with Bash `rm` is invisible to path matching (mutant M1: the "deleted by a Bash call" test goes red); a marker replaced by another writer stays drawn until this session's next tool call or turn end (lane L5b). Measured cost of refreshing after every Write/Edit/Bash: 1 git spawn per cwd for 200 calls, at most 10 fs calls per tool call (L4). Options: (1, reco) refresh after every Write/Edit/Bash and at turn end, plus a 15 s stat-only check while a row is drawn (unexecuted); (2) the same without the timer: stale while idle between turns; (3) the ticket as written: a stopped run stays drawn.

Q2 (two sessions in one tree — R2 assumed one session per tree; R3's label): readings: a Bash call naming `.shawarma/` while another session rewrites the marker draws that plan unlabelled (L5b2); a marker written by a script that does not name the path is labelled `other session:` though it is this session's (test "marker changed by a call that did not name it"). Options: (1, reco) the label reads `unconfirmed:` ("the mod did not see this session write it", true in every case) and only a Write/Edit of the marker's path counts as this session's; skills-hekn adds "write it with the Write tool"; residual: a race inside one Write call; (2) keep `other session:` and the Bash rule, with the two readings above; (3) the marker carries the session id, which the mod would have to give the model through the system prompt (the path R1 turned down; unexecuted).

DEFAULTs (stand unless struck): a missing plan.md or decisions.md is a normal state (no brief yet / none recorded), so only a malformed marker or a missing plan dir draws a problem line; a `|` inside a decision's text is allowed (a row needs at least 4 fields); a marker naming a plan dir outside the repo shows that dir's name (reads only).

unruled: Q1, Q2 — default (1) for each

## Rulings on the 2 questions (2026-10-17)

Owner, verbatim: "Go with recos, but let's file a bean for the shawarma skill to guard against the skill to be fired on a checkout that is already beging worked on by the skill from another session."

- **R5 (Q1, refresh).** Option 1: refresh after every Write/Edit/MultiEdit/NotebookEdit/Bash call and at turn end, plus a 15 s stat-only check of the drawn marker while a row is drawn.
- **R6 (Q2, two sessions).** Option 1: the label reads `unconfirmed:`; only a Write/Edit of the marker's path counts as this session's; skills-hekn adds "write it with the Write tool". Residual: a race inside one Write call.
- Residue: skills-lhdg (new, round 8, blocked by skills-hekn): the skill asks before starting on a tree that already holds `.shawarma/active`. The mod's `unconfirmed:` label stays as the fallback.
- DEFAULTs above stand (not struck).

## Plan: brief written (2026-10-17)

Brief: `docs/plans/2026-10-17-skills-pi0y-shawarma-companion/plan.md`, whole-file sketches in its `sketch/`. Re-spike on R5/R6, readings:
- `claude-personal plugin test mods/shawarma-companion` → 39 pass, 0 fail; stubbed modules → 6 pass, 33 fail (predicted red set: tests 1–33 and 41).
- `node --test scripts/test/*.test.mjs` → 513 pass, 0 fail, 2 skipped (base 511; +2 from the new `scripts/test/marketplace.test.mjs`).
- `tsc` → exit 0; `claude-personal plugin validate` on the mod and on `.` → ✔ Validation passed.
- Mutants: 31 run, 29 red; M22 (check never cancelled) and M31 (no restart from the render hook) survive — not observable in the test kit; both go to the review lane.
- Attack lane pass 2 (L9–L13): L13 found two unlabelled rows this session did not write (another writer inside, or right after, an own Write). Fixed: an own Write must match the file's text, and the record keeps the text. L12 (reload after a settings change may skip session.start): the render hook now restarts the check. `MultiEdit` is not a 2.1.301 tool: dropped. Planner re-run of the lane's tests on the fixed sketch → 1219 pass, 0 fail.
- Also: `claude plugin validate .` does not check a marketplace entry's source path exists (new test pins it); the marketplace entry adds 9 lines and reformats nothing; the mod gets a `.gitignore` for the editor types the engine writes.

`run` waits for skills-hekn (R4).

unruled: none


## Triage (2026-10-17)

Brief committed (37e94a1), awaiting go; `run` waits for skills-hekn (R4). The CLI moved past the planned build: `claude-personal --version` → 2.1.302 (brief: 2.1.301). Wave 0 re-reads the type file and re-runs the predicted reds on the installed build, recorded as §9's first row.

## Ask 2026-10-28 · ruling

Run stopped at Wave 0 (branch `feat/pi0y-shawarma-companion`, `.worktrees/pi0y`, commit 0bb5d03, brief §9 rows W0 and W0-Q1).

**What this is about:** the row's decision count. The brief's parser (§3 2b) counts a line only when its label field is exactly `RULING` or `DEFAULT`. The skill that shipped in round 8 writes `<date> | <label> | <decision> | <why>` and never says what the label holds, so real files say `Q1 RULING`, `D1–D8 DEFAULT`, `R1 (Q1, excerpt bound)`, `D1 (constants)`, and some are Markdown tables starting with `|`.

**Reading.** The sketch's `parseDecisions` over all 28 decisions.md files on this machine (bigbrain, BioJoule): 26 ruled, 59 default, 487 unreadable, out of 421 dated rows. 22 of 28 files read `0 ruled, 0 default`. The row would tell you no decision has been made on a plan with 20. That is wrong output (plan step 3 (c)), and the fix changes a frozen §3 line, so it is a RULING.

**Which is wrong:** both the brief (it assumed a bare label) and the skill text (it never defines the label). The skill only changes at a retro.

**Options** (each executed over the same 28 files):
1. **(reco) Count dated rows: the row reads `<n> decisions`.** A decision is a line starting with a date (a leading `|` allowed); other lines are skipped, not counted as unreadable. Reading: 421 rows, 0 files at zero. Always true, but no ruled/default split. Changes §3 2b and 2d, and the expected strings of tests 1, 2, 10, 31.
2. **Look for the word in the label field.** `RULING` or `DEFAULT` anywhere in it, dated lines only. Reading: 107 ruled, 184 default, 130 rows unreadable; 5 of 28 files still read zero decisions (labels like `R1 (Q1, …)` carry no word). The split is wrong on those files.
3. **Keep the brief as frozen; fix the skill at round 9** (define the label as `<id> RULING` or `<id> DEFAULT`). Reading: until round 9, and for every file already written, 22 of 28 files show `0 ruled, 0 default`.

**Where the residue goes:** with option 1, a round-9 item for the skill to define the label; the split can come back in a later mod version once files carry it. I can add that to skills-h8hp or to a new bean.

unruled: W0-Q1 — default (1)
