#!/usr/bin/env python3
"""check_pr.py — the PR body's skeleton and its mechanical checks (run step 6).

    check_pr.py --skeleton
    check_pr.py <plan.md> <body.md> [--repo DIR] [--tests-commit SHA] [--head REF]
    check_pr.py --asks <ticket.md> [<ticket.md> ...]

Checking prints one line per failure, `FAIL <check-id> <where>: <what>`, then `PASS` or
`FAIL (<n>)`; exit 0 on PASS, 1 on FAIL, 2 on unusable input. Stdlib only; git is read-only.

  P1 the first line links the plan ending (names the brief or plan and a commit); the sections
     What · Verification · Unreviewed since the last lane · [Decisions] · [Findings] · Follow-up
     exist in that order (Decisions and Findings are dropped when empty).
  P2 Decisions / Findings, when present, are a table with the fixed header and the fixed key.
  P3 Decisions labels ∈ RULING, DEFAULT; Findings labels ∈ APPLY, DECLINE, TICKET, RULING; a
     DECLINE row carries exactly one reason of unreachable, pre-existing, out-of-scope, style,
     superseded, false-positive.
  P4 every RULING / DEFAULT Decisions row names an id the brief records: a §9 id (first column)
     or a ruling §9's "whose ruling" column names (run time), or a plan-time ruling or default —
     an id the header's `authority:` clause names, or one the plan ending defines in bold.
  P5 Unreviewed holds a `git log …` command and its pasted output (or `empty`); with --repo the
     command is re-run at --head (default HEAD) and its commits compared with the pasted ones.
  P6 with --repo and --tests-commit: every `def test_…` in the test files the tests commit
     touched that no test file holds at --head is named in the brief's §9 (Python test naming only:
     another language's repo reads P6 as NOT RUN).

Ask convention (a house convention; --asks counts it): every message that hands the turn to the
ticket owner puts its ask on the ticket, under a level-2 heading

    ## Ask <YYYY-MM-DD> · <kind>

where kind is one of interview, plan-paused, ruling, pr-open, gate, and each question is a line
starting `**Q<n>**`. `--asks` prints, per file, the asks, the questions and the asks by kind; an
`## Ask` heading with another kind or a bad date is a FAIL.
"""
import re
import shlex
import subprocess
import sys
from collections import Counter
from pathlib import Path

DECISIONS_KEY = ("**RULING:** the ticket owner decided before the work went on. **DEFAULT:** "
                 "recommended and shown to the ticket owner, and it stood because they didn't "
                 "strike it.")
FINDINGS_KEY = ("**APPLY:** fixed in this PR. **DECLINE:** looked at and deliberately not acted "
                "on, with the reason. **TICKET:** real, but tracked in its own ticket. Every "
                "finding has a row, ruled ones too, tagged (plan) or (review).")
HEADERS = {"Decisions": ["decision", "label", "what was done", "why"],
           "Findings": ["finding", "label", "what was done", "why"]}
LABELS = {"Decisions": {"RULING", "DEFAULT"}, "Findings": {"APPLY", "DECLINE", "TICKET", "RULING"}}
REASONS = ("unreachable", "pre-existing", "out-of-scope", "style", "superseded", "false-positive")
SECTIONS = ["What", "Verification", "Unreviewed since the last lane", "Decisions", "Findings",
            "Follow-up"]
OPTIONAL = {"Decisions", "Findings"}
ASK_KINDS = ("interview", "plan-paused", "ruling", "pr-open", "gate")
ID_RE = re.compile(r"(?<![\w-])([A-Z]{1,2}\d+[a-z]?|[A-Z]-[A-Z]+\d+[a-z]?)(?![\w-])")
RANGE_RE = re.compile(r"(?<![\w-])([A-Z]{1,2})(\d+)\s*[–-]\s*(?:\1)?(\d+)(?![\w-])")

SKELETON = f"""Plan ending: [brief commit <sha>](<link>) · ticket `<id>` · brief `<path>`

## What

<the change, for a reader who has not seen the ticket>

## Verification

| reading | command | result |
|---|---|---|
| suite and lint against the base | `<command>` | <counts> |
| §5 <rule> | `<command>` | <reading> |
| lane <id> | <what it ran> | <reading> |

## Unreviewed since the last lane

```
$ git log <last reviewed>..HEAD -- <source paths>
<its output>
```
empty — or one RULING row per entry

## Decisions

{DECISIONS_KEY}

| decision | label | what was done | why |
|---|---|---|---|

## Findings

{FINDINGS_KEY}

| finding | label | what was done | why |
|---|---|---|---|

## Follow-up

- <ticket> — <what>
"""


class Unusable(Exception):
    pass


