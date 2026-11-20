## Research for s6qg: which worktrees a session claims

I changed no files. "d.ts" below means `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/d2daf19c-9fb4-43fe-b8a1-edd716fde3f7/scratchpad/s6qg/claude-code.d.ts`, and "ref" means `reference.md` in the same folder. Both are the 2.1.325 types. The installed CLI is 2.1.329, so every d.ts line below is @2.1.325 and is not proven for the binary you run.

### 1. `$.session.cwd()`

| claim | source | quote | conf. |
|---|---|---|---|
| What it returns | d.ts:2968-2973 | "Returns the directory the session runs in, absolute. A timer that outlives its hook reads the session's directory; keep the value read inside the hook if you need the hook's (a subagent's own)." | quoted |
| A Bash `cd` in the main session carries over, but only while it stays inside the project or an added directory | code.claude.com/docs/en/tools-reference (line 153-155 of the fetched page) | "When Claude runs `cd` in the main session, the new working directory carries over to later Bash commands as long as it stays inside the project directory or an additional working directory… Subagent sessions never carry over working directory changes. If `cd` lands outside those directories, Claude Code resets to the project directory" | quoted. The docs never say this is the same value `$.session.cwd()` returns. That link is my inference. |
| A `cd` inside a background command does not move it | d.ts:22896 | "the session cwd was not changed by a backgrounded command containing a directory-change builtin (cd/pushd/popd/chdir)" | quoted |
| EnterWorktree moves the directory | tools-reference §EnterWorktree | "it moves the session's working directory and write access to that location" | quoted |
| ExitWorktree moves it back | d.ts:23134-23146 (result) | `originalCwd`, `restoredCwd` "@internal Where the session's cwd ended up" | quoted (internal field) |
| `/cd` | permissions doc §"Move the session to another directory" | "move the session to a different primary working directory" | quoted |
| Inside a subagent's hook | d.ts:2971 | "(a subagent's own)" | quoted. It is the subagent's directory, read inside the hook. |

### 2. `$.session.root()`

| claim | source | quote | conf. |
|---|---|---|---|
| What moves it | d.ts:2975-2980 | "Returns the session's project root, absolute: where it started, or where `/cd`, a host's directory change or a worktree move took it. A shell `cd` during the session does not move it" | quoted |
| ExitWorktree, and root inside a subagent | — | — | not found. "a worktree move" probably covers ExitWorktree, but that is a guess. |
| A `/cd` can unload the mod itself | permissions doc | "As soon as you move, Claude Code applies… The plugins its settings enable" | quoted. If the new directory's settings do not enable the mod, the move may drop it. |

### 3. `$.state`

| claim | source | quote | conf. |
|---|---|---|---|
| Lifetime; survives a hot reload | d.ts:3629-3635 | "Named values held by the host for the session, each with a version: plain data that survives a hot reload of the plugin's code… Persist through `$.store`." | quoted |
| Same point, in prose | ref:202 | "State a drawing draws from belongs in `$.state`, not a module variable (a hot reload loses those)… To keep a value past the session, write it to `$.store` too." | quoted |
| Losing the hooks worker does not wipe it | ref:261 | "the hook runs again in the fresh copy, its timers and state gone" | quoted. This most likely means the module's own variables are gone, but it is ambiguous. |
| `/clear`, `--resume`/`--continue`, a new session in the same process | — | — | not found. ("for the session" combined with the new id after `/clear` suggests a reset, but nothing says so.) |
| Shared between subagents | — | — | not found. The only nearby text is "Any plugin reads any value; its owner alone writes it." |
| Size limit | d.ts:3657 | "JSON data, as `$.store.set` takes" | paraphrased. No limit of its own is stated. |

### 4. `$.store`

| claim | source | quote | conf. |
|---|---|---|---|
| Scope: one per plugin, kept in the user's config directory, not per project | d.ts:3597-3602 | "This plugin's own key-value store, kept between sessions and hot reloads… A JSON file of the plugin's own under the user's Claude Code configuration directory." | quoted |
| Limit | d.ts:3615-3617 | "Rejects a function, a cycle, or a store over 4 MiB of JSON text in all." | quoted |
| Keys from all sessions and all projects mix | d.ts:3632 `keys()` "Returns every key set, in insertion order"; ref:263-264 "`$.store` keeps values across sessions" | — | paraphrased. One file per plugin means the mod must key its entries by session id and prune old ones itself. Concurrent writes from two processes: not found. |

