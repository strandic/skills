# Changelog

All notable changes to the `shawarma-companion` mod. The version is the one in
`.claude-plugin/plugin.json`. Marketplace users only get changes when it goes up.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.1] - unreleased

The 15-second check keeps running after a failed read (skills-cm2l, skills-0wsk).

### Fixed
- The clean-up of saved entries older than 30 days held the first update of a session for up to about 400 seconds when the store answered slowly; it now stops 2 seconds after it starts, so the first update waits at most about 6 seconds for the store: 2 for the session's own entry, 2 for the clean-up, 2 to save its claims (skills-bnbu).
- One saved entry that could not be read stopped every session's clean-up, so the store grew without bound; that entry is now skipped, and sessions usually start the clean-up at different entries (skills-6y0d). An entry that reads as unset (no value) is skipped too, not deleted.
- One failed read during the 15-second check no longer empties the row until the next tool call. A row whose files fail to read reads `shawarma: <ticket>: could not be read`, and the check reads it again every 15 seconds until it works (skills-cm2l).
- One failed listing of a plan folder during the 15-second check no longer leaves `plan dir not readable` until the next tool call: each check updates such a row in full, asking the folder's real path before listing it (skills-cm2l).
- A check that fails as a whole now clears the more-row's counts too, and the check keeps running, so the rows come back once the error clears (skills-0wsk).

### Removed
- The pane's `<n> markers could not be read.` line and its `<ticket>: could not be read` reason: such a marker now has its own row.

## [0.3.0] - unreleased

Each session shows full rows only for the worktrees it works in (skills-s6qg).

### Added
- A session *claims* a worktree when its working directory or project root is in it, when it writes a file there, or when a marker there changes during one of its own calls. Claims only grow, survive `/clear`, and are saved in the mod's store under the session id so `--resume` restores them; entries untouched for 30 days are deleted.
- The more-row counts the runs of unclaimed worktrees: `1 run in another worktree`, `<n> runs in other worktrees`. The pane lists their tickets under `In other worktrees:`.
- The `other tree:` label on rows from a claimed worktree that is not the current one.

### Changed
- The rows of the current worktree (the working directory's, else the project root's) come first; the other claimed worktrees' rows follow.
- The mod now writes to its own store (one entry per session).

## [0.2.0] - 2026-11-02

Reads the per-ticket markers of shawarma 0.9 (skills-v2tm, PR #5).

### Added
- One row per `.shawarma/active-<ticket>` marker, in the session's own tree and in every worktree `git worktree list --porcelain -z` names (a file-API fallback when git cannot run): the own tree first, then newest first.
- The `stale:` label: a marker not rewritten for 12 hours, or dated more than a minute ahead.
- Caps: at most 50 worktrees scanned and 20 rows drawn, with a dimmed more-row for the rest.
- A pane per row: pressing a row opens it on that ticket; the pane says why a chosen marker is not drawn.
- A `trivial` marker draws `<ticket> · trivial · since HH:MM`.

### Changed
- A marker's plan folder must lie inside its own tree, checked first as written and then by its real path with links followed. Each query waits at most 2 seconds. The band, the 15-second check and the pane read nothing outside the tree.
- The pane reads only plan files that are regular files, not links.
- Git and file-system calls have a 2-second limit.

### Removed
- The `unconfirmed:` label, and the old single `.shawarma/active` marker.

## [0.1.0] - 2026-11-01

First release: one row above the prompt for the active shawarma plan or run, and a detail pane.
