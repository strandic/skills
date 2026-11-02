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

The mod looks in every tree of the repository the session runs in. It finds the trees with `git worktree list`, once per turn. If git takes longer than 2 seconds, or its answer is cut short, the mod treats that as no answer. The main checkout is one tree; each linked worktree is another, wherever its folder is. A worktree git marks `prunable` is skipped. A bare one is skipped too: it has no files to read. A `locked` one is read. When git cannot run or gives no answer, the mod finds the repository by reading files only. It looks for `.git` in the session's folder, then in each folder above it. A `.git` folder marks the main checkout. A `.git` file marks a linked worktree, and its `gitdir:` line leads to the main checkout. The mod then reads the main checkout, every folder under `<main checkout>/.worktrees/`, and the session's own tree. This fallback misses linked worktrees kept anywhere else, for example in a sibling folder. The mod asks git for its `-z` output, which git added in version 2.36. With an older git the command fails, so the mod always uses this fallback and never shows markers in sibling-folder worktrees.

## The rows

The band above the prompt shows one row per marker. The marker in the session's own tree comes first. The others follow, newest first. If the rows do not fit, the band scrolls.

The mod looks in at most 50 trees, the session's own tree first. It reads and shows at most 20 markers. When there are more, a last dimmed row says so. `+<n> more not shown` counts the markers it found but did not read. `1 worktree not scanned` or `<k> worktrees not scanned` counts the trees it did not look in. The row shows even when no other row does.

A row reads:

```
[stale: |earlier session: ]<ticket>[ · <title>] · <step> · since <HH:MM> · <n> decisions
```

The row starts with a label when one applies, then the ticket. When the title is the ticket, or starts with the ticket followed by a space, the row shows the title in the ticket's place, for example `skills-x — thing`. Otherwise the title follows the ticket after ` · `.

- **stale:** is shown, and the row dimmed, when the marker was not rewritten for 12 hours, or its time is more than 1 minute in the future. A live run rewrites its marker at each step or wave, so a stale marker was most likely left behind by a run that stopped. The row turns stale on its own when it reaches 12 hours. When a marker is both stale and from an earlier session, the row says `stale:`.
- **earlier session:** is shown, and the row dimmed, when the marker was last written before this session started, or within the first millisecond of it. Claude Code gives the session start in whole milliseconds, so a marker written in that millisecond may be older than the session. Such a marker may be left over from a session that stopped without cleaning up. The mod still shows it.
- **title** is the first line of `plan.md`, without the `# `. If there is no `plan.md` yet, it is the plan folder's name.
- **step** is the marker's second line, for example `plan 2 spike` or `run W3`.
- **since** is the time the marker was last written. It gets a `MM-DD ` date in front when that was not today.
- **decisions** is the number of dated rows in `decisions.md`. A dated row is a line that starts with a date (`YYYY-MM-DD`) followed by `|`. A Markdown table row counts too. The row reads `1 decision` when there is one. A hand-written `decisions.md` can make the count wrong: a dated row inside a code block or an HTML comment counts too.

A `trivial` marker reads `<ticket> · trivial · since <HH:MM>`.

Three parts can be added at the end when they apply:

- `· plan dir not found: <folder>`: the plan folder named in the marker does not exist.
- `· plan dir not readable: <folder>`: the plan folder exists, but the mod could not list it, or could not ask where it really is.
- `· ctx <p>%`: how much of the context window is used, on the first row only. This shows only when the `context` setting is on.

If a marker is malformed, its row reads only `shawarma: <ticket>: malformed marker`, with its label in front when it has one. The pane adds the marker's path.