### 5. `classic.CwdChanged` and directory events

| claim | source | quote | conf. |
|---|---|---|---|
| When it fires | hooks doc §CwdChanged | "Runs when a shell command in the main conversation changes the working directory, for example when Claude executes a `cd` command." | quoted. EnterWorktree and `/cd` are not mentioned: not found. |
| Payload | d.ts:3919-3923 | `hook_event_name: 'CwdChanged'; old_cwd: string; new_cwd: string;` plus BaseHookInput (`session_id`, `cwd`, `agent_id?`, d.ts:873-885) | quoted |
| A mod can hook it | d.ts:1296-1302 | "Each fires wherever the engine runs the classic hook, whether or not any settings hook is configured, and reaches a `*` or `classic.*` hook as it reaches a named one." | quoted |
| It cannot block the move | hooks doc | "CwdChanged hooks have no decision control. They can't block the directory change." | quoted |
| Engine (non-classic) event for a directory or worktree change | full event-name list from d.ts | — | not found. `session.cwd` and `session.root` exist only as call ops, not as events. |
| WorktreeCreate | hooks doc; d.ts:16947 | Fires on `--worktree`, on "EnterWorktree", on `isolation: "worktree"` and others. "A WorktreeCreate hook doesn't run for a worktree Claude adds through Bash". Input: `name` only. | quoted |

### 6. `$.session.id()` and `session.start`

| claim | source | quote | conf. |
|---|---|---|---|
| What it is | d.ts:2990-2994 | "Returns the session's id (the transcript file's name)." | quoted |
| `session.start` never fires for `/clear` | d.ts:4658-4659 | "Fires once per process for each loaded plugin, before the first prompt, then once per fresh load of one (never `/clear`); `next(e)` is `{ cwd }`." | quoted. This is the exact sentence you asked for. |
| `/clear` gives a new id and no start event | d.ts:12343-12345 | "`clear` is how a hook sees a `/clear`: the conversation ends, the process goes on under a new session id, and no `session.start` fires for it." | quoted |
| A resume also changes the id | d.ts:12348-12349 | "after a `/clear` or a resume the process goes on under another." `session.end` fires on "exit, /clear, resume, logout, signal" (d.ts:4750) | quoted |
| Classic SessionStart sources | hooks doc | `startup` "New session", `resume` "`--resume`, `--continue`, or `/resume`", `clear` "`/clear`", `compact` "Auto or manual compaction", `fork` | quoted. A mod can hook `classic.SessionStart` with `source` to catch `/clear` and resume. |
| Id stable across compaction | — | — | not found |

### 7. `tool.call` input and result fields

| tool | input (d.ts) | result (d.ts) | conf. |
|---|---|---|---|
| Write | 19159: `file_path`, `content` | 24062: `type`, `filePath` | quoted |
| Edit | 18580: `file_path`, `old_string`, `new_string`, `replace_all?` | 23061: `filePath` | quoted |
| NotebookEdit | 18704: `notebook_path` (not `file_path`) | 23328: `notebook_path` | quoted |
| Bash | 18492: `command`, `timeout?`, `description?`, `run_in_background?` | 22871: no cwd field. 22948-22949 `bashEditDiff?` "@internal Per-file diff of the working-tree changes this command made, for rendering and for PostToolUse Bash hooks (changedFiles: absolute paths of every changed file…)" with `files[].filePath` | quoted. This internal field could show a marker written by Bash; it is not a stable API. |
| EnterWorktree | 18604: `name?`, `path?` | 23114: `worktreePath`, `worktreeBranch?`, `message` | quoted |
| ExitWorktree | 18619: `action`, `discard_changes?` | 23134: `originalCwd`, `worktreePath`, `worktreeBranch?`, `restoredCwd?` (internal) | quoted |
| Envelope | d.ts:14629-14630 | "the tool's arguments beside them (`e.command` for Bash), and `agentId` in a subagent" | quoted |

