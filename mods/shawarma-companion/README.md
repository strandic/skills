# shawarma-companion

A Claude Code mod. It shows the shawarma plans and runs that are active in your repository, one row per ticket above the prompt, and offers a pane with more detail.

A mod is a plugin that changes Claude Code's own interface. This one only reads your files. It writes only to its own store: the list of worktrees each session works in (see [Which runs a session shows](#which-runs-a-session-shows)).

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

## Which runs a session shows

A session shows full rows only for the worktrees it works in. These are its *claimed* worktrees. The runs of every other worktree are only counted, in the last dimmed row.

A session claims a worktree when:

- its working directory is in it. A shell `cd` moves the working directory. `EnterWorktree` and `/cd` move it too.
- its project root is in it. `EnterWorktree` and `/cd` move the project root.
- one of its Write, Edit or NotebookEdit calls writes a file in it. A path written through a link, such as `/tmp/…` on macOS, is checked through its real path.
- one of its Bash calls changes a file in it, as Claude Code reports it. Claude Code reports only the changes in the working tree the session is in.
- a marker in it was written during one of the session's own Write, Edit, NotebookEdit or Bash calls, by any tool. This catches a marker a Bash command writes into another worktree. A marker another session writes at that same moment is claimed too. A call counts until the engine ends or abandons it, however long it runs, so a long subagent call claims a new marker it writes partway through. A call that never ends keeps counting: until then, a new marker another session adds in a scanned worktree is claimed too.

The mod checks the working directory and the project root at each update and every 15 seconds while a row is shown. It checks the folders of the last 64 files the session wrote at each update, so a worktree made and written in the same turn is claimed once git lists it. Subagents' calls count, but a subagent's own working directory does not.

Claims only grow: a worktree stays claimed for the rest of the session, even after the session moves away. A session that claims no worktree saves nothing. Each call to the session or the store gives up after 2 seconds; a call that gives up claims nothing that update. They survive `/clear`. The mod saves them in its store, keyed by the session id, so `--resume` brings them back. A saved entry not updated for 30 days is deleted. The mod looks for such entries at a session's first update that reads the session's own entry, and stops looking 2 seconds after it starts. So the first update waits at most about 6 seconds for the store: 2 for the session's own entry, 2 for the clean-up, 2 to save its claims. Every 2-second limit relies on the engine's timer; if the engine never fires it, a session or store call that never answers holds the update. A session call that gives up counts as one that failed. When the working directory cannot be read after a tool call, at a turn end or in the 15-second check, the mod forgets the one it knew and draws nothing until the working directory is read again: at the main session's next tool call or turn end, at the next 15-second check, or when a session starts. It then finds the worktrees again from the folder it reads. An update that cannot learn when the session started draws nothing too; so does a drawing with `context` on that cannot learn how full the context is. So a session that never answers holds each Write, Edit, NotebookEdit or Bash call 2 seconds before it runs. One update asks the session at most eight things, so it waits at most 16 seconds for the session, on top of its waits for git, files and the store. The mod skips an entry it cannot read, or that reads as unset (no value). Sessions usually start at different entries, so one entry that never answers does not stop every session's clean-up.

The *current* worktree is the one that holds the working directory, or else the one that holds the project root. Its rows come first. Rows from the other claimed worktrees start with `other tree: `.

## The rows

The band above the prompt shows one row per marker in a claimed worktree. The markers in the current worktree come first. The others follow, newest first. If the rows do not fit, the band scrolls.

The mod looks in at most 50 trees: the current worktree first, then the other claimed worktrees, then the rest. It reads and shows at most 20 markers. When there are more, a last dimmed row says so. `+<n> more not shown` counts the markers it found but did not read. `1 run in another worktree` or `<n> runs in other worktrees` counts the markers in worktrees the session has not claimed. `1 worktree not scanned` or `<k> worktrees not scanned` counts the trees it did not look in. The row shows even when no other row does.

A row reads:

```
[stale: |earlier session: ]<ticket>[ · <title>] · <step> · since <HH:MM> · <n> decisions
```

The row starts with its labels when they apply, then the ticket. `other tree: ` comes first, then `stale: ` or `earlier session: `. When the title is the ticket, or starts with the ticket followed by a space, the row shows the title in the ticket's place, for example `skills-x — thing`. Otherwise the title follows the ticket after ` · `.

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

If the marker, `plan.md` or `decisions.md` fails to read, or the plan folder does not list and the mod cannot ask whether it exists, the row reads only `shawarma: <ticket>: could not be read`, with its label in front when it has one. It shows nothing it read before, since that may be out of date. The 15-second check reads it again each time, for as long as the read fails, and the full row comes back at the first check after the read works again. The pane adds the marker's path.

