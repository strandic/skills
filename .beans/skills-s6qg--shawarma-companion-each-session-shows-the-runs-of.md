---
# skills-s6qg
title: 'shawarma-companion: each session shows the runs of every worktree, not only its own'
status: in-progress
type: feature
priority: normal
tags:
    - shawarma
created_at: 2026-11-20T06:43:34Z
updated_at: 2026-11-20T15:24:10Z
---

Every session in a repo draws the runs of all its worktrees. `discover()` (hooks/register.tsx) runs `git worktree list` from `$.session.cwd()` and scans every tree, up to MAX_TREES. `ownTree()` finds the session's own tree, but it is only used to put that tree's rows first. Nothing filters the other trees out. So two sessions, each in its own worktree, both show both runs.

The session's directory can move, so "the tree that holds cwd right now" is not a stable answer. Shell `cd` moves `$.session.cwd()`. `/cd` and `EnterWorktree` move `$.session.root()`.

## Proposal: the session claims trees and keeps them

1. Add a `$.state` value `mine: string[]`: the trees this session has claimed. `$.state` lasts the whole session and survives hot reloads; module variables do not.
2. At each refresh, claim the tree that holds `$.session.root()` and the tree that holds `$.session.cwd()`. Claims are only added, never removed, so a session that `cd`s into a worktree and back keeps it.
3. Optionally, claim on `on('classic.CwdChanged')` (it gives `old_cwd` and `new_cwd`), so a move counts at once instead of at the next refresh.
4. Optionally, claim a tree when the session writes into its `.shawarma/` (a `tool.call` hook on Write or Edit, from `file_path`). Bash writes are only partly visible; see the bean about markers written by Bash.
5. Draw full rows only for claimed trees. Fold the other trees' runs into the dimmed more-row, for example "+2 runs in other worktrees". The pane still lists them.
6. Add an option `scope: session | repo`. `repo` keeps today's behaviour.
7. To keep claims across `--resume`, also write them to `$.store` under `$.session.id()`. `$.store` is shared by all sessions, so key it by session and prune old keys.

## Not chosen for now

The marker could record which session owns it. That is the strongest signal, but the shawarma skill would have to know its session id, and it changes the marker format. With one run per worktree, claiming trees should be enough.

## Open questions

- A session started in the main checkout that then creates a worktree with git, without `EnterWorktree` or `cd`, claims nothing new. Is the write-based claim (item 4) needed for that case?
- What should the band show when the session has claimed no tree that has a run: nothing, or only the more-row?

## Design interview (2026-11-20)

Rulings, from `docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/decisions.md`:

- **Error directions.** Hiding one of the session's own runs under "other worktrees" tells the reader something false: that is the corrupting direction, and the rule never errs that way. Showing another session's run as a full row is noise (today's behaviour).
- **Q1 RULING.** A session claims the worktree holding its project root and the one holding its working directory at every refresh, and keeps every claim. Full rows only for claimed trees; the others fold into the more-row. Owner: "Go with reco. It should put emphasis on the current worktree though".
- **Q2 RULING.** The current tree is the one holding the working directory (else the project root's). Its rows come first; rows of other claimed trees carry a text label such as `other tree:`; grey keeps meaning stale or earlier session only. Owner: "Go with reco".
- **Q3 RULING.** A Write, Edit or NotebookEdit into a tree claims it; a Bash call claims each tree in its changed-files list when that internal field is present and well-formed, else nothing. Owner: "Go with reco".
- **Q4 RULING.** Claims survive `/clear`, and are saved in the mod's store under the session id so `--resume` restores them; entries untouched for 30 days are pruned. Owner: "Go with reco".

Out of scope: the marker recording the session that wrote it (needs a skill-text change; retro candidate).

## Plan paused: 1 question (2026-11-20)

Spike in `.worktrees/s6qg-spike` (patch `docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/sketch/sketch.patch`): `claude plugin test` → `256 pass` / `0 fail`; on the base modules → `186 pass` / `67 fail` of 253 (round-3 suite, before S42–S44); tsc exit 0; validate passed. Three attack rounds (`reports/attack*/report.md`); 31 of 32 mutants killed, m16 (two claims interleaved) `NOT RUN (the test kit does not interleave)`.

- **Q5 RULING — the time-window claim.** Probe P3: Bash's changed-files list is empty for writes outside the session's working tree, so a marker written by Bash from the main checkout into a worktree (shawarma's Wave 0) claims nothing by Q3's sources. The drafted fix (any marker whose time falls in one of the session's calls) claims every concurrent session within the first call (attack round 3, C3: 3 of 3 sessions claimed, executed). Spiked fix: only a marker absent from the previous listing (S23, S35 claimed; S42 another session's rewrite not claimed, executed). Touches ruling Q3, whose recorded reason ("can only fail towards claiming less (today's behaviour)") is wrong under Q1.

## Plan: brief frozen (2026-11-20)

Brief `docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/plan.md`, sketch beside it (`sketch/sketch.patch`, 7 files, +805 −74). Rulings Q1–Q5 and defaults D2–D10 in its `decisions.md`; Q5 (owner: "Go with reco"): only a marker absent from the previous listing and dated within 2 s of one of the session's own calls claims its tree.

- `freeze_check.py plan.md --repo . --listing <(grep -n '^- Lesson (' docs/plans/lessons.md)` → `PASS`
- `claude plugin test` on the sketch → `256 pass` / `0 fail`; on the base modules → `187 pass` / `69 fail` of 256
- mutants: 31 of 32 killed; m16 (two claims interleaved) `NOT RUN (the test kit does not interleave two claims)`
- round-3 population re-run on the final sketch (three concurrent sessions, 30 min): 0 of 3 claimed
- G4 stand-in on the real engine (2.1.329): `claims:<session>` = `["R", "R/.worktrees/wt"]`; base mod: no entry
- follow-ups: P6 (EnterWorktree and `/clear` in an interactive session, the owner's); bean `skills-enjt` (pane ticket line break, D9); retro: session id in the marker

unruled: none

## Run (2026-11-20)

PR: https://github.com/strandic/skills/pull/10 (head 35acf2b; code 08b188c). Gates on 08b188c: G1 277 pass / 0 fail (Q8), G2 validate passed, G3 tsc exit 0, G4 real-engine store `claims:3f3e9c84-…` = [R, R/.worktrees/wt]. Records: docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/ (plan.md §9, decisions.md, reports/run/). Rulings during the run: Q6, Q7, Q8; defaults W1-1, W3-D1–D12. Known limits filed: skills-5w5c, skills-79iv, skills-s475, skills-bnbu, skills-6y0d, skills-7y7p, skills-cq6n, skills-yxw1, skills-enjt.
