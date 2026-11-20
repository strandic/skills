#!/usr/bin/env python3
"""check_pr.py — the PR body's skeleton and its mechanical checks (run step 6).

    check_pr.py --skeleton
    check_pr.py --counts <body.md>
    check_pr.py <plan.md | ticket.md> <body.md> [--repo DIR] [--tests-commit SHA] [--head REF]
                [--base REF] [--merged SHA] [--written-under X.Y]

Checking prints one line per failure, `FAIL <check-id> <where>: <what>`, then `PASS` or
`FAIL (<n>)`; exit 0 on PASS, 1 on FAIL, 2 on unusable input, 3 when the checker itself crashes
(a `CRASH` line and no verdict: a bug in this script, never a reading of the record). Stdlib
only; git is read-only.
HTML comments in the body (the skeleton's) are not read.

--counts prints a body's Decisions and Findings rows per label (`Decisions: RULING=1 DEFAULT=2`,
`Findings: APPLY=0 DECLINE=1 TICKET=1 RULING=0`, `other=<n>` for a label outside the set), or
`<section>: no table` when the section is absent or holds no table, never 0. Exit 0.

Empty inputs: a tests commit touching no Python test file reads `P6 NOT RUN`, never a silent
pass; a check that needs a commit it cannot find (P11, P13, P14, P16) reads `<id> NOT RUN (why)`.
A brief or ticket with no plan ending is unusable (exit 2).

Format versions: a record is read under the format it was written in. A brief's header names it
(`skill … 0.8.0`); a ticket names none, so a replay passes `--written-under 0.8`. Checks younger
than the record's format print `<id> not applicable (pre-v<X.Y> format)`: P4 on a ticket, P7 and
M1 since v0.9; P10 since v0.10; P11–P16 and M1's reco, reverses and body-row readings since
v0.11. The id grammar's readings below hold for every format (they only remove refusals). With
no version named the record is read as current.

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
     A command that does not parse, or that holds an unsafe option, fails P5 and is not re-run.
  P6 with --repo and --tests-commit: every `def test_…` in the test files the tests commit
     touched that no test file holds at --head is named in the brief's §9 (Python test naming only:
     another language's repo reads P6 as NOT RUN).
  P7 Verification: each reading that says "base" names a commit SHA (7–40 hex, a digit among
     them) in its row. A table row says it in its reading or result cell (the command cell names
     what ran); a line outside a table, anywhere in it; a fenced block is not read.
  P8 ids are unique: no §5 rule id (`**R1**`) is also a §9 id, and no §9 id has two rows.
  M1 with a decisions.md beside the brief: each line opening with a date reads
     `<date> | <id> RULING|DEFAULT | <decision> | <why>`, one id per line, each id once (other
     lines — a heading, a format note — are not entries); a RULING line's decision cell opens with the letter
     chosen (`-` for none) and carries `reco <letter>` (`-` for none) and, when it undoes an earlier ruling, `reverses <id>`, anywhere in
     its decision or why cell; a `reverses <id>` names an id an earlier line of the file records
     (`reverses` followed by a word that is no id is prose, not the field).
     Every §9 id and `unruled:` id is a line there, of the same kind (§9: `default` in "whose
     ruling" is DEFAULT, `pending` or `ruled in <id>` is a stop row and not mirrored, anything
     else RULING; `unruled:` is DEFAULT); a line's id outside both is an id the header's
     `authority:` clause names (a plan-time ruling, written before §9 existed). Each run-time
     line (a §9 or `unruled:` id; the authority clause's ids are exempt) has a row in the body's
     Decisions table with the same label (a row's range `D1–D18` is read id by id). A RULING
     line whose answer — its quoted words, or the whole why cell when nothing is quoted — is
     only the run invocation (`/shawarma run t-0001`) fails: the go never answers a RULING.
  P9 with --repo: every commit in --base..--head (default base: the merge base with `main`,
     `master` or `origin/HEAD`) touching a path outside `docs/`, `.beans/` and `*.md` has a
     `plan(<ticket>)` commit among its ancestors (the plan ending precedes the code).
  P10 a "Known limit" line of the body (or, for a heading, its section) names a ticket: a
     backticked `<x>-<y>`, `#<n>`, a word `<x>-<y>` whose tail holds a digit, or a word with the
     plan's ticket prefix.
  P11 a §9 row whose "whose ruling" cell reads `default` may not change a §5 rule: its was → now
     cell fails when it quotes a backticked span of a §5 rule (its command, an expected value),
     or names a §5 rule id with one of the words command, expected, threshold, dataset, slice,
     settle. A row naming the rule for its reading or who runs it passes; the section cell is
     not read. With --repo: each file a §5 rule's backticked command names (a path, or the
     module after `-m` as `<module>.py`) that exists at the freeze commit (the commit the body's
     first line names), that §3's table does not name (the contract's own change), and that
     differs at --head needs a §9 RULING row naming that rule id; a test file whose diff only
     adds lines raises ran above the suite rule's N, not a change.
  P12 each §5 rule id is named in the reading cell of a Verification table row; a row whose
     result cell is not exactly `PASS`, nor the rule's own PASS token (the backticked value after
     its "PASS", "dry run" or "dry-run reading"), nor a reading that meets every comparison the
     rule states before its dry-run reading (`failed: 0` and `ran ≥ 40` read by
     `failed: 0, ran 44`, a field per comparison) needs a §9 RULING row naming the id and
     quoting that result. (In
     P11 and P12 a RULING row names the id in a cell other than "whose ruling", which names
     where the ruling came from.)
  P13 each TICKET Findings row's finding cell opens with `file:line` (`file:-` when no single
     line), after an optional (plan) or (review) tag, and the row names a ticket (P10's forms)
     other than the plan's own. With --repo, a row whose line is inside a hunk of
     <base>...<head> (P9's base), or whose file §3 names, also names a Decisions RULING or
     DEFAULT id.
  P14 Verification names the head its readings were taken on (`head <sha>`); with --repo each
     such SHA is --head's commit (else a stale reading).
  P15 a Verification table row whose reading names a suite, tests or lint, and whose result
     reads more failures (`<n> failed|failures|errors|findings`) in its `head` clause than in
     its `base` clauses, or names a test (`test_x`, `x_test`) failing only in a head clause,
     needs a Findings row naming that test, or for a count a Findings row whose finding cell
     says lint (a lint row) or suite or test (a suite row) and a failure word (fail…, error,
     finding, warning) or the head's count. Clauses split at `;`, `·`, `,` and ` and ` outside
     parentheses and backticks; a clause with no `base` or `head` word reads the side before it.
  P16 with --repo: a commit touching decisions.md or the brief's §9 whose committer date is after
     the PR's merge commit fails. The merge commit is --merged, else the first merge commit
     after --head on --base when --head is merged into it (--head itself on a fast-forward);
     with neither known P16 reads NOT RUN.

Trivial mode: when the first file has no `## 9.` section it is read as the ticket. Its plan
ending is the latest `## Plan` note (house rules: the ticket's `## Plan (<date>)` heading, which
may carry a suffix: `## Plan (<date>, trivial)`, `## Plan (<date>): trivial`); P4 reads a
DEFAULT row's id from that note's `unruled:` lines, a RULING row's from those lines, an id the
note writes as a line's first word (a list marker aside) or an id the ticket writes in bold (its
rulings); an id only in running text stays unknown. The ticket id is the first word of a first
line `# <id> <title>` (a committed note), else a `# <id>` line, else the file name up to `--`.
P6, P8, P11, P12, P16 and M1 need §9 and print `<id> not applicable (trivial)`.

Id grammar (P4, P8, M1 and `unruled:` read exactly this; L a capital, l a lowercase letter, D
digits):
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
              In the header's `authority:` clause only, `X1 to Xn` with the same one or two
              letters is a range too (`Q1 to Q5`, `DF1 to DF6`); elsewhere `to` is a word.
"""
import re
import shlex
import subprocess
import sys
import traceback
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
# `X1 to Xn` (same letters, same markup on each end): a range in the authority clause only
TO_RANGE = re.compile(r"(?<![\w-])(?P<mk>\*\*|`|)(?P<let>[A-Z]{1,2})(?P<a>\d+)(?P=mk)\s+to\s+"
                      r"(?P=mk)(?P=let)(?P<z>\d+)(?P=mk)(?![\w-])")
