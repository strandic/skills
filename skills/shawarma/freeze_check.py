#!/usr/bin/env python3
"""freeze_check.py — plan step 5's mechanical freeze conditions (the rest stay in plan step 5).

    freeze_check.py <plan.md> [--listing FILE] [--repo DIR]

Prints one line per failure, `FAIL <check-id> <where>: <what>`, then `PASS` or `FAIL (<n>)`.
Exit 0 on PASS, 1 on FAIL, 2 on unusable input (unreadable file, not a brief, lanes.md missing).
Stdlib only. lanes.md is read from this script's own folder. Notes go to stderr.

Checks (each is a reading, never a judgement):
  F1 the nine `## N.` sections exist, in order.
  F2 every §7 attack line (a list item holding `→ oracle` or `enumerate:`, not `mutant:`) has
     its id in §2's **Attack readings** block, or the line itself reads NOT RUN.
  F3 every reading that is NOT RUN (by id, or by its label when it has none) is named in the 3a
     lane cell; a Partition or Sources row reading NOT RUN makes the 3a cell mention that table.
  F4 every §2 Sources row's last column starts with verified / paraphrased / not found / NOT RUN.
  F5 every §2 Partition row's last column is non-empty.
  F6 the 3a / 3b cells hold every fixed fragment of lanes.md's text for that lane (at least one
     cell must exist: run.md runs one review lane, adversarial or code review).
  F7 class words in §3, the lane cells, the comments and docstrings that the patches beside the
     brief add (with --repo: the docstrings and leading comment blocks of §3's Python files,
     located on the reconstructed file): each sentence or table row holding one names a §7 id
     or `enumerate`. In §3 and the lane cells a miss FAILs; in code comments it prints a WARN
     line the planner resolves (cite an id, or leave it as a maintenance note). Text inside `code spans` is not read for class words.
  F8 each §5 rule (a list item opening with a bold id such as **R1** / **G1**) holds a backticked
     command, a dataset, a settle clause, a dry-run reading, a FAIL reading and a cannot-run reading
     (`--fields` prints the full list).
  F9 with --listing: the header paragraph (title to `## 1.`) names each lesson tag at least as
     often as the listing holds lessons with that tag (`tag ×2` counts 2). The listing's lines read
     `<line>: - Lesson (<tag>): …` (a lessons file of `- Lesson (<tag>): …` lines, numbered by grep -n).
"""
import ast
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

# The fields of a §5 rule (brief-template §5 points here; this is their source).
RULE_FIELDS = (
    "rules, written now — for each: the rule · the command line it runs, on a tracked script, and "
    "the output fields it reads · the dataset and slice that binds, read in aggregate or case by "
    "case · its settle clause (when read, how many readings; none = once) · its dry-run reading "
    "with the fix patched in (or `DRY-RUN ON STAND-IN`) · its FAIL reading on the named data "
    "(spike q3) · the executed reading when its command cannot run (a tool or an input missing, or "
    "its guarded step skipped: the rule reads a trace that the step ran), which must differ from "
    "its PASS"
)
CLASS_WORDS = ("any", "every", "all", "always", "never", "none", "nothing", "beyond", "unchanged")
CLASS_RE = re.compile(r"\b(" + "|".join(CLASS_WORDS) + r")\b", re.I)
ONE_ID = r"[A-Z]{1,2}\d+[a-z]?"
ID_RE = re.compile(r"(?<![\w-])([A-Z]{1,2}\d+[a-z]?)(?![\w-])")
SOURCE_STATES = ("verified", "paraphrased", "not found", "not run")
LANES = Path(__file__).resolve().parent / "lanes.md"


class Unusable(Exception):
    pass


def norm(s):
    return " ".join(s.split())


def strip_code(s):
    return re.sub(r"`[^`]*`", " ", s)


def split_row(line):
    """Cells of a markdown table row; `|` inside a balanced code span or escaped is kept."""
    body = line.strip()
    body = body[1:] if body.startswith("|") else body
    body = body[:-1] if body.endswith("|") and not body.endswith("\\|") else body
    cells, cur, code, i = [], "", False, 0
    while i < len(body):
        c = body[i]
        if c == "\\" and i + 1 < len(body) and body[i + 1] == "|":
            cur += "|"
            i += 2
            continue
        if c == "`":
            code = not code
        if c == "|" and not code:
            cells.append(cur)
            cur = ""
        else:
            cur += c
        i += 1
    cells.append(cur)
    if code:  # unbalanced backticks: fall back to the plain split
        cells = re.split(r"(?<!\\)\|", body)
    return [c.strip() for c in cells]


