#!/usr/bin/env python3
"""check_pr.py — the PR body's skeleton and its mechanical checks (run step 6).

    check_pr.py --skeleton
    check_pr.py <plan.md | ticket.md> <body.md> [--repo DIR] [--tests-commit SHA] [--head REF]
                [--base REF] [--written-under X.Y]
    check_pr.py --asks [--repo DIR] [--written-under X.Y] <ticket.md> [<ticket.md> ...]

Checking prints one line per failure, `FAIL <check-id> <where>: <what>`, then `PASS` or
`FAIL (<n>)`; exit 0 on PASS, 1 on FAIL, 2 on unusable input. Stdlib only; git is read-only.
HTML comments in the body (the skeleton's) are not read.

Empty inputs: a ticket given to --asks may not be empty (0 lines: `FAIL A0`); a tests commit
touching no Python test file reads `P6 NOT RUN`, never a silent pass. A brief or ticket with no
plan ending is unusable (exit 2).

Format versions: a record is read under the format it was written in. A brief's header names it
(`skill … 0.8.0`); a ticket names none, so a replay passes `--written-under 0.8`. Checks younger
than the record's format print `<id> not applicable (pre-v<X.Y> format)`: P4 on a ticket, P7, M1,
A2 and an unreadable bold line in an ask since v0.9; P10 and A3 since v0.10. With no version
named the record is read as current.

  P1 the first line links the plan ending (names the brief or plan and a commit); the sections
     What · Verification · Unreviewed since the last lane · [Decisions] · [Findings] · Follow-up
     exist in that order (Decisions and Findings are dropped when empty).
  P2 Decisions / Findings, when present, are a table with the fixed header and the fixed key.
  P3 Decisions labels ∈ RULING, DEFAULT; Findings labels ∈ APPLY, DECLINE, TICKET, RULING; a
     DECLINE row carries exactly one reason of unreachable, pre-existing, out-of-scope, style,
     superseded, false-positive.
  P4 every RULING / DEFAULT Decisions row names an id the plan ending records: a §9 id (first
     column) or a ruling §9's "whose ruling" column names (run time), an id the header's
     `authority:` clause names, one the plan ending defines in bold, or one on an `unruled:` line.
  P5 Unreviewed holds a `git log …` command and its pasted output (or `empty`); with --repo the
     command is re-run at --head (default HEAD) and its commits compared with the pasted ones.
  P6 with --repo and --tests-commit: every `def test_…` in the test files the tests commit
     touched that no test file holds at --head is named in the brief's §9 (Python test naming only:
     another language's repo reads P6 as NOT RUN).
  P7 Verification: each reading that says "base" names a commit SHA (7–40 hex, a digit among
     them) in its row. A table row says it in its reading or result cell (the command cell names
     what ran); a line outside a table, anywhere in it; a fenced block is not read.
  P8 ids are unique: no §5 rule id (`**R1**`) is also a §9 id, and no §9 id has two rows.
  M1 with a decisions.md beside the brief: each line opening with a date reads
     `<date> | <id> RULING|DEFAULT | <decision> | <why>`, one id per line, each id once (other
     lines — a heading, a format note — are not entries); every §9 id and `unruled:` id is a line
     there, of the same kind (§9: `default` in "whose ruling" is DEFAULT, `pending` or
     `ruled in <id>` is a stop row and not mirrored, anything else RULING; `unruled:` is
     DEFAULT); a line's id outside both is an id the header's `authority:` clause names (a
     plan-time ruling, written before §9 existed). A RULING line whose answer — its quoted
     words, or the whole why cell when nothing is quoted — is only the run invocation
     (`/shawarma run t-0001`) fails: the go never answers a RULING.
  P9 with --repo: every commit in --base..--head (default base: the merge base with `main`,
     `master` or `origin/HEAD`) touching a path outside `docs/`, `.beans/` and `*.md` has a
     `plan(<ticket>)` commit among its ancestors (the plan ending precedes the code).
  P10 a "Known limit" line of the body (or, for a heading, its section) names a ticket: a
     backticked `<x>-<y>`, `#<n>`, a word `<x>-<y>` whose tail holds a digit, or a word with the
     plan's ticket prefix.

Trivial mode: when the first file has no `## 9.` section it is read as the ticket. Its plan
ending is the latest `## Plan` note (house rules: the ticket's `## Plan (<date>)` heading); P4
reads a DEFAULT row's id from that note's `unruled:` lines, a RULING row's from those lines or an
id the ticket writes in bold (its rulings). P6, P8 and M1 need §9 and print
`<id> not applicable (trivial)`.

Id grammar (P4, P8, M1, --asks and `unruled:` read exactly this; L a capital, l a lowercase
letter, D digits):
  head        L or LL, then optionally D and optionally l + optional D   Q1 D5 PD1 RB1 RV1a W3r2
  head-tail   a head, `-`, a tail: LL? D? l? · l D? · D                  A-B3 R-A R-1 D-3 RR1-a
                                                                       W1-b W1-1 W0-R1 W3-D12
                                                                       W3-n1 R1-Q1 W3r2-D1
  bare        L or LL alone, read only in an id slot (below)             RB
  limits      in running text an id holds a digit or a hyphen (so `PR`, `OK` are words); a
              letters-only head before `-` is one capital (`R-1`; a tracker key `ABC-12` or
              `AB-12` is not an id); a lowercase tail is one letter, digits after it optional
              (`RR1-ab` is no id at all, nor is its `RR1` part); an id never touches a letter,
              digit or `-` on either side.
  id slots    a §9 row's first cell; a bold lead `**<id>**`; the first word after `unruled:`;
              a decisions.md line's id; a Decisions row's lead `**<id>**` or `<id>:`.
  ranges      `<id><sep><end>` expands to every id between; sep is `–`, `—` or `..` (`D1–D7`,
              `D1–7`, `W3-D1..D3`, `W9-R1–R6` → W9-R1..W9-R6) or `-` when the end repeats the
              letters (`Q1-Q4`, `A1-A5`; `W1-1` is one id); a wave prefix carries to every id;
              the far end is never read as an id of its own; at most 100 ids. Markup on each
              end is read when both ends carry the same (`**D1**–**D29**`, `` `D1`–`D3` ``);
              mismatched markup (`**D1**–D3`) or other letters (`**D1**–**Q3**`) is no range.

Ask convention (a house convention; --asks counts it): every message that hands the turn to the
ticket owner puts its ask on the ticket, under a level-2 heading

    ## Ask <YYYY-MM-DD> · <kind>

where kind is one of interview, plan-paused, plan-ending, ruling, pr-open, gate, and each
question is a line starting `**<id>**` (the grammar above; a list item `- **<id>**` too), with a
`> **What this is about:**` blockquote above it in its section. `--asks` prints, per file, the
asks, the questions and the asks by kind; `UNPARSED: <file>:<n>: <line>` for an `## Ask` heading
or a bold-led line in an ask it cannot read (exit 1); FAIL A2 for a question with no blockquote
above it; UNPARSED (A3) for a `## Plan (<date>)` with no `## Ask <date> · plan-ending` or a
`## Built (<date>)` with no `## Ask <date> · pr-open` (an undated heading: any ask of that kind).
With --repo it also counts the asks and answers in git: an ask is keyed on (ticket, the `## Ask`
heading its `ask(<ticket>)` commit adds), so a re-commit counts once (an ask commit adding no
heading is the previous ask while no answer came between); an answer is `rule(<ticket>): <ids>`
(a scrap `rule(<ticket>): <id> — scrap`); an older `chore(beans): <ticket> — ruling <id>` is read
as one with a deprecation note. It prints the minutes from each ask to the next answer.
"""
import re
import shlex
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True  # the skill's folder stays clean (run.md; round-10 D12)

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
ASK_KINDS = ("interview", "plan-paused", "plan-ending", "ruling", "pr-open", "gate")
# The id grammar of the docstring, as patterns; test_checks.py holds one case per form.
_TAIL = r"(?:[A-Z]{1,2}\d*[a-z]?|[a-z]\d*|\d+)"
_HEAD_D = r"[A-Z]{1,2}\d+(?:[a-z]\d*)?"  # a head holding digits
SLOT_RE = re.compile(rf"(?:{_HEAD_D}(?:-{_TAIL})?|[A-Z]-{_TAIL}|[A-Z]{{1,2}})")  # fullmatch only
ID_RE = re.compile(rf"(?<![\w-])({_HEAD_D}(?:-{_TAIL})?|[A-Z]-{_TAIL})(?![\w-])")
# `mk`: the same markup (`**` or a backtick) on each end, or none (an empty group, so the
# backreferences always resolve)
RANGE_RE = re.compile(r"(?<![\w-])(?P<mk>\*\*|`|)(?P<pre>(?:[A-Z]{1,2}\d+(?:[a-z]\d*)?-)?)"
                      r"(?P<let>[A-Z]{1,2})(?P<a>\d+)(?P=mk)\s*(?P<sep>–|—|\.\.|-)\s*(?P=mk)"
                      r"(?P<far>(?:(?P=pre))?(?:(?P=let))?)(?P<z>\d+)(?P=mk)(?![\w-])")