CURRENT = (0, 11)  # the format this checker writes; a record names its own (docstring)
SINCE = {"P4t": (0, 9), "P7": (0, 9), "M1": (0, 9), "P10": (0, 10), "M1r": (0, 11),
         "P11": (0, 11), "P12": (0, 11), "P13": (0, 11), "P14": (0, 11), "P15": (0, 11),
         "P16": (0, 11)}  # P4t: P4 on a ticket; M1r: M1's reco, reverses and body rows
SHOWN = {"P4t": "P4", "M1r": "M1 (reco, reverses, the body's rows)"}
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
        return (f"{SHOWN.get(check_id, check_id)} not applicable "
                f"(pre-v{since[0]}.{since[1]} format)")
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
head. A reading that says "base" names the base commit's SHA in its row (P7); the head they
were taken on is named, `head <sha>` (P14). Each §5 rule has its row, reading PASS or quoted by
a §9 RULING (P12); a new failure at the head has a Findings row (P15). -->

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
exactly one reason. A TICKET row opens with `file:line` (`file:-` when no single line) and names
a ticket other than the plan's (P13). Drop the section, key included, when there is no row. -->

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
    """What a plan ending records: the ids P4, P8 and M1 read, and the §3 / §5 / §9 text the
    v0.11 checks read."""

    def __init__(self):
        self.trivial = False
        self.s9_ids, self.whose_ids, self.plan_ids, self.unruled = set(), set(), set(), set()
        self.bold_ids = set()  # trivial: ids the ticket writes in bold or leading a note line
        self.s9_text, self.s9_rows, self.s5_ids, self.authority = "", [], set(), set()
        self.s9_cells = []  # [(lineno, cells, kind)] of §9's table
        self.s5_rules = {}  # {rule id: the rule's text, its indented lines included}
        self.s3_files = set()  # the files §3's table names
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


