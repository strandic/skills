# leakscan

`scripts/leakscan.mjs` refuses a commit or a push that holds a term from a private list. This repository is public. The list names what must never reach it, such as the name of a company whose private projects use the skills.

The list is a text file kept outside the repository. The script reads the list and the change, and prints where a term was found. It changes nothing.

```
node scripts/leakscan.mjs (--staged | --message <file> | --range <revs> | --pre-push <remote> | --history | --tree | --files <file>...) [--terms <file>] [--show]
```

## The list

The script looks for the list in this order:

1. the file given with `--terms`;
2. the file named by the `LEAKSCAN_TERMS` environment variable;
3. `~/.config/leakscan/terms.txt`.

The scan stops with exit code 2 when there is no list, when the list holds no term, or when the list is inside the repository being scanned. A list inside the repository would be published with it.

The list has one term on each line. A blank line and a line that starts with `#` are skipped.

| Line | What it finds |
|---|---|
| `Acme Corp` | The text, whatever the case. When the term is 6 characters or longer without its separators, it is also found with other separators or none: `acme-corp`, `acme_corp`, `AcmeCorp`. Spaces, dots, dashes and underscores count as separators. |
| `re:\bACME-\d+\b` | A regular expression, whatever the case. Use it for ticket ids and for short words that need a word boundary. |
| `cs:WidgetCo` | The text exactly as written, with its case. |
| `repo:~/work/acme-app` | A commit id of that repository, in full or cut to 7 characters or more. The script asks that repository for its commit ids each time it runs. The scan stops with exit code 2 when the folder does not exist or is no git repository. |

A `repo:` line that names the scanned repository itself is skipped.

## What each mode reads

| Mode | Reads |
|---|---|
| `--staged` | The lines the staged change adds, the paths of the staged files, and the author and committer identity the commit would carry. |
| `--message <file>` | A commit message file. Lines that start with `#` are skipped, as git drops them. |
| `--range <revs>` | Each commit that `git rev-list <revs>` gives: the lines it adds, the paths it adds or changes, its message, and its author and committer. Example: `--range origin/main..HEAD`. |
| `--pre-push <remote>` | The commits a push would send. It reads the pushed refs from standard input, in the form git gives a `pre-push` hook. |
| `--history` | Every commit of every branch and tag, as `--range --all` would. |
| `--tree` | Every tracked file as it is now, and its path. |
| `--files <file>...` | The files named, in full, and their names. Use it on a draft before adding it. |

The scan reads added lines only. A term that a file already holds does not refuse a later change to another line of that file. Use `--tree` and `--history` to find what is already there.

A file that git takes for binary is read as text, byte by byte.

`--show` also prints the text that matched. Without it the script prints the place and the line of the list that holds the term, so that its output can be pasted without repeating the term.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No term was found. |
| 1 | A term was found. Each place is printed on standard output. |
| 2 | The scan could not run: no list, a regular expression that does not compile, a `repo:` folder that is missing, no mode, or a git command that failed. |

## The hooks

`scripts/hooks/` holds three git hooks. Each calls the script that lies beside its folder.

| Hook | Runs | Refuses |
|---|---|---|
| `pre-commit` | `--staged` | A commit whose change, paths or identity hold a term. |
| `commit-msg` | `--message` | A commit whose message holds a term. |
| `pre-push` | `--pre-push` | A push whose commits hold a term. It catches a commit made with `--no-verify`. |

Turn them on once in a clone:

```
git config core.hooksPath scripts/hooks
```

The setting is local to the clone and is shared by its worktrees. With the hooks on and no list, every commit is refused with exit code 2. That is deliberate: a scan with no list finds nothing and would look like a pass.

## Limits

- The scan finds the terms on the list and nothing else. A name that is not on the list passes.
- It reads text. A term in an image, or split over two lines, passes.
- A plain term shorter than 6 characters is matched as written only, so that `abc` does not match `a-b-c`. Use `re:` for such a term.
- `git push --no-verify` skips the push hook. Nothing on the server checks the push.
- A pull request body, an issue and a release note are not commits. Scan a draft of one with `--files`.
- A `repo:` line reads the commit ids the repository holds now. A commit made there later is known at the next run.