def norm(s):
    return " ".join(s.split())


def read(path):
    try:
        return Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        raise Unusable(f"cannot read {path}: {e}")


def split_row(line):
    body = line.strip().strip("|")
    cells, cur, code = [], "", False
    i = 0
    while i < len(body):
        c = body[i]
        if c == "\\" and body[i + 1:i + 2] == "|":
            cur, i = cur + "|", i + 2
            continue
        code = not code if c == "`" else code
        if c == "|" and not code:
            cells.append(cur)
            cur = ""
        else:
            cur += c
        i += 1
    cells.append(cur)
    if code:
        cells = re.split(r"(?<!\\)\|", body)
    return [c.strip() for c in cells]


def ids_in(text):
    """Ids in a text, ranges like `D1–D7` / `A1–A6` expanded."""
    out = set(ID_RE.findall(text))
    for p, a, z in RANGE_RE.findall(text):
        if int(z) - int(a) < 100:
            out.update(f"{p}{k}" for k in range(int(a), int(z) + 1))
    return out


def sections(body):
    """[(name, lineno, lines)] of `## ` headings."""
    out, cur = [], None
    for k, l in enumerate(body.splitlines()):
        m = re.match(r"^##\s+(.+?)\s*$", l)
        if m:
            cur = (m.group(1), k, [])
            out.append(cur)
        elif cur:
            cur[2].append((k, l))
    return out


def canonical(name):
    for s in SECTIONS:
        if name.lower().startswith(s.lower()):
            return s
    return None


def table(lines):
    """(header cells, [(lineno, cells)]) of the first table in lines, or (None, [])."""
    head, rows = None, []
    for k, l in lines:
        if l.lstrip().startswith("|"):
            c = split_row(l)
            if head is None:
                head = c
            elif not all(re.fullmatch(r":?-{2,}:?", x) for x in c if x):
                rows.append((k, c))
        elif head is not None and l.strip():
            break
    return head, rows


# ---- the brief's records ------------------------------------------------------------------

def brief_records(plan_text):
    lines = plan_text.splitlines()
    nine = [k for k, l in enumerate(lines) if re.match(r"^## 9\.", l)]
    first = next((k for k, l in enumerate(lines) if re.match(r"^## 1\.", l)), len(lines))
    s9_ids, whose_ids, s9_text, ending = set(), set(), "", ""
    if nine:
        end = next((k for k in range(nine[0] + 1, len(lines)) if lines[k].startswith("## ")),
                   len(lines))
        sec = list(enumerate(lines[nine[0] + 1:end], nine[0] + 1))
        s9_text = "\n".join(l for _, l in sec)
        _head, rows = table(sec)
        for _k, c in rows:
            s9_ids |= ids_in(c[0]) | {c[0].strip("* `")}
            if len(c) > 2:
                whose_ids |= ids_in(c[2])
        last_row = max([k for k, _ in rows], default=nine[0])
        ending = "\n".join(lines[last_row + 1:])  # after §9's table: the plan ending
    header = "\n".join(lines[1:first])
    m = re.search(r"authority:(.*?)(?:·\s*planned|$)", header, re.S)
    plan_ids = ids_in(m.group(1)) if m else set()
    for bold in re.findall(r"\*\*([^*]+)\*\*", ending):
        plan_ids |= ids_in(bold.split()[0]) if bold.split() else set()
    return s9_ids, whose_ids, plan_ids, s9_text


# ---- git, read-only -------------------------------------------------------------------------

UNSAFE = re.compile(r"^--(output|ext-diff|textconv|exec|upload-pack)\b|^-c$|^-C$|^--git-dir|"
                    r"^--work-tree")


def git(repo, *args):
    r = subprocess.run(["git", "-C", str(repo), "--no-pager", *args], capture_output=True,
                       text=True)
    if r.returncode:
        raise Unusable(f"git {' '.join(args)}: {r.stderr.strip()[:200]}")
    return r.stdout


def hashes(lines):
    out = []
    for l in lines:
        m = re.match(r"^(?:commit\s+)?([0-9a-f]{7,40})\b", l.strip())
        if m:
            out.append(m.group(1))
    return out


# ---- the checks -----------------------------------------------------------------------------