def authority_ids(clause):
    """The ids of the header's `authority:` clause: running text, plus `X1 to Xn` ranges."""
    def dash(m):
        mk, let = m.group("mk"), m.group("let")
        return f"{mk}{let}{m.group('a')}{mk}–{mk}{let}{m.group('z')}{mk}"
    return ids_in(TO_RANGE.sub(dash, clause))


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
            r.s9_cells.append((k, c, kind))
            if len(c) > 2:
                r.whose_ids |= ids_in(c[2])
        last_row = max([k for k, _ in rows], default=nine[0])
        ending = "\n".join(lines[last_row + 1:])  # after §9's table: the plan ending
    five = [k for k, x in enumerate(lines) if re.match(r"^## 5\.", x)]
    if five:
        a, z = section_of(lines, five[0])
        cur = None
        for line in lines[a + 1:z]:
            m = re.match(r"^\s*[-*]\s+\*\*([^*\s]+)", line)
            if m and slot_id(m.group(1)):
                cur = slot_id(m.group(1))
                r.s5_ids.add(cur)
                r.s5_rules[cur] = line
            elif cur and line[:1] in (" ", "\t") and line.strip():
                r.s5_rules[cur] += "\n" + line  # a sub-item or a wrapped line of the rule
            elif line.strip():
                cur = None
    three = [k for k, x in enumerate(lines) if re.match(r"^## 3\.", x)]
    if three:
        a, z = section_of(lines, three[0])
        _head, rows = table(list(enumerate(lines[a + 1:z], a + 1)))
        for _k, c in rows:
            got = re.findall(r"`([^`\s]+)`", c[0]) or ([c[0]] if c[0] and " " not in c[0] else [])
            r.s3_files |= set(got)
    header = "\n".join(lines[1:first])
    r.version = header_version(header)
    m = re.search(r"\bTicket\s+`([^`]+)`", header)
    r.ticket = m.group(1) if m else None
    m = re.search(r"authority:(.*?)(?:·\s*planned|$)", header, re.S)
    r.authority = authority_ids(m.group(1)) if m else set()
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
    for line in lines[a + 1:z]:  # an id the note writes as a line's first word
        words = re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", line).split()
        tok = words[0].strip("*`").rstrip(":,;.").strip("*`") if words else ""
        if ID_RE.fullmatch(tok):
            r.bold_ids.add(tok)
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
    why = re.sub(r"(?<![\w-])(?:reco|reverses)\s+\S+", "", why).strip(" ·;,")  # M1's fields
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
    # No stdin: a pasted `git log --stdin` must not wait on ours. A git that cannot start raises
    # OSError, which main() reads as unusable input: it is no reading of the record.
    r = subprocess.run(["git", "-C", str(repo), "--no-pager", *args], capture_output=True,
                       text=True, stdin=subprocess.DEVNULL)
    if r.returncode:
        raise Unusable(f"git {' '.join(args)}: {r.stderr.strip()[:200]}")
    return r.stdout


def git_try(repo, *args):
    """git's output, or None when it exits non-zero (a ref or a path that is not there)."""
    r = subprocess.run(["git", "-C", str(repo), "--no-pager", *args], capture_output=True,
                       text=True, stdin=subprocess.DEVNULL)
    return None if r.returncode else r.stdout


def commit_of(repo, ref):
    """The full SHA of ref's commit, or None."""
    out = git_try(repo, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}") if ref else None
    return out.strip() if out else None


