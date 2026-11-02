# Changelog

All notable changes to the `shawarma-companion` mod. The version is the one in
`.claude-plugin/plugin.json`. Marketplace users only get changes when it goes up.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

## [0.1.0] - 2026-10-28

First release: one row above the prompt for the active shawarma plan or run, and a detail pane.