### 8. Hiding or ordering band rows

| claim | source | quote | conf. |
|---|---|---|---|
| `AbovePromptList` arranges whole rows, one per plugin | d.ts:107-118, 11437-11462 | "Core stacks `rows`. A hook hides or reorders them in what `next(e)` gets, and wraps them by answering around it, never with rows copied by value" | quoted |
| How a mod uses it | ref:201 | "To hide or reorder rows, or wrap the band, hook `AbovePromptList`: pass on only rows from its `e.props.rows`" | quoted |
| What this means for s6qg | — | Each row is one plugin's whole tree (`{ plugin, tree }`), so `AbovePromptList` cannot filter lines inside our own row. The mod must do that filtering in its own `AbovePrompt` tree. | paraphrased |
| The engine's own "n more" row is for scrolling, not folding | d.ts:11361, 11418-11421 | "an `n more` row under it"; "`bodyRows` is `maxRows` less the `n more` row" | quoted |

### 9. `$.session.repo()`

| claim | source | quote | conf. |
|---|---|---|---|
| `root` for a linked worktree is the main tree's root | d.ts:12817 | "The repository's root, absolute: the main working tree's for a worktree." | quoted |
| When it is read | d.ts:2996-2997 | "read from the working copy on each call" | quoted |

### 10. Prior art

| tool | identity it keys on | known failure modes | source | conf. |
|---|---|---|---|---|
| jj workspaces | One working copy plus `.jj/` per workspace; each workspace has its own working-copy commit | A workspace goes "stale" when another workspace changes its commit, or when a `^C` interrupts an update. Fixed with `jj workspace update-stale`. | https://docs.jj-vcs.dev/latest/working-copy/ | quoted. How jj picks the current workspace is not on the page (presumably the directory). |
| VS Code, several repos | `scm.repositories.selectionMode`: multi-repo vs single "selected repository" | "select the intended repository before running an action" | https://code.visualstudio.com/docs/sourcecontrol/repos-remotes | quoted. How the status-bar repository is chosen: not found. |
| claude-squad (one agent per worktree, in tmux) | Its own record of each tmux session plus worktree per task | "timed out waiting for tmux session" | https://github.com/smtg-ai/claude-squad | quoted. The key it uses: not found. |
| Shell prompts (starship) and tmux `pane_current_path` | The directory the shell or pane is in now | Follows every `cd`; nothing stays with a tree | https://starship.rs/config/#git-branch, https://man7.org/linux/man-pages/man1/tmux.1.html | paraphrased. Pages not read in full. |

Across these tools, a status display keys either on the current directory, which moves with every `cd`, or on an explicit claim or record (claude-squad, the "selected repository" in VS Code). None I found keeps a growing set of claimed trees, as the ticket proposes.

### Queries that found nothing

- d.ts and ref: `$.state` together with /clear, resume or a new session in the same process; `$.state` and subagents; a `$.state` size limit; session id across compaction; ExitWorktree moving `root()`; any engine (non-classic) event for a directory or worktree change.
- hooks doc: whether CwdChanged fires for EnterWorktree, ExitWorktree or `/cd`; any sentence on `session_id` changing.
- tools-reference: whether EnterWorktree moves the project root (it says only "the session's working directory").
- claude-squad README: the identity it keys on. VS Code docs: how the status-bar repository is chosen. tmux man page: the `pane_current_path` definition (the fetch cut off).
- Not checked: whether `/cd` keeps the session id or fires `classic.CwdChanged` or `classic.SessionStart`.

### Points that bear on the ticket

1. The ticket's item 3 rests on CwdChanged, but the docs promise it only for "a shell command in the main conversation". Nothing documented confirms it fires for EnterWorktree or `/cd`, so the refresh that claims `root()` is still needed.
2. A `/clear` gives a new session id and fires no `session.start`. Store claims by session id, and detect `/clear` with `session.end` (reason `clear`) or `classic.SessionStart` (source `clear`).
3. A `/cd` loads the new directory's plugin settings, which could unload the mod.
4. The internal `bashEditDiff` field on a Bash result may give the Bash write-claim the ox8b bean wanted. It is internal, so it may change without notice.
