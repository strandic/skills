# shawarma-companion

A Claude Code mod. It shows the shawarma plans and runs that are active in your repository, one row per ticket above the prompt, and offers a pane with more detail.

A mod is a plugin that changes Claude Code's own interface. This one only reads files. It writes nothing.

## Install

```
/plugin install shawarma-companion@strandic
```

It works in the terminal and in the desktop app. VS Code draws no mod surface today, so the mod shows nothing there.

## Where it reads from

The shawarma skill writes two kinds of file. The mod reads them.

- **A marker** is the file `.shawarma/active-<ticket>` at the root of a tree. There is one per ticket in progress. The ticket is the part of the file name after `active-`. The first line names the plan folder, relative to the tree root or absolute. The second line names the step: `plan <step>`, `run <wave>` or `trivial`. For a `trivial` marker the first line is the ticket.
- **decisions.md** sits in the plan folder, next to `plan.md`. It holds one dated row per decision.

The old marker `.shawarma/active` (skill 0.8.x) is not read.

The mod looks in every tree of the repository the session runs in. It finds the trees with `git worktree list`, once per turn. If git takes longer than 2 seconds, or its answer is cut short, the mod treats that as no answer. The main checkout is one tree; each linked worktree is another, wherever its folder is. A worktree git marks `prunable` is skipped. A `locked` one is read. When git cannot run or gives no answer, the mod finds the repository by reading files only. It looks for `.git` in the session's folder, then in each folder above it. A `.git` folder marks the main checkout. A `.git` file marks a linked worktree, and its `gitdir:` line leads to the main checkout. The mod then reads the main checkout, every folder under `<main checkout>/.worktrees/`, and the session's own tree. This fallback misses linked worktrees kept anywhere else, for example in a sibling folder. The mod asks git for its `-z` output, which git added in version 2.36. With an older git the command fails, so the mod always uses this fallback and never shows markers in sibling-folder worktrees.

## The rows

The band above the prompt shows one row per marker. The marker in the session's own tree comes first. The others follow, newest first. If the rows do not fit, the band scrolls.

The mod looks in at most 50 trees, the session's own tree first. It reads and shows at most 20 markers. When there are more, a last dimmed row says so. `+<n> more not shown` counts the markers it found but did not read. `<k> worktrees not scanned` counts the trees it did not look in. The row shows even when no other row does.

A row reads:

```
[earlier session: ]<title> · <step> · since <HH:MM> · <n> decisions
```

- **stale:** is shown, and the row dimmed, when the marker was not rewritten for 12 hours, or its time is more than 1 minute in the future. A live run rewrites its marker at each step or wave, so a stale marker was most likely left behind by a run that stopped. The row turns stale on its own when it reaches 12 hours. When a marker is both stale and from an earlier session, the row says `stale:`.
- **earlier session:** is shown, and the row dimmed, when the marker was last written before this session started, or within the first millisecond of it. Claude Code gives the session start in whole milliseconds, so a marker written in that millisecond may be older than the session. Such a marker may be left over from a session that stopped without cleaning up. The mod still shows it.
- **title** is the first line of `plan.md`, without the `# `. If there is no `plan.md` yet, it is the plan folder's name. If the title does not start with the ticket, the ticket is put in front.
- **step** is the marker's second line, for example `plan 2 spike` or `run W3`.
- **since** is the time the marker was last written. It gets a `MM-DD ` date in front when that was not today.
- **decisions** is the number of dated rows in `decisions.md`. A dated row is a line that starts with a date (`YYYY-MM-DD`) followed by `|`. A Markdown table row counts too. The row reads `1 decision` when there is one. A hand-written `decisions.md` can make the count wrong: a dated row inside a code block or an HTML comment counts too.

A `trivial` marker reads `<ticket> · trivial · since <HH:MM>`.

Two parts are added at the end when they apply:

- `· plan dir not found: <folder>`: the plan folder named in the marker does not exist.
- `· ctx <p>%`: how much of the context window is used, on the first row only. This shows only when the `context` setting is on.

If a marker is malformed, its row reads only `shawarma: <ticket>: malformed marker`, with its label in front when it has one. The pane adds the marker's path.

No row runs wider than the window. The ticket stays at the start of the row. The title is cut first, then the problem text, then the end of the line. Characters that could reorder the text on screen are drawn as spaces.

The rows update after each Write, Edit, NotebookEdit or Bash call, at the end of each turn, and at session start. While a row or the more-row is shown, the mod also lists each tree's `.shawarma` folder and each shown plan folder every 15 seconds. So a marker, `plan.md` or `decisions.md` another session changes shows within 15 seconds. When no row is shown, no check runs: a marker written outside the session shows at this session's next tool call or turn end.

The mod does not say which session wrote a marker. A row with no label means the marker was written after this session started and less than 12 hours ago.

## The pane

Press a row to open the pane on that ticket. If that ticket's row is no longer shown, the pane says why, using only what the last scan found:

- `<ticket>: no longer active`: its tree was scanned and the marker was not there.
- `<ticket>: not shown (past the 20-row limit)`: the marker is there, but it is not among the 20 rows shown.
- `<ticket>: could not be read`: the marker is there, but its files could not be read.
- `<ticket>: not shown (not in the last scan)`: its tree was not scanned, or no scan has run since the mod loaded.

When no row is shown, the pane says `No shawarma marker in the last scan.`, or `No row drawn:` followed by the more-row's text. After a failed scan it says `Shawarma state could not be read.` The command `/shawarma-companion` opens it on the first row. The pane shows:

- the title and the step, with the row's label (`stale:` or `earlier session:`) in front when it has one;
- the other tickets shown in the band, each with `(stale)` or `(earlier session)` when that applies;
- the recap: section 1 of `plan.md`;
- the decisions: the lines of `decisions.md`;
- the amendments: section 9 of `plan.md`;
- the predicted red set: the `Predicted red set` line of section 4 of `plan.md`.

If `plan.md` does not exist yet, the pane says there is no brief yet and shows only the title, the step and the decisions. For a `trivial` marker it reads "Trivial run: no brief" with the ticket.

## Settings

| setting | default | what it does |
|---|---|---|
| `band` | on | Shows the row above the prompt. Off: no row. |
| `pane` | on | Adds the `/shawarma-companion` command and makes the row open the pane when pressed. Off: no command, and the row is not pressable. |
| `context` | off | Adds `· ctx <p>%` to the row: the share of the context window in use. |

## What it leaves out

The mod does not show the working folder or detailed context use. claude-hud or ccstatusline cover path and context use better. Use one of them next to this mod.
