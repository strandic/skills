# shawarma-companion

A Claude Code mod. It shows the shawarma plan or run that is active in your tree. It draws one row above the prompt and offers a pane with more detail.

A mod is a plugin that changes Claude Code's own interface. This one only reads files. It writes nothing.

## Install

```
/plugin install shawarma-companion@strandic
```

It works in the terminal and in the desktop app. VS Code draws no mod surface today, so the mod shows nothing there.

## Where it reads from

The shawarma skill writes two files. The mod reads them.

- **The marker** is the file `.shawarma/active` at the root of the tree. Its first line names the plan folder. Its second line names the step: `plan <step>` or `run <wave>`.
- **decisions.md** sits in the plan folder, next to `plan.md`. It holds one dated row per decision.

The shawarma skill writes both files from its round-8 release (version 0.8.0). With an older skill, the mod finds no marker and draws nothing.

The mod looks for the marker in two places, in this order. First, the marker path that a Write or Edit of this session named. Second, `.shawarma/active` at the git root of the session's working folder.

## The row

The row sits above the prompt. It reads:

```
[label]<title> · <step> · since <HH:MM> · <n> decisions
```

- **label** is empty, `earlier session: ` or `unconfirmed: `. See "The labels" below.
- **title** is the first line of `plan.md`, without the `# `. If there is no `plan.md` yet, it is the plan folder's name.
- **step** is the marker's second line, for example `plan 2 spike` or `run W3`.
- **since** is the time the marker was last written. It gets a `MM-DD ` date in front when that was not today.
- **decisions** is the number of dated rows in `decisions.md`. A dated row is a line that starts with a date (`YYYY-MM-DD`) followed by `|`. A Markdown table row counts too. The row reads `1 decision` when there is one. The count does not split rulings from defaults.

Two parts are added at the end when they apply:

- `· <problem>`: the plan folder named in the marker does not exist (`plan dir not found: <folder>`).
- `· ctx <p>%`: how much of the context window is used. This shows only when the `context` setting is on.

If the marker is malformed, the row reads only `shawarma: <marker path> is malformed`.

The row never runs wider than the window. The title is cut first, then the end of the line.

The row updates after each Write, Edit, NotebookEdit or Bash call, at the end of each turn, and at session start. While the row is shown, the mod also checks the marker every 15 seconds. So a change made outside the session shows within 15 seconds.

## The labels

The label tells you whether this session wrote the marker. Both labels are dimmed.

- **`earlier session:`** The marker is older than this session. It was written before this session started.
- **`unconfirmed:`** The marker changed after this session started, but this session did not see itself write it. "Write it" means a Write or Edit tool call on the marker's path. The label shows whether another session wrote the marker or this session wrote it another way, for example through Bash.

No label means this session wrote the marker with a Write or Edit of its path.

## The pane

The pane shows:

- the title and the step;
- the recap: section 1 of `plan.md`;
- the decisions: the lines of `decisions.md`;
- the amendments: section 9 of `plan.md`;
- the predicted red set: the `Predicted red set` line of section 4 of `plan.md`.

If `plan.md` does not exist yet, the pane says there is no brief yet and shows only the decisions.

Open it with the command `/shawarma-companion`, or press the row.

## Settings

| setting | default | what it does |
|---|---|---|
| `band` | on | Shows the row above the prompt. Off: no row. |
| `pane` | on | Adds the `/shawarma-companion` command and makes the row open the pane when pressed. Off: no command, and the row is not pressable. |
| `context` | off | Adds `· ctx <p>%` to the row: the share of the context window in use. |

## What it leaves out

The mod does not show the working folder or detailed context use. claude-hud or ccstatusline cover path and context use better. Use one of them next to this mod.