The plan folder must be inside the marker's own tree: the tree root or a folder under it. The mod checks this in two steps. First it checks the path as written, after `.` and `..` are resolved. A path outside the tree as written counts as outside, and the mod makes no file call at it. Then it asks where the folder really is, with links followed, and checks that real path against the tree's real path. So a folder in the tree that links to a folder outside it counts as outside. To ask, the mod follows a link inside the tree to where it points. So that call can reach outside the tree, for example a slow network mount. The same holds for the pane's own real-path check and the 15-second check's question whether a folder exists. The mod finds each tree's real path once per turn. It asks for the folder's real path once each time the marker changes, and keeps the answer. It drops that answer when the folder is later found missing or unreadable, and asks again. If no real path comes back, the folder counts as outside, and the mod asks again at the next update. If no answer comes within 2 seconds, the folder counts as outside until the turn ends. So a call that never answers costs 2 seconds once per turn for each such folder or tree root, and once more after the marker is rewritten. If the mod cannot ask, for example because the folder does not exist, it lists and reads nothing in that folder for that update, and asks again at the next one. The row then says `plan dir not readable` when the folder exists, and `plan dir not found` when it does not. While the row says `plan dir not found`, the 15-second check lists and reads nothing in that folder. While it says `plan dir not readable`, each 15-second check runs a full update of the row: it asks where the folder really is first, as above, and lists it only when that is inside. The pane first asks where the folder really is. Outside the tree, it shows the `plan dir outside its tree` line. With no answer, it shows the plan as missing, and reads nothing there. Only when it finds the folder inside does the pane list and read it. For a `plan dir not found` row, the 15-second check only asks whether the folder exists, and an update runs when that changes or when the ask fails. Some limits follow. A marker path that names the tree through a different spelling counts as outside: an absolute path through a link, such as `/tmp/…` on macOS where the tree is under `/private/tmp/…`, or a path in a different letter case on a disk that ignores case. A real path in the marker can count as outside too, when git names the tree through a link. The markers the shawarma skill writes today are relative, so these cases do not come up with them. A link changed later, while the marker stays the same, is seen only when the marker is rewritten. If the plan folder is not inside, the row reads only `shawarma: <ticket>: plan dir outside its tree`, and the mod reads nothing in that folder. The pane adds the marker's path.

No row runs wider than the window. The ticket follows the labels. In a window narrower than about 40 columns the labels can push the ticket out of view. The title is cut first, then the problem text, then the end of the line. Characters that could reorder the text on screen are drawn as spaces.

The rows update after each Write, Edit, NotebookEdit or Bash call, at the end of each turn, and at session start. While a row or the more-row is shown, the mod also lists each tree's `.shawarma` folder and each shown plan folder every 15 seconds. So a marker, `plan.md` or `decisions.md` another session changes shows within 15 seconds, in the trees found at the last update. Two changes wait for this session's next tool call or turn end: a worktree added since the last update, and a marker rewritten with the same file time. The band keeps what it read from `plan.md` and `decisions.md` with each file's time. So in the band, a rewrite of either file that keeps the same file time is not seen until that time changes. The pane reads both files again each time it draws. When no row is shown, no check runs: a marker written outside the session shows at this session's next tool call or turn end. One exception: when an update fails as a whole while the check runs, the band shows nothing, and the check keeps running. The rows come back at the first check after the error clears.

The mod does not say which session wrote a marker. A row with no label is in the current worktree, and its marker was written after this session started and less than 12 hours ago.

## The pane

Press a row to open the pane on that ticket. If that ticket's row is no longer shown, the pane says why, using only what the last scan found:

- `<ticket>: no longer active`: its tree was scanned and the marker was not there.
- `<ticket>: not shown (past the 20-row limit)`: the marker is there, but it is not among the 20 rows shown.
- `<ticket>: not shown (not in the last scan)`: its tree was not scanned, or no scan has run since the mod loaded.

When no row is shown, the pane says the first of these that applies:

- `Shawarma state could not be read.`: the last scan failed.
- `No scan has run since the mod loaded.`
- `No row drawn:` followed by the more-row's text, then `In other worktrees:` and their tickets when there are any.
- `No shawarma marker in the last scan.`

The command `/shawarma-companion` opens the pane on the first row. The pane shows:

- the title and the step, with the row's labels (`other tree:`, then `stale:` or `earlier session:`) in front when it has them;
- the other tickets shown in the band, each with `(stale)` or `(earlier session)` when that applies;
- `In other worktrees:` and the tickets of the worktrees the session has not claimed, at most 20, sorted;
- the recap: section 1 of `plan.md`;
- the decisions: the dated rows of `decisions.md`, the same lines the band counts, one per bullet as written. Headings, blank lines and other lines are left out. With no dated row, or no `decisions.md`, it reads `_None recorded._`;
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