The plan folder must be inside the marker's own tree: the tree root or a folder under it. The mod checks this in two steps. First it checks the path as written, after `.` and `..` are resolved. A path outside the tree as written counts as outside, and the mod makes no file call at it. Then it asks where the folder really is, with links followed, and checks that real path against the tree's real path. So a folder in the tree that links to a folder outside it counts as outside. To ask, the mod follows a link inside the tree to where it points, so that one call can reach outside the tree, for example a slow network mount. The mod finds each tree's real path once per turn. It asks for the folder's real path once each time the marker changes, and keeps the answer. If no real path comes back, the folder counts as outside, and the mod asks again at the next update. If no answer comes within 2 seconds, the folder counts as outside until the turn ends, so a call that never answers costs 2 seconds once per turn. If the mod cannot ask, for example because the folder does not exist, it lists and reads nothing in that folder for that update, and asks again at the next one. The row then says `plan dir not readable` when the folder exists, and `plan dir not found` when it does not. While the row says that, the pane and the 15-second check list and read nothing in that folder either. The pane first asks where the folder really is: outside the tree, it shows the `plan dir outside its tree` line; with no answer, it shows the plan as missing. The 15-second check only asks whether the folder exists, and an update runs when that changes. Some limits follow. A marker path that names the tree through a different spelling counts as outside: an absolute path through a link, such as `/tmp/…` on macOS where the tree is under `/private/tmp/…`, or a path in a different letter case on a disk that ignores case. A real path in the marker can count as outside too, when git names the tree through a link. The markers the shawarma skill writes today are relative, so these cases do not come up with them. A link changed later, while the marker stays the same, is seen only when the marker is rewritten. If the plan folder is not inside, the row reads only `shawarma: <ticket>: plan dir outside its tree`, and the mod reads nothing in that folder. The pane adds the marker's path.

No row runs wider than the window. The ticket stays at the start of the row. The title is cut first, then the problem text, then the end of the line. Characters that could reorder the text on screen are drawn as spaces.

The rows update after each Write, Edit, NotebookEdit or Bash call, at the end of each turn, and at session start. While a row or the more-row is shown, the mod also lists each tree's `.shawarma` folder and each shown plan folder every 15 seconds. So a marker, `plan.md` or `decisions.md` another session changes shows within 15 seconds, in the trees found at the last update. Two changes wait for this session's next tool call or turn end: a worktree added since the last update, and a marker rewritten with the same file time. The band keeps what it read from `plan.md` and `decisions.md` with each file's time. So in the band, a rewrite of either file that keeps the same file time is not seen until that time changes. The pane reads both files again each time it draws. When no row is shown, no check runs: a marker written outside the session shows at this session's next tool call or turn end.

The mod does not say which session wrote a marker. A row with no label means the marker was written after this session started and less than 12 hours ago.

## The pane

Press a row to open the pane on that ticket. If that ticket's row is no longer shown, the pane says why, using only what the last scan found:

- `<ticket>: no longer active`: its tree was scanned and the marker was not there.
- `<ticket>: not shown (past the 20-row limit)`: the marker is there, but it is not among the 20 rows shown.
- `<ticket>: could not be read`: the marker is there, but its files could not be read.
- `<ticket>: not shown (not in the last scan)`: its tree was not scanned, or no scan has run since the mod loaded.

When no row is shown, the pane says the first of these that applies:

- `Shawarma state could not be read.`: the last scan failed.
- `No scan has run since the mod loaded.`
- `1 marker could not be read.` or `<n> markers could not be read.`: the last scan found markers, but their files could not be read.
- `No row drawn:` followed by the more-row's text.
- `No shawarma marker in the last scan.`

The command `/shawarma-companion` opens the pane on the first row. The pane shows:

- the title and the step, with the row's label (`stale:` or `earlier session:`) in front when it has one;
- the other tickets shown in the band, each with `(stale)` or `(earlier session)` when that applies;
- the recap: section 1 of `plan.md`;
- the decisions: the lines of `decisions.md`;
- the amendments: section 9 of `plan.md`;
- the predicted red set: the `Predicted red set` line of section 4 of `plan.md`.

If `plan.md` does not exist yet, the pane says there is no brief yet and shows only the title, the step and the decisions. The band and the pane read `plan.md` and `decisions.md` only when they are regular files. A file that is a link is treated as missing. For a `trivial` marker it reads "Trivial run: no brief" with the ticket.

## Settings

| setting | default | what it does |
|---|---|---|
| `band` | on | Shows the rows above the prompt, one per active shawarma plan or run. Off: no rows. |
| `pane` | on | Adds the `/shawarma-companion` command and makes each row open the pane when pressed. Off: no command, and the rows are not pressable. |
| `context` | off | Adds `· ctx <p>%` to the first row: the share of the context window in use. |

## What it leaves out

The mod does not show the working folder or detailed context use. claude-hud or ccstatusline cover path and context use better. Use one of them next to this mod.