WHAT_ABOUT = re.compile(r"^\s*>\s*(?:\*\*)?What this is about:")
CURRENT = (0, 10)  # the format this checker writes; a record names its own (docstring)
SINCE = {"P4t": (0, 9), "P7": (0, 9), "M1": (0, 9), "A2": (0, 9), "A1": (0, 9),
         "P10": (0, 10), "A3": (0, 10)}  # P4t: P4 on a ticket; A1: a bold line in an ask
RUN_ONLY = re.compile(r"/?[\w:.-]*\s*\brun\s+[\w.-]+")  # `/shawarma run t-0001`
DOCS_PATH = re.compile(r"^(?:docs/|\.beans/)|\.md$")


def version(text):
    """(major, minor) from `0.8`, `v0.8.0`, `skill shawarma v0.8.0`, or None."""
    m = re.search(r"\bv?(\d+)\.(\d+)(?:\.\d+|\.x)?\b", text or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


def header_version(header):
    """The skill version a brief's header names (`skill 0.8.0`, `skill shawarma v0.8.0`)."""
    m = re.search(r"\bskill\b[^)·\n]*?\bv?(\d+\.\d+)", header)
    return version(m.group(1)) if m else None


def too_young(check_id, ver):
    """`<id> not applicable (pre-vX.Y format)` when the check is younger than ver, else None."""
    since = SINCE.get(check_id)
    if ver and since and ver < since:
        return f"{check_id.rstrip('t')} not applicable (pre-v{since[0]}.{since[1]} format)"
    return None

SKELETON = f"""Plan ending: [brief commit <sha>](<link>) · ticket `<id>` · brief `<path>`
<!-- The first line links the plan ending: the brief's commit, or on the trivial path the
ticket's plan-note commit (`Plan ending: [trivial note <sha>](<link>) · ticket <id>`). No plan
ending, no PR. The sections and keys below are the checker's (P1–P5); fill them, run
`check_pr.py <brief or ticket> <this body> --repo <worktree> --tests-commit <tests sha>`, open
the PR only on its PASS (or with its FAIL disclosed in the body and a ticket for the checker).
Every row reads without the ticket or the brief: an id defined elsewhere stands only beside a
link to its record. These comments are not read by the checker; delete them. -->

## What

<the change, for a reader who has not seen the ticket>

## Verification

<!-- Suite and lint against the base, each §5 rule and each lane reading, all taken on the PR
head. A reading that says "base" names the base commit's SHA in its row (P7). -->

| reading | command | result |
|---|---|---|
| suite and lint against the base | `<command>` at base `<sha>` and head `<sha>` | <counts> |
| §5 <rule> | `<command>` | <reading> |
| lane <id> | <what it ran> | <reading> |

## Unreviewed since the last lane

<!-- The pasted output of `git log <last reviewed>..HEAD -- <source paths>`, then `empty` or one
RULING row per entry in Decisions. A PR without this section is not opened. -->

```
$ git log <last reviewed>..HEAD -- <source paths>
<its output>
```
empty — or one RULING row per entry

## Decisions

<!-- Written only here. One row per RULING and DEFAULT; the decision cell names its id (a §9
id, the ticket's ruling, an `unruled:` id) beside a link to its record. Why gives the reason
only. Drop the section, key included, when there is no row. -->

{DECISIONS_KEY}

| decision | label | what was done | why |
|---|---|---|---|

## Findings

<!-- Written only here. Every finding has a row, tagged (plan) or (review); a DECLINE names
exactly one reason. Drop the section, key included, when there is no row. -->

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


def ranges(text):
    """[(span, ids)] of the ranges in a text (the docstring's grammar)."""
    out = []
    for m in RANGE_RE.finditer(text):
        a, z, far = int(m.group("a")), int(m.group("z")), m.group("far")
        if m.group("sep") == "-" and not far.endswith(m.group("let")):
            continue  # `W1-1`, `D1-7`: one id, not a range
        if not 0 < z - a < 100:
            continue
        p = m.group("pre") + m.group("let")
        out.append((m.span(), [f"{p}{k}" for k in range(a, z + 1)]))
    return out


def ids_in(text):
    """Ids in running text, ranges expanded; a range's far end is never read on its own."""
    out, spans = set(), []
    for span, got in ranges(text):
        out.update(got)
        spans.append(span)
    for a, z in reversed(spans):
        text = text[:a] + " " * (z - a) + text[z:]
    out.update(ID_RE.findall(text))
    return out


def slot_id(token):
    """The id in an id slot (a cell, a bold lead, the word after `unruled:`), or None."""
    t = token.strip().strip("*`").rstrip(":,;.").strip("*`")
    return t if SLOT_RE.fullmatch(t) else None


def lead_id(cell):
    """A Decisions cell's lead id: `**<id>**…` or `<id>: …`, or None."""
    m = re.match(r"^\s*\*\*([^*]+)\*\*", cell) or re.match(r"^\s*`?([^\s:`]+)`?:", cell)
    return slot_id(m.group(1)) if m else None


def unruled_ids(text):
    """(ids, [(lineno, line, id or None)]) of the `unruled:` lines in a text."""
    ids, lines = set(), []
    for k, line in enumerate(text.splitlines()):
        m = re.match(r"^\s*(?:[-*]\s+)?(?:\*\*)?unruled:(?:\*\*)?\s*(\S*)", line)
        if not m:
            continue
        i = None if m.group(1).lower().strip(".") == "none" else slot_id(m.group(1))
        if i:
            ids.add(i)
        lines.append((k, line, i))
    return ids, lines


def strip_comments(text):
    """HTML comments blanked, line count kept."""
    return re.sub(r"<!--.*?-->", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)


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

class Records:
    """What a plan ending records: the ids P4, P8 and M1 read."""

    def __init__(self):
        self.trivial = False
        self.s9_ids, self.whose_ids, self.plan_ids, self.unruled = set(), set(), set(), set()
        self.bold_ids = set()  # trivial: ids the ticket writes in bold (its rulings)
        self.s9_text, self.s9_rows, self.s5_ids, self.authority = "", [], set(), set()
        self.version, self.ticket = None, None  # the header's skill version; `Ticket `<id>``

    def known(self, label):
        if self.trivial:
            return self.unruled if label == "DEFAULT" else self.unruled | self.bold_ids
        return self.s9_ids | self.whose_ids | self.plan_ids | self.unruled


def section_of(lines, k0):
    """(start, end) line indexes of the `## ` section holding line k0."""
    a = next((k for k in range(k0, -1, -1) if lines[k].startswith("## ")), 0)
    z = next((k for k in range(k0 + 1, len(lines)) if lines[k].startswith("## ")), len(lines))
    return a, z


def plan_note_span(lines, k0):
    """(start, end) of the `## Plan` note at k0 and the `## Ask … · plan-ending` sections right
    after it (house rules: the plan-ending ask holds the `unruled:` line)."""
    a, z = section_of(lines, k0)
    while z < len(lines) and re.match(r"^##\s+Ask\b.*·\s*plan-ending\s*$", lines[z]):
        z = section_of(lines, z)[1]
    return a, z


def brief_records(plan_text):
    lines = plan_text.splitlines()
    r = Records()
    nine = [k for k, l in enumerate(lines) if re.match(r"^## 9\.", l)]
    first = next((k for k, l in enumerate(lines) if re.match(r"^## 1\.", l)), len(lines))
    ending = ""
    if nine:
        end = next((k for k in range(nine[0] + 1, len(lines)) if lines[k].startswith("## ")),
                   len(lines))
        sec = list(enumerate(lines[nine[0] + 1:end], nine[0] + 1))
        r.s9_text = "\n".join(l for _, l in sec)
        _head, rows = table(sec)
        for k, c in rows:
            row_ids = ids_in(c[0]) | ({slot_id(c[0])} - {None})
            r.s9_ids |= row_ids
            whose = c[2] if len(c) > 2 else ""
            kind = "DEFAULT" if re.match(r"^\W*default\b", whose, re.I) else "RULING"
            if re.match(r"^\W*(pending|ruled in)\b", whose, re.I):
                kind = "stop"  # a stop row: its decision is the row it names
            r.s9_rows.append((k, row_ids, kind))
            if len(c) > 2:
                r.whose_ids |= ids_in(c[2])
        last_row = max([k for k, _ in rows], default=nine[0])
        ending = "\n".join(lines[last_row + 1:])  # after §9's table: the plan ending
    five = [k for k, x in enumerate(lines) if re.match(r"^## 5\.", x)]
    if five:
        a, z = section_of(lines, five[0])
        for line in lines[a + 1:z]:
            m = re.match(r"^\s*[-*]\s+\*\*([^*\s]+)", line)
            if m and slot_id(m.group(1)):
                r.s5_ids.add(slot_id(m.group(1)))
    header = "\n".join(lines[1:first])
    r.version = header_version(header)
    m = re.search(r"\bTicket\s+`([^`]+)`", header)
    r.ticket = m.group(1) if m else None
    m = re.search(r"authority:(.*?)(?:·\s*planned|$)", header, re.S)
    r.authority = ids_in(m.group(1)) if m else set()
    r.plan_ids = set(r.authority)
    for bold in re.findall(r"\*\*([^*]+)\*\*", ending):
        r.plan_ids |= ids_in(bold.split()[0]) if bold.split() else set()
    r.unruled = unruled_ids(plan_text)[0]
    return r


def ticket_records(ticket_text):
    """Trivial mode: the latest `## Plan` note is the plan ending."""
    lines = ticket_text.splitlines()
    plans = [k for k, line in enumerate(lines) if re.match(r"^##\s+Plan\b", line)]
    if not plans:
        raise Unusable("no `## 9.` section and no `## Plan` note — neither a brief nor a ticket "
                       "with a plan ending")
    a, z = plan_note_span(lines, plans[-1])
    r = Records()
    r.trivial = True
    r.unruled = unruled_ids("\n".join(lines[a:z]))[0]
    for bold in re.findall(r"\*\*([^*]+)\*\*", ticket_text):
        i = slot_id(bold.split()[0]) if bold.split() else None
        if i:
            r.bold_ids.add(i)
    return r


def decisions_lines(text):
    """[(lineno, id, kind)] and [(lineno, line)] it cannot read, of a decisions.md."""
    good, bad = [], []
    for k, line in enumerate(text.splitlines()):
        if not re.match(r"^\d{4}-\d{2}-\d{2}\b", line):
            continue  # a heading or a prose line is not an entry
        m = re.match(r"^\d{4}-\d{2}-\d{2} \| (\S+) (RULING|DEFAULT) \| .*\S.* \| .*\S", line)
        i = slot_id(m.group(1)) if m else None
        if i and m.group(1) == i:
            good.append((k, i, m.group(2)))
        else:
            bad.append((k, line))
    return good, bad


def run_only(line):
    """A decisions.md line whose answer is only the run invocation: its quoted words (`"…"`,
    `“…”`, `` `…` ``) are all `/shawarma run <t>`, or its why cell is, when nothing is quoted."""
    why = line.split(" | ", 3)[3] if line.count(" | ") >= 3 else ""
    quoted = re.findall(r'"([^"]*)"|“([^”]*)”|`([^`]*)`', why)
    quoted = [next(x for x in q if x) for q in quoted if any(q)]
    if quoted:
        return all(RUN_ONLY.fullmatch(q.strip()) for q in quoted)
    bare = re.sub(r"^\s*(?:the\s+)?(?:owner|human)\s*:\s*", "", why, flags=re.I)
    return bool(RUN_ONLY.fullmatch(bare.strip().rstrip(".")))


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


def ticket_names(tid):
    """A ticket's names in commit scopes: `proj-ab12` and `ab12`."""
    return {tid, tid.rsplit("-", 1)[-1]}


def plan_ancestry(repo, head, base, tid):
    """P9: (fails, notes). Each non-docs commit in base..head needs a `plan(<tid>)` ancestor."""
    if not tid:
        return [], ["P9 NOT RUN (no ticket id: the brief's `Ticket `<id>`` or the ticket file)"]
    if base is None:
        for ref in ("main", "master", "origin/HEAD"):
            r = subprocess.run(["git", "-C", str(repo), "merge-base", head, ref],
                               capture_output=True, text=True)
            if r.returncode == 0:
                base = r.stdout.strip()
                break
        else:
            return [], ["P9 NOT RUN (no base: pass --base)"]
    names = ticket_names(tid)
    plans = [h for h, _, s in (x.partition("\t") for x in
                               git(repo, "log", "--format=%H%x09%s", head).splitlines())
             if (m := re.match(r"^plan\(([^)]+)\)", s)) and m.group(1) in names]
    fails, code = [], 0
    for sha in git(repo, "log", "--no-merges", "--format=%H", f"{base}..{head}").split():
        paths = git(repo, "show", "--name-only", "--format=", sha).split()
        if all(DOCS_PATH.search(p) for p in paths):
            continue
        code += 1
        if not any(subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", p, sha],
                                  capture_output=True).returncode == 0 for p in plans):
            code_paths = [p for p in paths if not DOCS_PATH.search(p)][:3]
            fails.append(f"FAIL P9 {sha[:8]}: touches {code_paths} with no `plan({tid})` commit "
                         "among its ancestors")
    none = f"P9 not applicable (no non-docs commit in {base[:8]}..{head})"
    return fails, ([] if code else [none])


TICKET_WORD = r"(?<![\w-])[a-z][a-z0-9]*-(?=[a-z0-9]*\d)[a-z0-9]+(?![\w-])"


def known_limit_fails(blines, tid):
    """P10: a "Known limit" line (a heading: its section) naming no ticket."""
    pats = [r"`[A-Za-z][\w.]*-\w+`", r"(?<![\w&])#\d+\b", TICKET_WORD]
    if tid and "-" in tid:
        pats.append(r"(?<![\w-])" + re.escape(tid.rsplit("-", 1)[0]) + r"-\w+")
    fails, fenced = [], False
    for k, line in enumerate(blines):
        if line.strip().startswith("```"):
            fenced = not fenced
        if fenced or not re.search(r"\bknown limits?\b", line, re.I) or \
                re.search(r"\bno known limits?\b", line, re.I):
            continue
        unit = line
        if line.startswith("#"):
            z = next((j for j in range(k + 1, len(blines)) if blines[j].startswith("#")),
                     len(blines))
            unit = "\n".join(blines[k:z])
        if not any(re.search(p, unit) for p in pats):
            fails.append(f"FAIL P10 line {k + 1}: a known limit names no ticket: "
                         f"{norm(line)[:60]!r}")
    return fails


# ---- the checks -----------------------------------------------------------------------------

def check(plan_text, body, repo=None, tests_commit=None, head="HEAD", decisions=None,
          notes=None, base=None, ticket=None, written_under=None):
    """FAIL lines for a body against its plan ending (a brief, or a ticket: trivial mode).
    decisions: a decisions.md's text beside the brief (M1); notes: a list that receives the
    `not applicable (…)` and `NOT RUN` lines; base: P9's base ref; ticket: the ticket id (a
    brief's header names it otherwise); written_under: the record's format, (major, minor)."""
    fails = []
    notes = [] if notes is None else notes

    def fail(cid, where, what):
        fails.append(f"FAIL {cid} {where}: {what}")

    body = strip_comments(body)
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

    trivial = not re.search(r"^## 9\.", plan_text, re.M)
    rec = ticket_records(plan_text) if trivial else brief_records(plan_text)
    s9_text = rec.s9_text
    ver = written_under or rec.version
    ticket = ticket or rec.ticket
    young = {c: too_young(c, ver) for c in SINCE}
    notes += [young[c] for c in ("P4t", "P7", "M1", "P10") if young[c]
              and (c != "P4t" or rec.trivial) and (c != "M1" or not rec.trivial)]

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
            if name == "Decisions" and not (rec.trivial and young["P4t"]):
                named = ids_in(c[0]) | ids_in(c[2]) | ({lead_id(c[0])} - {None})
                where = ("`unruled:` line of the plan note" if lab == "DEFAULT" else
                         "`unruled:` line or bold id of the ticket") if rec.trivial else \
                    "§9 row, §9 ruling, authority clause, plan ending or `unruled:` line"
                if not named:
                    fail("P4", f"line {k + 1}", f"{lab} row names no id: {c[0][:60]!r}")
                elif not named & rec.known(lab):
                    fail("P4", f"line {k + 1}", f"{lab} row's ids {sorted(named)} are in no "
                         f"{where}")

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

    # P7
    if "Verification" in by and not young["P7"]:
        _k0, ls = by["Verification"]
        fenced = False
        for k, line in ls:
            if line.strip().startswith("```"):
                fenced = not fenced
                continue
            if fenced or not line.strip() or re.fullmatch(r"\s*\|?[\s:|-]+\|?\s*", line):
                continue  # a fenced example is not a reading
            said = line
            if line.lstrip().startswith("|"):
                c = split_row(line)
                if [norm(x.lower()) for x in c][:1] == ["reading"]:
                    continue  # the table's header
                said = f"{c[0]} {c[-1]}"  # the reading and its result; the command cell
                # names what ran (`base / mutant builds` is not a base reading)
            if re.search(r"(?<![\w-])base(?![\w-])", said, re.I) and not re.search(
                    r"(?<![\w-])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w-])", line):
                fail("P7", f"line {k + 1}", f"a base reading names no commit SHA: "
                     f"{norm(line)[:70]!r}")

    # P9, P10
    if repo:
        f9, n9 = plan_ancestry(repo, head, base, ticket)
        fails += f9
        notes += n9
    if not young["P10"]:
        fails += known_limit_fails(blines, ticket)

    if rec.trivial:
        notes += [f"{c} not applicable (trivial)" for c in ("P6", "P8", "M1")]
        return fails

    # P8
    for i in sorted(rec.s5_ids & rec.s9_ids):
        fail("P8", "brief", f"{i} is both a §5 rule id and a §9 id")
    seen = Counter(i for _k, ids, _kind in rec.s9_rows for i in ids)
    for i in sorted(x for x, n in seen.items() if n > 1):
        fail("P8", "brief §9", f"{i} has {seen[i]} rows")

    # M1
    if decisions is not None and not young["M1"]:
        good, bad = decisions_lines(decisions)
        dlines = decisions.splitlines()
        for k, i, kind in good:
            if kind == "RULING" and run_only(dlines[k]):
                fail("M1", f"decisions.md:{k + 1}", f"{i} RULING is answered only by the run "
                     "invocation: the go never answers a RULING")
        for k, l in bad:
            fail("M1", f"decisions.md:{k + 1}", f"not `<date> | <id> RULING|DEFAULT | <decision> "
                 f"| <why>` (one id): {norm(l)[:70]!r}")
        dkind = {}
        for k, i, kind in good:
            if i in dkind:
                fail("M1", f"decisions.md:{k + 1}", f"{i} has a second line")
            dkind.setdefault(i, kind)
        want = {}
        for _k, ids, kind in rec.s9_rows:
            for i in ids:
                if kind != "stop":
                    want.setdefault(i, kind)
        for i in rec.unruled:
            want.setdefault(i, "DEFAULT")
        for i, kind in sorted(want.items()):
            if i not in dkind:
                fail("M1", "decisions.md", f"{i} ({kind}, §9 or `unruled:`) has no line")
            elif dkind[i] != kind:
                fail("M1", "decisions.md", f"{i} is {dkind[i]} there, {kind} in the brief")
        for i in sorted(set(dkind) - set(want) - rec.authority):
            fail("M1", "decisions.md", f"{i} is in no §9 row, `unruled:` line or authority "
                 "clause")

    # P6
    if repo and tests_commit:
        names = git(repo, "show", "--name-only", "--format=", tests_commit).split()
        tfiles = [p for p in names if re.search(r"(^|/)(test_[^/]*|[^/]*_test)\.py$", p)]
        if not tfiles:
            notes.append(f"P6 NOT RUN (the tests commit {tests_commit[:8]} touches no Python "
                         "test file)")
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


def ticket_id(path, text):
    """The ticket's id: its `# <id>` line, else the file name up to `--`."""
    m = re.search(r"^#\s+(\S+)\s*$", text, re.M)
    return m.group(1) if m else Path(path).name.split("--")[0].removesuffix(".md")


def ask_waits(repo, tid):
    """(asks, rules, [minutes from each ask to the next answer], notes) from git log. An ask is
    keyed on the `## Ask` heading its commit adds; an answer is a `rule(<t>)` commit, or an older
    `chore(beans): <t> — ruling <id>` one (read, with a deprecation note)."""
    names = ticket_names(tid)
    log = git(repo, "log", "--reverse", "--format=%H%x09%ct%x09%s")
    seq, notes, seen = [], [], set()
    for line in log.splitlines():
        sha, t, subj = line.split("\t", 2)
        m = re.match(r"^(ask|rule)\(([^)]+)\)", subj)
        old = re.match(r"^chore\(beans\):\s+(?:scrap\s+)?(\S+)\b.*\bruling\b", subj)
        if m and m.group(2) in names and m.group(1) == "ask":
            added = {x[1:].strip() for x in git(repo, "show", "--format=", "-U0", sha).splitlines()
                     if re.match(r"^\+##\s+Ask\b", x)}
            if added - seen:
                pass
            elif added or (seq and seq[-1][0] == "ask"):
                continue  # the same ask, committed again before any answer
            seen |= added
            seq.append(("ask", int(t)))
        elif m and m.group(2) in names:
            seq.append(("rule", int(t)))
        elif old and old.group(1) in names:
            seq.append(("rule", int(t)))
            notes.append(f"note: {sha[:8]} answers in the deprecated form `chore(beans): … "
                         f"ruling <id>`, read as `rule({tid})`: {subj[:60]!r}")
    waits = []
    for k, (kind, t) in enumerate(seq):
        if kind == "ask":
            nxt = next((t2 for kind2, t2 in seq[k + 1:] if kind2 == "rule"), None)
            if nxt is not None:
                waits.append(round((nxt - t) / 60))
    n_ask = sum(1 for x, _ in seq if x == "ask")
    return n_ask, sum(1 for x, _ in seq if x == "rule"), waits, notes


def asks(paths, repo=None, written_under=None):
    """(rows, fails): per file its counts and notes; fails holds UNPARSED and FAIL A0/A2 lines."""
    fails, rows = [], []
    young = {c: too_young(c, written_under) for c in ("A1", "A2", "A3")}
    for p in paths:
        text = read(p)
        lines = text.splitlines()
        if not text.strip():
            fails.append(f"FAIL A0 {p}: empty input (0 lines); a ticket given to --asks may not "
                         "be empty")
            continue
        n_ask, n_q, kinds, cur, about = 0, 0, Counter(), False, False
        dated, stops = set(), []  # (kind, date) of the asks; (lineno, line, kind, date) of stops
        for k, line in enumerate(lines):
            if line.startswith("## "):
                cur, about = False, False
                stop = re.match(r"^##\s+(Plan|Built)\b(?!\s+paused)", line)
                if stop:
                    d = re.search(r"\d{4}-\d{2}-\d{2}", line)
                    stops.append((k, line, "plan-ending" if stop.group(1) == "Plan" else
                                  "pr-open", d.group(0) if d else None))
                if re.match(r"^##\s+Ask\b", line):
                    m = re.match(r"^##\s+Ask\s+(\d{4}-\d{2}-\d{2})\s+·\s+([\w-]+)\s*$", line)
                    if not m or m.group(2) not in ASK_KINDS:
                        fails.append(f"UNPARSED: {p}:{k + 1}: {line.strip()}")
                        continue
                    n_ask, cur = n_ask + 1, True
                    kinds[m.group(2)] += 1
                    dated.add((m.group(2), m.group(1)))
                continue
            if not cur:
                continue
            if WHAT_ABOUT.match(line):
                about = True
            elif re.match(r"^\s*(?:[-*]\s+)?\*\*", line) and \
                    not re.fullmatch(r"\s*\*{3,}\s*", line):  # `***` is a thematic break
                m = re.match(r"^\s*(?:[-*]\s+)?\*\*([^*]+)\*\*", line)
                i = slot_id(m.group(1)) if m and m.group(1) == m.group(1).strip() else None
                if not i or i != m.group(1).strip("`"):
                    if not young["A1"]:
                        fails.append(f"UNPARSED: {p}:{k + 1}: {line.strip()}")
                    continue
                n_q += 1
                if not about and not young["A2"]:
                    fails.append(f"FAIL A2 {p}:{k + 1}: question {i} has no `> **What this is "
                                 "about:**` blockquote above it in its ask")
        for k, line, kind, d in stops if not young["A3"] else []:
            if (d and (kind, d) not in dated) or (not d and not kinds[kind]):
                fails.append(f"UNPARSED: {p}:{k + 1}: {line.strip()} — no `## Ask "
                             f"{d or '<date>'} · {kind}` (A3)")
        by_kind = " ".join(f"{x}={kinds[x]}" for x in ASK_KINDS if kinds[x])
        row = f"{p}: asks={n_ask} questions={n_q} by kind: {by_kind or '-'}"
        notes = [f"{p}: {y}" for y in dict.fromkeys(young.values()) if y]
        if repo:
            n_a, n_r, waits, more = ask_waits(repo, ticket_id(p, text))
            row += (f" · commits ask={n_a} rule={n_r} wait minutes: "
                    f"{' '.join(map(str, waits)) or '-'}")
            notes += more
        rows += [row] + notes
    return rows, fails


def pop_opts(args, flags):
    """{flag: value} taken out of args (in place)."""
    opts = {}
    for flag in flags:
        if flag in args:
            k = args.index(flag)
            if k + 1 >= len(args):
                raise Unusable(f"{flag} needs a value")
            opts[flag] = args[k + 1]
            del args[k:k + 2]
    if "--written-under" in opts:
        opts["--written-under"] = version(opts["--written-under"])
        if not opts["--written-under"]:
            raise Unusable("--written-under needs a version (`0.8`, `v0.9.0`)")
    return opts


def main(argv):
    args = list(argv)
    try:
        if args == ["--skeleton"]:
            print(SKELETON, end="")
            return 0
        if args[:1] == ["--asks"]:
            args = args[1:]
            opts = pop_opts(args, ("--repo", "--written-under"))
            if not args:
                raise Unusable("--asks needs a ticket file")
            rows, fails = asks(args, opts.get("--repo"), opts.get("--written-under"))
            for r in rows + fails:
                print(r)
            print("PASS" if not fails else f"FAIL ({len(fails)})")
            return 1 if fails else 0
        opts = {"--head": "HEAD"}
        opts.update(pop_opts(args, ("--repo", "--tests-commit", "--head", "--base",
                                    "--written-under")))
        if len(args) != 2 or any(a.startswith("-") for a in args):
            print(__doc__.split("\n\n")[1], file=sys.stderr)
            return 2
        if "--tests-commit" in opts and "--repo" not in opts:
            raise Unusable("--tests-commit needs --repo")
        plan, body = read(args[0]), read(args[1])
        brief = re.search(r"^## 9\.", plan, re.M)
        dec = Path(args[0]).parent / "decisions.md"
        decisions = read(dec) if brief and dec.is_file() else None
        ticket = None if brief else ticket_id(args[0], plan)
        notes = []
        fails = check(plan, body, opts.get("--repo"), opts.get("--tests-commit"), opts["--head"],
                      decisions, notes, opts.get("--base"), ticket, opts.get("--written-under"))
    except Unusable as e:
        print(f"UNUSABLE: {e}")
        return 2
    for f in notes + fails:
        print(f)
    print("PASS" if not fails else f"FAIL ({len(fails)})")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