def is_sep(cells):
    return all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c) and any(cells)


class Brief:
    def __init__(self, path):
        try:
            self.text = Path(path).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            raise Unusable(f"cannot read {path}: {e}")
        self.path = Path(path)
        self.lines = self.text.splitlines()
        self.heads = [(i, m.group(1)) for i, l in enumerate(self.lines)
                      if (m := re.match(r"^## (\d+)\.", l))]
        if not self.heads:
            raise Unusable(f"{path}: no `## N.` section — not a brief")
        first = self.heads[0][0]
        self.header = "\n".join(self.lines[1:first])

    def section(self, n):
        """(start index, lines) of `## n.`, up to the next `## ` heading."""
        for i, num in self.heads:
            if num == str(n):
                j = i + 1
                while j < len(self.lines) and not self.lines[j].startswith("## "):
                    j += 1
                return i + 1, self.lines[i + 1:j]
        return None, []

    def block(self, n, label):
        """Lines of the bold-led block `**label…` inside section n, to the next bold-led line."""
        start, lines = self.section(n)
        out, on = [], False
        for k, l in enumerate(lines):
            if re.match(r"^\*\*" + re.escape(label), l):
                on = True
                out.append((start + k, l))
                continue
            if on and re.match(r"^\*\*", l):
                break
            if on:
                out.append((start + k, l))
        return out

    def table_in(self, numbered):
        """Data rows (lineno, cells) of the first table in a list of (lineno, line)."""
        rows, seen = [], False
        for ln, l in numbered:
            if l.lstrip().startswith("|"):
                cells = split_row(l)
                if not seen:
                    seen = True  # header row
                    continue
                if is_sep(cells):
                    continue
                rows.append((ln, cells))
            elif seen and l.strip():
                break
        return rows

    def lane_cells(self):
        start, lines = self.section(7)
        cells = {}
        for k, l in enumerate(lines):
            if l.lstrip().startswith("|"):
                c = split_row(l)
                m = re.match(r"(3[ab])\b", c[0]) if c else None
                if m and len(c) >= 3:
                    cells[m.group(1)] = (start + k, c[2])
        return cells


def items(numbered):
    """List items joined with their continuation lines: (lineno, indent, text)."""
    out = []
    for ln, l in numbered:
        m = re.match(r"^(\s*)[-*] (.*)$", l)
        if m:
            out.append([ln, len(m.group(1)), m.group(2)])
        elif out and out[-1][2] is not None and l.strip() \
                and (len(l) - len(l.lstrip())) > out[-1][1] and not l.lstrip().startswith("|"):
            out[-1][2] += " " + l.strip()
        elif not l.strip():
            continue
        elif out and not l.startswith(" "):
            out.append([ln, -1, None])  # a paragraph ends the list
    return [(a, b, c) for a, b, c in out if c is not None]


def attack_lines(b):
    start, lines = b.section(7)
    numbered = list(enumerate(lines, start))
    out = []
    for ln, ind, t in items(numbered):
        bare = t.replace("`", "")
        if bare.lstrip().startswith("mutant:"):
            continue
        if "→ oracle" in bare or "enumerate:" in bare:
            out.append((ln, t))
    return out


def line_ids(t):
    """The ids an attack line defines: leading ids (lane prefixes like `0a` skipped, `A4 / B1`
    lists kept), else an id right after `enumerate:`, else a parenthesised id."""
    bare = t.replace("`", "").replace("*", "")
    head = bare.split("→")[0]
    toks = re.split(r"\s+", head.strip())
    ids, k = [], 0
    while k < len(toks):
        tok = toks[k].strip(",;:")
        if re.fullmatch(r"\d[a-z]", tok) or tok == "/":
            k += 1
            continue
        if ID_RE.fullmatch(tok):
            ids.append(tok)
            k += 1
            continue
        break
    if ids:
        return ids
    m = re.search(r"enumerate:\s+([A-Z]{1,2}\d+[a-z]?)\b", head)
    if m:
        return [m.group(1)]
    m = re.search(r"\((%s(?:,\s*%s)*)\)" % (ONE_ID, ONE_ID), head)
    return re.split(r",\s*", m.group(1)) if m else []