def check(plan_text, body, repo=None, tests_commit=None, head="HEAD"):
    fails = []

    def fail(cid, where, what):
        fails.append(f"FAIL {cid} {where}: {what}")

    blines = body.splitlines()
    first = next((l for l in blines if l.strip()), "")
    if not (re.search(r"\b(brief|plan)\b", first, re.I) and re.search(r"\b[0-9a-f]{7,40}\b", first)):
        fail("P1", "line 1", "first line does not link the plan ending (brief/plan + commit)")
    secs = sections(body)
    found = [(canonical(n), k, ls) for n, k, ls in secs if canonical(n)]
    names = [n for n, _, _ in found]
    for s in SECTIONS:
        if s not in names and s not in OPTIONAL:
            fail("P1", "body", f"section `## {s}` missing")
    order = [SECTIONS.index(n) for n in names]
    if order != sorted(order):
        fail("P1", "body", f"sections out of order: {names}")
    by = {}
    for n, k, ls in found:
        by.setdefault(n, (k, ls))

    s9_ids, whose_ids, plan_ids, s9_text = brief_records(plan_text)
    known = s9_ids | whose_ids | plan_ids

    for name in ("Decisions", "Findings"):
        if name not in by:
            continue
        k0, ls = by[name]
        text = norm(" ".join(l for _, l in ls))
        head_cells, rows = table(ls)
        if head_cells is None:
            if text:
                fail("P2", f"line {k0 + 1}", f"{name} holds no table (bullets or prose)")
            items = [(k, l) for k, l in ls if re.match(r"^\s*[-*] ", l)]
            for k, l in items:  # read the label a bullet opens with, for P3
                w = re.sub(r"^\s*[-*]\s+", "", l).replace("*", "").split()
                lab = re.sub(r"\W+$", "", w[0]) if w else ""
                if lab not in LABELS[name]:
                    fail("P3", f"line {k + 1}", f"{name} item opens with no label: {lab!r}")
            continue
        if [norm(c.lower()) for c in head_cells] != HEADERS[name]:
            fail("P2", f"line {k0 + 1}", f"{name} header is {head_cells}, not {HEADERS[name]}")
        key = DECISIONS_KEY if name == "Decisions" else FINDINGS_KEY
        if norm(key) not in text:
            fail("P2", f"line {k0 + 1}", f"{name} key missing or not verbatim")
        for k, c in rows:
            c = c + [""] * (4 - len(c))
            lab_cell = c[1].replace("*", "").replace("`", "").strip()
            lab = (lab_cell.split() or [""])[0]
            if lab not in LABELS[name]:
                fail("P3", f"line {k + 1}", f"{name} label {lab_cell!r} not in "
                     f"{sorted(LABELS[name])}")
                continue
            if lab == "DECLINE":
                said = " ".join(c[1:]).lower()
                got = [r for r in REASONS if re.search(
                    r"(?<![\w-])" + r.replace("-", "[- ]") + r"(?![\w-])", said)]
                if len(got) != 1:
                    fail("P3", f"line {k + 1}", f"DECLINE carries {len(got)} reasons "
                         f"{got or ''} (exactly one of {', '.join(REASONS)})")
            if name == "Decisions":
                named = ids_in(c[0]) | ids_in(c[2])
                if not named:
                    fail("P4", f"line {k + 1}", f"{lab} row names no id: {c[0][:60]!r}")
                elif not named & known:
                    fail("P4", f"line {k + 1}", f"{lab} row's ids {sorted(named)} are in no §9 "
                         "row, §9 ruling, authority clause or plan ending")

    # P5
    if "Unreviewed since the last lane" in by:
        k0, ls = by["Unreviewed since the last lane"]
        cmd, pasted, k_cmd = None, None, k0
        in_code, block = False, []
        for idx, (k, l) in enumerate(ls):
            if l.strip().startswith("```"):
                if in_code:
                    in_code = False
                    if cmd is not None and pasted is None:
                        pasted = block
                        if not block:  # an empty block: the next line says `empty`
                            nxt = next((x for _, x in ls[idx + 1:] if x.strip()), "")
                            pasted = [] if nxt.strip().lower().startswith("empty") else None
                    continue
                in_code, block = True, []
                continue
            if in_code:
                m = re.match(r"^\s*\$\s*(git\s+log\b.*)$", l)
                if m and cmd is None:
                    cmd, k_cmd = m.group(1), k
                elif cmd is not None:
                    block.append(l)
            elif cmd is None and (m := re.search(r"`(git\s+log\b[^`]*)`\s*:?\s*(\S.*)?$", l)):
                cmd, k_cmd = m.group(1), k
                rest = (m.group(2) or "").strip().lower()
                pasted = [] if rest.startswith("empty") else None
        if cmd is None:
            fail("P5", f"line {k0 + 1}", "Unreviewed holds no `git log …` command line")
        elif pasted is None:
            fail("P5", f"line {k_cmd + 1}", "the command's pasted output (or `empty`) is missing")
        elif repo:
            args = shlex.split(cmd)[2:]
            bad = [a for a in args if UNSAFE.search(a)]
            if bad:
                fail("P5", f"line {k_cmd + 1}", f"refused to re-run, unsafe options {bad}")
            else:
                args = [re.sub(r"\bHEAD\b", head, a) for a in args]
                try:
                    out = git(repo, "log", "--no-ext-diff", "--no-textconv", *args).splitlines()
                except Unusable as e:  # the pasted command itself does not run
                    fail("P5", f"line {k_cmd + 1}", f"re-run failed: {e}")
                    out = None
            if not bad and out is not None:
                pl = [norm(x) for x in pasted if x.strip()]
                ol = [norm(x) for x in out if x.strip()]
                if pl != ol:
                    ph, oh = hashes(pl), hashes(ol)
                    # a pasted short listing (`<sha> <subject>` per line) of the same commits
                    # in the same order reads as the output; anything else is a mismatch
                    same = len(ph) == len(oh) == len(pl) and all(
                        o.startswith(p) or p.startswith(o) for p, o in zip(ph, oh))
                    if not same:
                        fail("P5", f"line {k_cmd + 1}", f"re-run at {head} lists {len(oh)} "
                             f"commit(s) {oh[:5]}, the body pastes {len(ph)} {ph[:5]}")

    # P6
    if repo and tests_commit:
        names = git(repo, "show", "--name-only", "--format=", tests_commit).split()
        tfiles = [p for p in names if re.search(r"(^|/)(test_[^/]*|[^/]*_test)\.py$", p)]
        before = set()
        for p in tfiles:
            before |= set(re.findall(r"^\s*(?:async\s+)?def\s+(test_\w+)",
                                     git(repo, "show", f"{tests_commit}:{p}"), re.M))
        now = set(re.findall(r"def\s+(test_\w+)", subprocess.run(
            ["git", "-C", str(repo), "--no-pager", "grep", "-h", "-E", "def[[:space:]]+test_", head,
             "--", "*.py"], capture_output=True, text=True).stdout))
        for t in sorted(before - now):
            if not re.search(r"(?<!\w)" + re.escape(t) + r"(?!\w)", s9_text):
                fail("P6", tests_commit[:7], f"{t} is gone at {head} and §9 does not name it")
    return fails