def default_base(repo, head):
    """P9's default base: the merge base of head with `main`, `master` or `origin/HEAD`."""
    for ref in ("main", "master", "origin/HEAD"):
        r = subprocess.run(["git", "-C", str(repo), "merge-base", head, ref],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout.strip()
    return None


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
        base = default_base(repo, head)
        if base is None:
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


def ticket_pats(tid):
    """P10's forms of a ticket name: a backticked `<x>-<y>`, `#<n>`, a word `<x>-<y>` whose
    tail holds a digit, a word with the plan's ticket prefix."""
    pats = [r"`[A-Za-z][\w.]*-\w+`", r"(?<![\w&])#\d+\b", TICKET_WORD]
    if tid and "-" in tid:
        pats.append(r"(?<![\w-])" + re.escape(tid.rsplit("-", 1)[0]) + r"-\w+")
    return pats


def known_limit_fails(blines, tid):
    """P10: a "Known limit" line (a heading: its section) naming no ticket."""
    pats = ticket_pats(tid)
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


# ---- the v0.11 readings ----------------------------------------------------------------------

FIELD_WORDS = re.compile(r"\b(?:command|expected|threshold|dataset|slice|settle)\b", re.I)
HEAD_SHA = re.compile(r"(?<![\w-])head\b\W{1,4}((?=[0-9a-f]*\d)[0-9a-f]{7,40})(?![\w-])", re.I)
FIRST_SHA = re.compile(r"(?<![\w-])((?=[0-9a-f]*\d)[0-9a-f]{7,40})(?![\w-])")
FILE_LINE = re.compile(r"^\s*(?:\((?:plan|review)\)\s*)?`?(?P<file>[\w./-]+):(?P<line>\d+|-)`?"
                       r"(?![\w-])")
FAILS_RE = re.compile(r"(\d+)\s+(?:failed|failures?|errors?|findings?)\b", re.I)
TEST_NAME = re.compile(r"(?<![\w-])(test_\w+|\w+_test)(?![\w-])")
TEST_FILE = re.compile(r"(?:^|/)(?:tests?/|test_[^/]*$|[^/]*_test\.\w+$|[^/]*\.test\.\w+$)")


def spans(text):
    """The backticked spans of a text."""
    return set(re.findall(r"`([^`]+)`", text))


def names_id(cells, i):
    """Whether row cells name id i (running text, ranges, or a bare id slot)."""
    text = " ".join(cells)
    return i in ids_in(text) or i in {slot_id(w) for w in re.split(r"[\s|,;()]+", text) if w}


def pass_tokens(rule):
    """A §5 rule's own PASS tokens: the backticked value after its "PASS" or "dry run" (or
    "dry-run reading", the field's name)."""
    return set(re.findall(r"\b(?:PASS|dry[- ]run)\b[^`\n]*?`([^`]+)`", rule, re.I))


# A rule's own comparisons: `<field> ≥ <n>` (a floor) or `<field>: <value>` / `<field>=<value>`,
# read in the rule's text before its dry-run, FAIL and cannot-run readings (observed values).
COMPARISON = re.compile(r"`([A-Za-z][\w.-]*)\s*(≥|>=|==|=|:)\s*([\w.-]+)`")
OBSERVED = re.compile(r"(?i:dry[- ]run|cannot[- ]run|can't run|not run|\bdataset\b|\bsettle\b)"
                      r"|\bFAIL\b")


def meets_rule(rule, got):
    """Whether a result meets every comparison the rule states (a ran above its floor), or None
    when the rule states none."""
    m = OBSERVED.search(rule)
    comps = COMPARISON.findall(rule[:m.start()] if m else rule)
    if not comps:
        return None
    for field, op, want in comps:
        seen = re.search(rf"(?<![\w-]){re.escape(field)}\s*(?:==|=|:)?\s*([\w.-]+)", got, re.I)
        if not seen:
            return False
        have = seen.group(1)
        if op in ("≥", ">="):
            if not (have.isdigit() and want.isdigit() and int(have) >= int(want)):
                return False
        elif have.lower() != want.lower():
            return False
    return True


def gate_files(rule):
    """The paths a §5 rule's backticked commands name, and `<module>.py` after `-m`."""
    out = set()
    for span in spans(rule):
        try:
            toks = shlex.split(span)
        except ValueError:
            continue
        for k, t in enumerate(toks):
            if k and toks[k - 1] == "-m" and re.fullmatch(r"[\w.]+", t):
                out.add(t.replace(".", "/") + ".py")
            elif "/" in t or re.search(r"\.[A-Za-z]\w*$", t):
                out.add(t)
    return out


def table_rows(ls):
    """[(lineno, cells)] of every table row in lines, fenced blocks, headers and rules skipped."""
    rows, fenced = [], False
    for k, line in ls:
        if line.strip().startswith("```"):
            fenced = not fenced
            continue
        if fenced or not line.lstrip().startswith("|") or \
                re.fullmatch(r"\s*\|?[\s:|-]+\|?\s*", line):
            continue
        c = split_row(line)
        if [norm(x.lower()) for x in c][:1] in (["reading"], ["finding"], ["decision"]):
            continue
        rows.append((k, c))
    return rows


def ruled(rec, i, quoting=None):
    """Whether a §9 RULING row names id i (and, when given, quotes that text) outside its "whose
    ruling" cell, which names where the ruling came from."""
    plain = norm((quoting or "").replace("`", ""))
    own = [[c[0]] + c[3:] for _k, c, kind in rec.s9_cells if kind == "RULING"]
    return any(names_id(c, i) and
               (quoting is None or (plain and plain in norm(" ".join(c).replace("`", ""))))
               for c in own)


def default_gate_fails(rec):
    """P11 on §9's default rows: none may change a §5 rule."""
    fails = []
    rule_spans = {i: spans(t) for i, t in rec.s5_rules.items()}
    for k, c, kind in rec.s9_cells:
        if kind != "DEFAULT" or len(c) < 5:
            continue
        cell = c[4]
        hit = {i for i, sp in rule_spans.items() if spans(cell) & sp}
        if FIELD_WORDS.search(cell):
            hit |= {i for i in rec.s5_ids if names_id([cell], i)}
        if hit:
            fails.append(f"FAIL P11 brief line {k + 1}: default row {c[0]!r} changes §5 "
                         f"{', '.join(sorted(hit))} ({norm(cell)[:60]!r}); a gate change is a "
                         "RULING")
    return fails


def in_s3(rec, f):
    """Whether §3's table names file f (the contract's own change)."""
    return any(f == x or f.endswith("/" + x) or x.endswith("/" + f) for x in rec.s3_files)


def gate_change_fails(repo, rec, head, freeze):
    """P11 with --repo: (fails, notes) for the files §5 rules run, freeze commit to head."""
    at, now = commit_of(repo, freeze), commit_of(repo, head)
    if not at or not now:
        return [], [f"P11 NOT RUN on files (no commit {freeze if not at else head!r} in --repo: "
                    "the body's first line names the freeze commit)"]
    fails = []
    for rid, text in sorted(rec.s5_rules.items()):
        files = sorted(f for f in gate_files(text) if not in_s3(rec, f)
                       and git_try(repo, "cat-file", "-e", f"{at}:{f}") is not None)
        if not files:
            continue
        stat = git_try(repo, "diff", "--numstat", "--no-ext-diff", "--no-textconv", at, now, "--",
                       *files) or ""
        for line in stat.splitlines():
            _add, dele, path = (line.split("\t", 2) + ["", ""])[:3]
            if TEST_FILE.search(path) and dele == "0":
                continue  # tests added: the suite's floor rising is no change
            if not ruled(rec, rid):
                fails.append(f"FAIL P11 {path}: changed since the freeze {at[:8]} and §5 {rid} "
                             f"runs it; no §9 RULING row names {rid}")
    return fails, []


def gate_reading_fails(rec, vrows):
    """P12: each §5 rule's Verification row reads PASS, or a §9 RULING quotes its reading."""
    fails = []
    for rid in sorted(rec.s5_ids):
        mine = [(k, c) for k, c in vrows if names_id([c[0]], rid)]
        if not mine:
            fails.append(f"FAIL P12 Verification: §5 {rid} has no row (a reading cell naming "
                         f"{rid})")
        rule = rec.s5_rules.get(rid, "")
        toks = pass_tokens(rule)
        for k, c in mine:
            got = c[-1].replace("*", "").strip().strip("`").strip()
            if got == "PASS" or got in toks or meets_rule(rule, got) or ruled(rec, rid, got):
                continue
            fails.append(f"FAIL P12 line {k + 1}: §5 {rid} reads {got[:40]!r}, not PASS, and no "
                         f"§9 RULING row names {rid} quoting it")
    return fails


def head_fails(vlines, repo, head, notes):
    """P14: Verification names the head its readings were taken on; with --repo, it is head."""
    shas, fenced = [], False
    for k, line in vlines:
        if line.strip().startswith("```"):
            fenced = not fenced
        elif not fenced:
            shas += [(k, m.group(1)) for m in HEAD_SHA.finditer(line)]
    if not shas:
        return ["FAIL P14 Verification: names no head SHA its readings were taken on "
                "(`head <sha>`)"]
    if not repo:
        return []
    full = commit_of(repo, head)
    if not full:
        notes.append(f"P14 NOT RUN (--head {head!r} is no commit of --repo)")
        return []
    return [f"FAIL P14 line {k + 1}: a stale reading: Verification read head {sha}, --head is "
            f"{full[:12]}" for k, sha in shas if not full.startswith(sha.lower())]


def new_failure_fails(vrows, frows):
    """P15: a suite or lint row failing more at the head than at the base needs a Findings row."""
    fails, ftext = [], [" ".join(c) for _k, c, _lab in frows]
    fcells = [c[0] for _k, c, _lab in frows]
    for k, c in vrows:
        kind = re.search(r"\b(lint|suite|tests?)\b", c[0], re.I)
        if not kind:
            continue
        counts, tests, seen = {"base": 0, "head": 0}, {"base": set(), "head": set()}, set()
        failing, side = set(), None
        for seg in clauses(c[-1]):
            m = re.search(r"\b(base|head)\b", seg, re.I)
            if m:
                side = m.group(1).lower()
            if side is None:
                continue  # a clause before any side word reads neither
            n = [int(x) for x in FAILS_RE.findall(seg)]
            if n:
                counts[side] += sum(n)
                seen.add(side)
            if n or re.search(r"\bfail", seg, re.I):
                failing.add(side)
            if side in failing:
                tests[side] |= set(TEST_NAME.findall(seg))
        new = sorted(tests["head"] - tests["base"])
        for t in new:
            if not any(t in x for x in ftext):
                fails.append(f"FAIL P15 line {k + 1}: {t} fails at the head only and no Findings "
                             "row names it")
        if seen == {"base", "head"} and counts["head"] > counts["base"] and not new:
            word = r"\blint\b" if kind.group(1).lower() == "lint" else r"\b(?:suite|tests?)\b"
            failure = rf"\b(?:fail\w*|errors?|findings?|warnings?|{counts['head']})\b"
            if not any(re.search(word, x, re.I) and re.search(failure, x, re.I)
                       for x in fcells):
                fails.append(f"FAIL P15 line {k + 1}: {counts['head']} failure(s) at the head, "
                             f"{counts['base']} at the base, and no Findings row for them")
    return fails


def clauses(text):
    """A result cell's clauses: split at `;`, `·`, `,` and ` and `, outside parentheses and
    backticks (a list of failing tests stays in its clause)."""
    out, cur, depth, code = [], "", 0, False
    k = 0
    while k < len(text):
        ch = text[k]
        if ch == "`":
            code = not code
        elif not code and ch in "([":
            depth += 1
        elif not code and ch in ")]":
            depth = max(depth - 1, 0)
        if not code and depth == 0 and (ch in ";·," or text.startswith(" and ", k)):
            out.append(cur)
            cur = ""
            k += 5 if ch == " " else 1
            continue
        cur += ch
        k += 1
    return out + [cur]


def added_hunks(diff):
    """{path: [(first, end)]} of the new-side line ranges of a `git diff -U0`."""
    out, f = {}, None
    for line in diff.splitlines():
        if line.startswith("+++ "):
            f = line[6:] if line.startswith("+++ b/") else None
        elif f and (m := re.match(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", line)):
            a, n = int(m.group(1)), int(m.group(2) or 1)
            out.setdefault(f, []).append((a, a + max(n, 1)))
    return out


def ticket_row_fails(frows, tid, rec, decision_ids, repo, head, base, notes):
    """P13 on the TICKET Findings rows."""
    fails, hunks = [], None
    own = {x.lower() for x in ticket_names(tid)} if tid else set()
    tickets = [(k, c) for k, c, lab in frows if lab == "TICKET"]
    if repo and tickets:
        b = base or default_base(repo, head)
        out = git_try(repo, "diff", "-U0", "--no-ext-diff", "--no-textconv",
                      f"{b}...{head}") if b else None
        if out is None:
            notes.append("P13 NOT RUN on the PR's hunks (no base: pass --base)")
        else:
            hunks = added_hunks(out)
    for k, c in tickets:
        m = FILE_LINE.match(c[0])
        if not m:
            fails.append(f"FAIL P13 line {k + 1}: a TICKET finding opens with no `file:line` "
                         f"(`file:-` when no single line): {norm(c[0])[:50]!r}")
        rest = " ".join([c[0][m.end():] if m else c[0]] + c[1:])
        found = {x.group(0).strip("`").lower() for p in ticket_pats(tid)
                 for x in re.finditer(p, rest)}
        if not found:
            fails.append(f"FAIL P13 line {k + 1}: a TICKET row names no ticket")
        elif not found - own:
            fails.append(f"FAIL P13 line {k + 1}: a TICKET row names only the plan's own ticket "
                         f"{tid}")
        if repo and m:
            f, ln = m.group("file"), m.group("line")
            in_hunk = hunks is not None and ln != "-" and any(
                a <= int(ln) < z for a, z in hunks.get(f, []))
            s3 = in_s3(rec, f)
            if (in_hunk or s3) and not ids_in(" ".join(c)) & decision_ids:
                where = "a line the PR changes" if in_hunk else "a file §3 names"
                fails.append(f"FAIL P13 line {k + 1}: a TICKET on {where} ({f}:{ln}) names no "
                             "Decisions RULING or DEFAULT id")
    return fails


def post_merge_fails(repo, head, base, merged, plan_path):
    """P16: (fails, notes) for commits touching decisions.md or §9 after the merge commit."""
    top = git_try(repo, "rev-parse", "--show-toplevel")
    try:
        rel = Path(plan_path).resolve().relative_to(Path(top.strip()).resolve())
    except (AttributeError, TypeError, ValueError):
        return [], ["P16 NOT RUN (the brief is not inside --repo)"]
    if merged:
        at = commit_of(repo, merged)
        if not at:
            return [], [f"P16 NOT RUN (--merged {merged!r} is no commit of --repo)"]
    elif base and commit_of(repo, head) and subprocess.run(
            ["git", "-C", str(repo), "merge-base", "--is-ancestor", head, base],
            capture_output=True).returncode == 0:
        out = (git_try(repo, "rev-list", "--ancestry-path", "--merges", "--reverse",
                       f"{head}..{base}") or "").split()
        at = out[0] if out else commit_of(repo, head)
    else:
        return [], ["P16 NOT RUN (no merge commit known: pass --merged <sha>, or --base when "
                    "--head is merged into it)"]
    when = int(git(repo, "log", "-1", "--format=%ct", at).strip())
    brief, dec = rel.as_posix(), (rel.parent / "decisions.md").as_posix()
    fails = []
    for line in git(repo, "log", "--all", "--format=%H %ct", "--", brief, dec).splitlines():
        sha, ct = line.split()
        if int(ct) <= when:
            continue
        paths = (git_try(repo, "diff", "--name-only", f"{sha}^", sha) or "").split()
        if dec in paths:
            fails.append(f"FAIL P16 {sha[:8]}: touches {dec} after the merge {at[:8]}")
        elif brief in paths:
            old, new = (git_try(repo, "show", f"{x}:{brief}") for x in (f"{sha}^", sha))
            if brief_records(old or "").s9_text != brief_records(new or "").s9_text:
                fails.append(f"FAIL P16 {sha[:8]}: changes the brief's §9 after the merge "
                             f"{at[:8]}")
    return fails, []


# ---- the checks -----------------------------------------------------------------------------

def check(plan_text, body, repo=None, tests_commit=None, head="HEAD", decisions=None,
          notes=None, base=None, ticket=None, written_under=None, merged=None, plan_path=None):
    """FAIL lines for a body against its plan ending (a brief, or a ticket: trivial mode).
    decisions: a decisions.md's text beside the brief (M1); notes: a list that receives the
    `not applicable (…)` and `NOT RUN` lines; base: P9's base ref; ticket: the ticket id (a
    brief's header names it otherwise); written_under: the record's format, (major, minor);
    merged: the PR's merge commit (P16); plan_path: the brief's file, for P16 with repo."""
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
    brief_only = ("M1", "M1r", "P11", "P12") + (("P16",) if repo else ())
    notes += [young[c] for c in ("P4t", "P7", "M1", "P10", "M1r", "P11", "P12", "P13", "P14",
                                 "P15", "P16") if young[c] and (c != "P4t" or rec.trivial)
              and (c not in brief_only or not rec.trivial) and (c != "P16" or repo)]
    drows, frows = [], []  # [(lineno, named ids, label)], [(lineno, cells, label)]

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
            if name == "Findings":
                frows.append((k, c, lab))
            else:
                drows.append((k, ids_in(c[0]) | ids_in(c[2]) | ({lead_id(c[0])} - {None}), lab))
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
            out, bad = None, []
            try:
                args = shlex.split(cmd)[2:]
            except ValueError as e:  # an unbalanced quote: the pasted text is no command
                args = None
                fail("P5", f"line {k_cmd + 1}", f"the pasted command does not parse ({e}); "
                     "not re-run")
            if args is not None:
                bad = [a for a in args if UNSAFE.search(a)]
                if bad:
                    fail("P5", f"line {k_cmd + 1}", f"refused to re-run, unsafe options {bad}")
                elif any("\0" in a for a in args):
                    fail("P5", f"line {k_cmd + 1}", "the pasted command holds a NUL byte; "
                         "not re-run")
                else:
                    args = [re.sub(r"\bHEAD\b", lambda _m: head, a) for a in args]
                    try:
                        out = git(repo, "log", "--no-ext-diff", "--no-textconv",
                                  *args).splitlines()
                    except Unusable as e:  # the pasted command itself does not run
                        fail("P5", f"line {k_cmd + 1}", f"re-run failed: {e}")
            if out is not None:
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

    # P13, P14, P15
    vlines = by.get("Verification", (0, []))[1]
    vrows = table_rows(vlines)
    decision_ids = {i for _k, named, lab in drows if lab in ("RULING", "DEFAULT") for i in named}
    if not young["P13"]:
        fails += ticket_row_fails(frows, ticket, rec, decision_ids, repo, head, base, notes)
    if not young["P14"]:
        fails += head_fails(vlines, repo, head, notes)
    if not young["P15"]:
        fails += new_failure_fails(vrows, frows)

    if rec.trivial:
        notes += [f"{c} not applicable (trivial)" for c in ("P6", "P8", "M1", "P11", "P12", "P16")]
        return fails

    # P11, P12
    if not young["P11"]:
        fails += default_gate_fails(rec)
        if repo:
            m = FIRST_SHA.search(first)
            if m:
                f11, n11 = gate_change_fails(repo, rec, head, m.group(1))
                fails += f11
                notes += n11
            else:
                notes.append("P11 NOT RUN on files (the body's first line names no commit)")
    if not young["P12"]:
        fails += gate_reading_fails(rec, vrows)

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
        if not young["M1r"]:
            for k, i, kind in good:
                rest = dlines[k].split(" | ", 2)[2]
                if kind == "RULING" and not re.search(r"(?<![\w-])reco\s+(?:[A-Z]|-)(?![\w-])",
                                                      rest):
                    fail("M1", f"decisions.md:{k + 1}", f"{i} RULING carries no `reco <letter>` "
                         "(the option recommended, `-` for none)")
                if kind == "RULING" and not re.match(r"\s*(?:[A-Z]|-)(?![\w-])", rest):
                    fail("M1", f"decisions.md:{k + 1}", f"{i} RULING's decision does not open "
                         "with the letter chosen (`-` for none)")
                for m in re.finditer(r"(?<![\w-])reverses\s+(\S+)", rest):
                    j = slot_id(m.group(1))
                    if j is None:
                        continue  # `reverses the plan's order`: words, not the field
                    if j not in {i2 for k2, i2, _kind in good if k2 < k}:
                        fail("M1", f"decisions.md:{k + 1}", f"{i} reverses {m.group(1)!r}, which "
                             "no earlier line of the file records")
            for i in sorted(set(dkind) & set(want)):  # run-time ids: the body's rows
                labs = {lab for _k, named, lab in drows if i in named}
                if not labs:
                    fail("M1", "body", f"{i} ({dkind[i]} in decisions.md) has no Decisions row")
                elif dkind[i] not in labs:
                    fail("M1", "body", f"{i} is {dkind[i]} in decisions.md, "
                         f"{'/'.join(sorted(labs))} in the Decisions table")

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

    # P16
    if repo and not young["P16"]:
        f16, n16 = post_merge_fails(repo, head, base, merged, plan_path)
        fails += f16
        notes += n16
    return fails


def ticket_id(path, text):
    """The ticket's id: the first word of a first line `# <id> <title>` (a committed note), else
    a `# <id>` line, else the file name up to `--`."""
    m = re.match(r"#\s+([A-Za-z][\w.]*-[A-Za-z0-9]+)[:,.]?\s+\S", text.split("\n", 1)[0])
    if m:
        return m.group(1)
    m = re.search(r"^#\s+(\S+)\s*$", text, re.M)
    return m.group(1) if m else Path(path).name.split("--")[0].removesuffix(".md")


def counts(body):
    """--counts: the Decisions and Findings rows of a body per label, or `no table`."""
    body = strip_comments(body)
    found = {}
    for n, _k, ls in sections(body):
        found.setdefault(canonical(n), ls)
    out = []
    for name, labs in (("Decisions", ("RULING", "DEFAULT")),
                       ("Findings", ("APPLY", "DECLINE", "TICKET", "RULING"))):
        head_cells, rows = table(found.get(name, []))
        if head_cells is None:
            out.append(f"{name}: no table")
            continue
        got = Counter((c[1].replace("*", "").replace("`", "").split() or [""])[0]
                      if len(c) > 1 else "" for _k, c in rows)
        other = sum(v for x, v in got.items() if x not in labs)
        out.append(f"{name}: " + " ".join(f"{x}={got[x]}" for x in labs)
                   + (f" other={other}" if other else ""))
    return out


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
    for stream in (sys.stdout, sys.stderr):  # a console that is not UTF-8 escapes, never fails
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="backslashreplace")
    try:
        return run(argv)
    except OSError as e:  # a tool (git) or a file that cannot be opened: unusable, not a bug
        print(f"UNUSABLE: {type(e).__name__}: {e}")
        return 2
    except Exception as e:  # a bug in this script, never a reading of the record
        traceback.print_exc()
        print(f"CRASH {type(e).__name__}: {e} - check_pr.py itself failed; this is no verdict "
              "on the record (exit 3)".encode("ascii", "backslashreplace").decode())
        return 3


def run(argv):
    args = list(argv)
    try:
        if args == ["--skeleton"]:
            print(SKELETON, end="")
            return 0
        if args[:1] == ["--counts"] and len(args) == 2 and not args[1].startswith("-"):
            for line in counts(read(args[1])):
                print(line)
            return 0
        opts = {"--head": "HEAD"}
        opts.update(pop_opts(args, ("--repo", "--tests-commit", "--head", "--base", "--merged",
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
                      decisions, notes, opts.get("--base"), ticket, opts.get("--written-under"),
                      opts.get("--merged"), args[0])
    except Unusable as e:
        print(f"UNUSABLE: {e}")
        return 2
    for f in notes + fails:
        print(f)
    print("PASS" if not fails else f"FAIL ({len(fails)})")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