def readings(b):
    """(lineno, ids, head label, reading text) per item of the Attack readings block."""
    out = []
    for ln, ind, t in items(b.block(2, "Attack readings")):
        bare = t.replace("`", "")
        if "→" in bare:
            head, rest = bare.split("→", 1)
        elif ":" in bare:
            head, rest = bare.split(":", 1)
        else:
            head, rest = bare[:60], bare
        ids = ID_RE.findall(head)
        # an item packing several readings: each sentence `<id> … → <reading>` is keyed too
        ids += re.findall(r"(?:^|[.;]\s+)(%s)\b[^.;→]*→" % ONE_ID, bare)
        out.append((ln, ids, norm(head.replace("*", "")), rest))
    return out


def fragments(lane):
    try:
        text = LANES.read_text(encoding="utf-8")
    except OSError as e:
        raise Unusable(f"lanes.md not found beside the script ({LANES}): {e}")
    for l in text.splitlines():
        if l.lstrip().startswith("|"):
            c = split_row(l)
            if c and c[0].startswith(lane) and len(c) >= 3:
                body = c[2].replace("*(template text)*", "")
                # clauses between placeholders and separators: a cell may add words between
                # clauses, never drop or reorder one
                frs = [norm(f).strip(" ,;:·—") for f in re.split(r"<[^>]+>|·|;|, ", body)]
                return [f for f in frs if f]
    raise Unusable(f"lanes.md has no `{lane}` row")


def sentences(text):
    return [s for s in re.split(r"(?<=[.!?])\s+(?=[A-Z`*(\[])", norm(text)) if s.strip()]


def class_word(unit, code_file=False):
    for m in CLASS_RE.finditer(strip_code(unit)):
        if code_file and m.group(1) == "None":  # Python's None, not the class word
            continue
        return m.group(1)
    return None


def class_unit_fails(unit, ids, code_file=False):
    if not class_word(unit, code_file):
        return False
    if re.search(r"\benumerate\b", unit):
        return False
    return not any(i in ids for i in ID_RE.findall(unit.replace("`", " ")))


# ---- patch reading (F7 a/b) ----------------------------------------------------------------

