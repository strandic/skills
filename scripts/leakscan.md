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

The list is read as UTF-8.

The list has one term on each line. A blank line and a line that starts with `#` are skipped.

| Line | What it finds |
|---|---|
| `Acme Corp` | The text, whatever the case. When the term has 6 letters and digits or more, it is also found with other separators or none: `acme-corp`, `acme_corp`, `acme/corp`, `AcmeCorp`, `acme%20corp`. Everything that is no letter and no digit counts as a separator. |
| `re:\bACME-\d+\b` | A regular expression, whatever the case. Use it for ticket ids and for short words that need a word boundary. |
| `cs:WidgetCo` | The text exactly as written, with its case. |
| `repo:~/work/acme-app` | A commit id of that repository, in full or cut to 7 characters or more. The script asks that repository for its commit ids each time it runs. The scan stops with exit code 2 when the folder does not exist or is no git repository. |

A `repo:` line that names the scanned repository, or a worktree of it, is skipped.

Three things to know when writing a line:

- The text after `re:` and `cs:` is taken as it is. `cs: WidgetCo`, with a space, looks for a space before the word.
- A term that starts with `#` is taken for a comment. Write it as `re:#name`.
- A regular expression that nests repetitions, such as `(a+)+$`, can run for a very long time on some lines. Nothing stops it. Keep the expressions simple.

Before comparing, the script brings the text and the terms to one form: an accent written as a separate mark equals the accented letter, a non-breaking space equals a space, and NUL bytes are dropped. So a term is found in a UTF-16 file too.

## What each mode reads

| Mode | Reads |
|---|---|
| `--staged` | The lines the staged change adds, the paths of the staged files, and the author and committer identity the commit would carry. In a hook it reads the index git is committing from, so a commit of some paths only is read as it will be made. |
| `--message <file>` | A commit message file, up to a scissors line. A line that starts with `#` is read too: git keeps such a line when the message comes from `-m`. So a term in the comment lines git offers, such as the branch name, refuses the commit. |
| `--range <revs>` | Each commit that `git rev-list <revs>` gives: the lines it adds, the paths it adds or changes, its message, and its author and committer. Example: `--range origin/main..HEAD`. |
| `--pre-push <remote>` | What a push would send. It reads the pushed refs from standard input, in the form git gives a `pre-push` hook. It reads the name of each pushed branch or tag, the commits, a tag's message and tagger, and the content of a tag that points at a file or a folder. See [Which commits a push reads](#which-commits-a-push-reads). |
| `--history` | Every commit of every ref, the name of every ref, and every tag as `--pre-push` reads it. |
| `--tree` | Every tracked file as the index holds it, and its path. A link is read as the text it points to. A file that is tracked and missing from the folder is still read. A change that is not staged is not. |
| `--files <file>...` | The files named, in full, and their names. Use it on a draft before adding it. A folder is refused with exit code 2: name each file. |

The scan reads added lines only. A term that a file already holds does not refuse a later change to another line of that file. Use `--tree` and `--history` to find what is already there.

A file that git takes for binary is read as text. Text is read as UTF-8.

### Which commits a push reads

A push to a branch that the other side already has reads the commits between its old tip and the new one. When this repository does not hold the old tip, as in a forced push over someone else's work, it reads as for a new branch.

A push of a new branch reads the commits that the remote's tracking refs do not hold. That is right only when those refs describe the place the push goes to. So when the remote is given as an address, or is fetched from one address and pushed to another, the script assumes nothing and reads every commit of the branch.

`--show` also prints the term that matched, and the path, file name or ref name when the term is in one. Without it the script prints the place and the line of the list that holds the term, so that its output can be pasted without repeating the term.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No term was found. |
| 1 | A term was found. Each place is printed on standard output. |
| 2 | The scan could not run: no list, a regular expression that does not compile, a `repo:` folder that is missing, no mode, a file that cannot be read, a git command that failed, or any other error. |

## The hooks

`scripts/hooks/` holds three git hooks. Each calls the script that lies beside its folder.

| Hook | Runs | Refuses |
|---|---|---|
| `pre-commit` | `--staged` | A commit whose change, paths or identity hold a term. |
| `commit-msg` | `--message` | A commit whose message holds a term. |
| `pre-push` | `--pre-push` | A push whose commits hold a term. It catches a commit made with `--no-verify`. |

Turn them on once in a clone. Copy the hooks and the script to a folder outside the repository, and point git at the copy:

```
mkdir -p ~/.config/leakscan/hooks
cp scripts/leakscan.mjs ~/.config/leakscan/
cp scripts/hooks/* ~/.config/leakscan/hooks/
git config core.hooksPath ~/.config/leakscan/hooks
```

Do not set `core.hooksPath` to `scripts/hooks` itself. git looks for that folder in the checkout at hand. A worktree or a branch that is older than the script has no such folder, and git then runs no hook and says nothing.

The setting is local to the clone and is shared by its worktrees. Copy the script again when it changes.

With the hooks on and no list, every commit is refused with exit code 2. That is deliberate: a scan with no list finds nothing and would look like a pass.

## Limits

- The scan finds the terms on the list and nothing else. A name that is not on the list passes.
- It reads text, line by line. A term in an image, or split over two lines, passes.
- A plain term is found with other separators, not with other letters: `Acme Corp` does not find `Acme Corporation` cut short, a misspelling or a translation.
- The match ignores word boundaries: the term `Acme Co` is found in `acme cooperative`. Use `re:` with `\b` when that refuses ordinary text.
- A plain term with fewer than 6 letters and digits is matched as written only, so that `abc` does not match `a-b-c`. Use `re:` for such a term.
- `git cherry-pick`, `git rebase`, `git am` and a merge without conflict make commits without running the commit hooks. The push hook reads those commits.
- `git push --no-verify` skips the push hook. Nothing on the server checks the push.
- `--history` and a first push hold everything they read in memory. A repository of tens of thousands of commits needs a few minutes and some hundred megabytes.
- A pull request body, an issue and a release note are not commits. Scan a draft of one with `--files`.
- A `repo:` line reads the commit ids the repository holds now. A commit made there later is known at the next run.