def asks(paths):
    fails, rows = [], []
    for p in paths:
        text = read(p)
        n_ask, n_q, kinds, cur = 0, 0, Counter(), False
        for k, l in enumerate(text.splitlines()):
            if l.startswith("## "):
                cur = False
                if re.match(r"^##\s+Ask\b", l):
                    m = re.match(r"^##\s+Ask\s+(\d{4}-\d{2}-\d{2})\s+·\s+([\w-]+)\s*$", l)
                    if not m or m.group(2) not in ASK_KINDS:
                        fails.append(f"FAIL A1 {p}:{k + 1}: ask heading {l.strip()!r} is not "
                                     f"`## Ask <YYYY-MM-DD> · <{'|'.join(ASK_KINDS)}>`")
                        continue
                    n_ask, cur = n_ask + 1, True
                    kinds[m.group(2)] += 1
            elif cur and re.match(r"^\*\*Q\d+\*\*", l):
                n_q += 1
        by_kind = " ".join(f"{x}={kinds[x]}" for x in ASK_KINDS if kinds[x])
        rows.append(f"{p}: asks={n_ask} questions={n_q} by kind: {by_kind or '-'}")
    return rows, fails


def main(argv):
    args = list(argv)
    try:
        if args == ["--skeleton"]:
            print(SKELETON, end="")
            return 0
        if args[:1] == ["--asks"] and len(args) > 1:
            rows, fails = asks(args[1:])
            for r in rows + fails:
                print(r)
            print("PASS" if not fails else f"FAIL ({len(fails)})")
            return 1 if fails else 0
        opts = {"--head": "HEAD"}
        for flag in ("--repo", "--tests-commit", "--head"):
            if flag in args:
                k = args.index(flag)
                if k + 1 >= len(args):
                    raise Unusable(f"{flag} needs a value")
                opts[flag] = args[k + 1]
                del args[k:k + 2]
        if len(args) != 2 or any(a.startswith("-") for a in args):
            print(__doc__.split("\n\n")[1], file=sys.stderr)
            return 2
        if "--tests-commit" in opts and "--repo" not in opts:
            raise Unusable("--tests-commit needs --repo")
        plan, body = read(args[0]), read(args[1])
        if not re.search(r"^## 9\.", plan, re.M):
            raise Unusable(f"{args[0]}: no `## 9.` section — not a brief")
        fails = check(plan, body, opts.get("--repo"), opts.get("--tests-commit"), opts["--head"])
    except Unusable as e:
        print(f"UNUSABLE: {e}")
        return 2
    for f in fails:
        print(f)
    print("PASS" if not fails else f"FAIL ({len(fails)})")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