def parse_patch(text):
    """{path: [hunk]}; a hunk is (old_start, [(tag, text)]) with tag in ' +-'."""
    files, cur, hunk = {}, None, None
    for l in text.splitlines():
        if l.startswith("+++ "):
            p = l[4:].split("\t")[0]
            cur = None if p == "/dev/null" else re.sub(r"^b/", "", p)
            if cur:
                files.setdefault(cur, [])
            hunk = None
        elif l.startswith("--- ") and hunk is None:
            continue
        elif (m := re.match(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@", l)) and cur:
            hunk = (int(m.group(1)), int(m.group(2)), [])
            files[cur].append(hunk)
        elif hunk is not None and l[:1] in (" ", "+", "-"):
            hunk[2].append((l[0], l[1:]))
        elif hunk is not None and l.startswith("\\"):
            continue
        elif l.startswith("diff "):
            hunk = None
    return files


HASH_COMMENT = {".py", ".sh", ".bash", ".yml", ".yaml", ".toml", ".cfg", ".ini", ".conf", ".txt",
                ""}
SLASH_COMMENT = {".js", ".ts", ".mjs", ".go", ".rs", ".java", ".c", ".h", ".css"}


def comment_part(line, marker):
    q = None
    for i, c in enumerate(line):
        if q:
            if c == q:
                q = None
        elif c in "'\"":
            q = c
        elif line.startswith(marker, i):
            return line[i + len(marker):]
    return None


def added_comment_blocks(path, hunks):
    """Heuristic (a): [(new lineno, text)] blocks of added comment / docstring text."""
    ext = Path(path).suffix.lower()
    name = Path(path).name
    if ext == ".md" or (ext not in HASH_COMMENT | SLASH_COMMENT and name not in
                        ("Dockerfile", "Caddyfile", "Makefile")):
        return []
    marker = "//" if ext in SLASH_COMMENT else "#"
    blocks = []
    for _old, new, lines in hunks:
        n, in_doc, cur = new, None, None
        for tag, t in lines:
            if tag == "-":
                continue
            text, whole = None, True
            if ext == ".py":
                s = t.strip()
                if in_doc:
                    text = s.replace(in_doc, " ")
                    if in_doc in s:
                        in_doc = None
                elif re.match(r"^[rbuRBU]{0,2}('''|\"\"\")", s):
                    q = '"""' if '"""' in s else "'''"
                    text = s.replace(q, " ")
                    if s.count(q) == 1:
                        in_doc = q
            if text is None:
                text = comment_part(t, marker)
                whole = text is not None and t.strip().startswith(marker)
            if tag == "+" and text is not None and text.strip() and not whole:
                blocks.append([n, text.strip(), 1])  # a trailing comment stands alone
                cur = None
            elif tag == "+" and text is not None and text.strip():
                if cur and cur[0] + cur[2] == n:
                    cur[1] += " " + text.strip()
                    cur[2] += 1
                else:
                    cur = [n, text.strip(), 1]
                    blocks.append(cur)
            else:
                cur = None
            n += 1
    return [(a, b) for a, b, _ in blocks]


def reconstruct(base_text, hunks):
    """New-side text and its added line numbers, or None if a hunk does not apply."""
    old = base_text.splitlines()
    new, added, pos = [], set(), 0
    for old_start, _new, lines in hunks:
        at = max(old_start - 1, 0) if any(t != "+" for t, _ in lines) else old_start
        if at < pos:
            return None
        new.extend(old[pos:at])
        pos = at
        for tag, t in lines:
            if tag in " -":
                if pos >= len(old) or old[pos] != t:
                    return None
                pos += 1
            if tag in " +":
                new.append(t)
                if tag == "+":
                    added.add(len(new))
    new.extend(old[pos:])
    return "\n".join(new) + "\n", added


def py_doc_blocks(src, added):
    """Precise (b): docstrings and leading comment blocks touching added lines."""
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return None
    lines = src.splitlines()
    spans = []
    for node in [tree] + [n for n in ast.walk(tree)
                          if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]:
        body = getattr(node, "body", [])
        if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None),
                                                                 ast.Constant) \
                and isinstance(body[0].value.value, str):
            spans.append((body[0].lineno, body[0].end_lineno))
        if node is not tree:
            first = min([node.lineno] + [d.lineno for d in getattr(node, "decorator_list", [])])
            k = first - 1
            while k >= 1 and lines[k - 1].strip().startswith("#"):
                k -= 1
            if k + 1 < first:
                spans.append((k + 1, first - 1))
    k = 1  # module-top comment block
    while k <= len(lines) and lines[k - 1].strip().startswith("#"):
        k += 1
    if k > 1:
        spans.append((1, k - 1))
    out = []
    for a, z in sorted(set(spans)):
        hit = [n for n in range(a, z + 1) if n in added]
        if hit:
            text = " ".join(lines[n - 1].strip().lstrip("#").replace('"""', " ").replace("'''", " ")
                            for n in hit)
            out.append((hit[0], text))
    return out


def base_commit(b):
    m = re.search(r"at base\s+`([0-9a-f]{7,40})\b", b.header)
    return m.group(1) if m else None


def section3_paths(b):
    start, lines = b.section(3)
    paths = set()
    for _ln, cells in b.table_in(list(enumerate(lines, start))):
        paths.update(re.findall(r"`([^`\s]+)`", cells[0]))
    return paths


def patch_units(b, repo):
    """[(where, text)] for F7 from the patches beside the brief."""
    units = []
    base = base_commit(b) if repo else None
    s3 = section3_paths(b) if repo else set()
    if repo and not base:
        print("note: --repo given but no `at base <sha>` in the header; (b) skipped",
              file=sys.stderr)
    for p in sorted(b.path.parent.glob("*.patch")) + sorted(b.path.parent.glob("*.diff")):
        try:
            files = parse_patch(p.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError) as e:
            print(f"note: cannot read {p.name}: {e}", file=sys.stderr)
            continue
        for path, hunks in files.items():
            blocks = None
            if base and path in s3 and path.endswith(".py"):
                r = subprocess.run(["git", "-C", str(repo), "show", f"{base}:{path}"],
                                   capture_output=True, text=True)
                rec = reconstruct(r.stdout if r.returncode == 0 else "", hunks)
                if rec:
                    blocks = py_doc_blocks(*rec)
                if blocks is None:
                    print(f"note: {p.name} {path}: does not apply at {base}; heuristic used",
                          file=sys.stderr)
            # (a) every added comment / docstring line, by the heuristic; (b), when it ran,
            # adds the docstrings and leading comment blocks read on the reconstructed file
            # a sentence both passes find is read once per occurrence, not twice
            got = {}
            for src in (blocks or [], added_comment_blocks(path, hunks)):
                mine = {}
                for n, text in src:
                    for s in sentences(text):
                        mine.setdefault(s, []).append(n)
                for s, ns in mine.items():
                    if len(ns) > len(got.get(s, [])):
                        got[s] = ns
            for s, ns in got.items():
                for n in ns:
                    units.append((f"{p.name}:{path}:+{n}", s))
    return units


