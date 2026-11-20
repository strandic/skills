---
# skills-s6qg
title: 'shawarma-companion: each session shows the runs of every worktree, not only its own'
status: todo
type: feature
priority: normal
tags:
    - shawarma
created_at: 2026-11-20T06:43:34Z
updated_at: 2026-11-20T06:43:34Z
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