# ---- the checks ----------------------------------------------------------------------------

def check(b, listing=None, repo=None):
    fails = []

    def fail(cid, where, what):
        fails.append(f"FAIL {cid} {where}: {what}")

    # F1
    nums = [int(n) for _, n in b.heads]
    for n in range(1, 10):
        if n not in nums:
            fail("F1", f"§{n}", "section `## %d.` missing" % n)
    present = [n for n in nums if 1 <= n <= 9]
    if present != sorted(present) or len(present) != len(set(present)):
        fail("F1", "headings", f"sections out of order or repeated: {present}")

    lines = attack_lines(b)
    reads = readings(b)
    read_ids = {i for _, ids, _, _ in reads for i in ids}
    cells = b.lane_cells()
    a3 = cells.get("3a", (None, ""))[1]
    a3_bare = a3.replace("`", "").lower()

    # F2
    for ln, t in lines:
        ids = line_ids(t)
        if "NOT RUN" in t:
            continue
        if not ids:
            fail("F2", f"line {ln + 1}", f"attack line has no id: {norm(t)[:70]}")
        for i in ids:
            if i not in read_ids:
                fail("F2", f"line {ln + 1}", f"attack {i} has no reading in §2 Attack readings")

    # F3
    not_run = [(ln, ids, head) for ln, ids, head, rest in reads if "NOT RUN" in rest]
    not_run += [(ln, line_ids(t), "") for ln, t in lines if "NOT RUN" in t]
    for ln, ids, head in not_run:
        if "3a" not in cells:
            fail("F3", f"line {ln + 1}", f"NOT RUN {' '.join(ids) or head!r} but §7 has no 3a cell")
            continue
        if ids:
            for i in ids:
                if not re.search(r"(?<![\w-])" + re.escape(i) + r"(?![\w-])", a3):
                    fail("F3", f"line {ln + 1}", f"NOT RUN {i} not named in the 3a cell")
        else:
            words = [w for w in re.findall(r"[a-z0-9]{3,}", head.lower())
                     if w not in ("the", "and", "for", "with")]
            if not words or not all(w in a3_bare for w in words):
                fail("F3", f"line {ln + 1}", f"NOT RUN {head!r} not named in the 3a cell")
    for table in ("Partition", "Sources"):  # plan step 5: a NOT RUN row is in the lane's cell
        for ln, row in b.table_in(b.block(2, table)):
            if any("NOT RUN" in c for c in row) and table.lower() not in a3.lower():
                fail("F3", f"line {ln + 1}", f"{table} row reads NOT RUN; the 3a cell does not "
                     f"mention the {table}")

    # F4, F5
    for ln, row in b.table_in(b.block(2, "Sources")):
        last = row[-1].replace("*", "").replace("`", "").strip().lower()
        if not last.startswith(SOURCE_STATES):
            fail("F4", f"line {ln + 1}", f"Sources re-read reads {row[-1][:50]!r}")
    for ln, row in b.table_in(b.block(2, "Partition")):
        if len(row) < 2 or not row[-1].strip():
            fail("F5", f"line {ln + 1}", "Partition row has no reading")
    if not b.block(2, "Sources"):
        fail("F4", "§2", "no **Sources** block")
    if not b.block(2, "Partition"):
        fail("F5", "§2", "no **Partition** block")

    # F6
    if not cells:
        fail("F6", "§7", "no 3a or 3b lane cell")
    for lane, (ln, cell) in sorted(cells.items()):
        have = norm(cell)
        at = 0
        for f in fragments(lane):
            k = have.find(f, at)
            if k < 0:
                why = "out of order" if f in have else "missing"
                fail("F6", f"line {ln + 1} ({lane})", f"lanes.md text {why}: {f[:70]!r}")
            else:
                at = k + len(f)

    # F7
    # a §7 line's id, or an id the Attack readings block keys (the lane's own attacks)
    ids = {i for _, t in lines for i in line_ids(t)} | read_ids
    units = []
    start, s3 = b.section(3)
    para, in_table = [], False
    for k, l in enumerate(s3 + [""], start):
        if l.lstrip().startswith("|"):
            c = split_row(l)
            if in_table and not is_sep(c):  # the first row is the table's header
                units.append((f"line {k + 1}", " | ".join(c)))
            in_table = True
            continue
        in_table = False
        if l.strip() and not re.match(r"^\s*[-*] ", l):
            para.append((k, l))
            continue
        if para:
            for s in sentences(" ".join(x for _, x in para)):
                units.append((f"line {para[0][0] + 1}", s))
            para = []
        if re.match(r"^\s*[-*] ", l):
            para.append((k, l))
    for lane, (ln, cell) in sorted(cells.items()):
        units.append((f"line {ln + 1} ({lane})", cell))
    units = [(w, u, False) for w, u in units] + [(w, u, True) for w, u in patch_units(b, repo)]
    for where, u, code in units:
        if class_unit_fails(u, ids, code):
            w = class_word(u, code)
            what = f"class word {w!r} with no §7 id: {u[:80]!r}"
            if code:  # ponytail: added code comments are advisory (round-8 ruling); cite an id or leave a note
                fails.append(f"WARN F7 {where}: {what}")
            else:
                fail("F7", where, what)

    # F8
    start, s5 = b.section(5)
    f8 = False
    its = items(list(enumerate(s5, start)))
    for k, (ln, ind, t) in enumerate(its):
        m = re.match(r"^\*\*([A-Z]\d+)\b", t)
        if not m:
            continue
        for _ln2, ind2, t2 in its[k + 1:]:  # the rule's sub-items belong to it
            if ind2 <= ind:
                break
            t += " " + t2
        missing = [name for name, ok in (
            ("command", re.search(r"`[^`]+`", t)),
            ("settle clause", re.search(r"settle|\b(?:read|reads|run|runs)\b[:*\s]*(?:once|twice)\b",
                                        t, re.I)),
            ("FAIL reading", "FAIL" in t),
            ("dry-run reading", re.search(r"dry[ -]run", t, re.I)),
            ("dataset", re.search(r"data ?set|stand-in|slice", t, re.I)),
            ("cannot-run reading", re.search(r"cannot run|can't run|not run|skip|trace", t, re.I))) if not ok]
        if missing:
            f8 = True
            fail("F8", f"line {ln + 1} ({m.group(1)})", "missing " + ", ".join(missing))
    if f8:
        fails.append("     F8 fields (`--fields`): " + RULE_FIELDS)

    # F9
    if listing is not None:
        tags = Counter(m.group(1) for l in listing.splitlines()
                       if (m := re.match(r"^\s*\d+:\s*- Lesson \(([^)]+)\)", l)))
        if not tags and listing.strip():
            raise Unusable("--listing holds no `N: - Lesson (tag): …` line")
        for tag, want in sorted(tags.items()):
            forms = [tag] + ([tag.split()[-1]] if " " in tag else [])
            got = 0
            for f in forms:
                for m in re.finditer(r"(?<![\w-])" + re.escape(f) + r"(?![\w-])(\s*[×x](\d+))?",
                                     b.header):
                    got += int(m.group(2)) if m.group(2) else 1
                if got:
                    break
            if got < want:
                fail("F9", "header", f"lesson tag {tag!r}: {want} in the listing, "
                     f"{got} in Lessons read")
    return fails


def main(argv):
    args = list(argv)
    if args == ["--fields"]:  # what brief-template §5 and spike q3 point at
        print("§5 " + RULE_FIELDS)
        print("class words: " + ", ".join(CLASS_WORDS))
        return 0
    opts = {}
    for flag in ("--listing", "--repo"):
        if flag in args:
            k = args.index(flag)
            if k + 1 >= len(args):
                print(f"{flag} needs a value", file=sys.stderr)
                return 2
            opts[flag] = args[k + 1]
            del args[k:k + 2]
    if len(args) != 1 or args[0].startswith("-"):
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        return 2
    try:
        b = Brief(args[0])
        listing = None
        if "--listing" in opts:
            try:
                listing = Path(opts["--listing"]).read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as e:
                raise Unusable(f"cannot read listing: {e}")
        fails = check(b, listing, opts.get("--repo"))
    except Unusable as e:
        print(f"UNUSABLE: {e}")
        return 2
    for f in fails:
        print(f)
    n = sum(1 for f in fails if f.startswith("FAIL"))
    print("PASS" if not n else f"FAIL ({n})")
    return 1 if n else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
