"""Red/green cases for freeze_check.py and check_pr.py — synthetic, food-themed fixtures.

    python3 -m unittest test_checks        (from this folder)

Every check has a good fixture it passes and a bad one it fails on; the lane cells are built
from the lanes.md beside the scripts, so the fixtures follow that file.
"""
import contextlib
import importlib.util
import io
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


fc = load("freeze_check")
cp = load("check_pr")

GIT_ENV = dict(os.environ, GIT_AUTHOR_NAME="cook", GIT_AUTHOR_EMAIL="cook@example.org",
               GIT_COMMITTER_NAME="cook", GIT_COMMITTER_EMAIL="cook@example.org",
               GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True,
                          text=True, env=GIT_ENV).stdout.strip()


def lane_cell(lane, ids):
    """lanes.md's cell for a lane, `*(template text)*` dropped, each `<…>` filled in turn."""
    for l in (HERE / "lanes.md").read_text(encoding="utf-8").splitlines():
        c = fc.split_row(l) if l.lstrip().startswith("|") else []
        if c and c[0].startswith(lane):
            text = c[2].replace("*(template text)*", "").strip()
            for i in ids:
                text = re.sub(r"<[^>]+>", i, text, count=1)
            return text
    raise AssertionError(f"lanes.md has no {lane} row")


A3_CELL = lane_cell("3a", ["A2", "A1"])
B3_CELL = lane_cell("3b", [])

GOOD_BRIEF = f"""# soup-1 — the soup pot stays on the stove

Ticket `soup-1` · authority: the ticket's ruling Q1 (lid first) · planned 2026-10-18 at base \
`BASESHA chore: base` · proposed branch `soup-1` in `.worktrees/soup-1`, PR + rebase-merge. \
Lessons read:

- 3 (bread) a crust test read the oven twice → matches §4.
- 4 (bread) a timer test ran once → no: no timer here.
- 5 (retro r2) one kitchen, two cooks → matches the run.

## 1. What

The pot boils over (`pot.py:3`).

## 2. The design

The lid closes when the water boils (2a).

**Sources**

| sentence (§ · label) | source | verbatim quote | re-read |
|---|---|---|---|
| 2a · water boils at 100 C | https://example.org/water | "boils at 100 C" | verified |
| 2a · steel holds heat | https://example.org/steel | "holds heat" | paraphrased (the page rounds) |

**Partition**

| kind | who writes it / how it reaches the line | executed case | reading |
|---|---|---|---|
| cold water | the cook | test 1 | stays in the pot |
| salted water | the cook | test 2 | stays in the pot |

**Attack readings** (§7 lines):

- A1 a full pot on high heat → the floor stays dry. Holds: test 1.
- A2 every stove kind → NOT RUN (no induction stove in the kitchen).

**What the planner saw:**

- the lid rattles at full boil; harmless.

## 3. Contract (frozen)

| file | owner | change |
|---|---|---|
| `pot.py` | orchestrator | 2a: the lid closes on every boil (A1) |

The lid is glass; it closes on any boil (enumerate: A2's stove kinds).

## 4. Tests

1. `test_the_lid_closes` — *red*: `assert lid.closed`.

## 5. Accept gate

- suite and lint per run steps 3–4
- **R1 the lid holds.** `python3 tools/gate_lid.py` reads `spill=`. Dataset: the stand-in pot. Settle: once. Dry run \
with the fix in: `spill=0`. FAIL reading (base): `spill=3`. Cannot run: `spill=` absent, read FAIL.

## 6. Worst impact

Soup on the floor. ⇒ adversarial lane (3a).

## 7. Lanes

| lane | files | done when |
|---|---|---|
| 3a adversarial | read-only, scratch dir | {A3_CELL} |
| 3b code review | read-only, scratch dir | {B3_CELL} |

Attack lines:

- A1 a full pot on high heat → oracle the floor's dryness
- A2 `enumerate: {{gas, induction, wood}}, source the shop list` → oracle a thermometer

Mutants for 3b:

- `mutant: the lid never closes → test 1 red`

## 8. Out of scope

- The oven: `soup-2`.

## 9. Amendments (append-only after `run`)

| id | date | whose ruling (`<the human>` · `default`) | section | was → now | why |
|---|---|---|---|---|---|
| A3 | 2026-10-18 | the human (R1 "go with reco") | §4 | — → `test_the_lid_survives_a_drop` dropped as a duplicate of `test_the_lid_closes_twice` | one reason to go red |
| D1 | 2026-10-18 | default | §2 2a | steel lid → glass lid | you can see the soup |

## Ending

- **E1 the lid is glass**: recommended, stood.

unruled: none
"""

LISTING = """3: - Lesson (bread): a crust test read the oven twice
4: - Lesson (bread): a timer test ran once
5: - Lesson (retro r2): one kitchen, two cooks
"""


def run_fc(text, listing=None, repo=None, patches=None):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "plan.md"
        p.write_text(text, encoding="utf-8")
        for name, body in (patches or {}).items():
            (Path(d) / name).write_text(body, encoding="utf-8")
        with contextlib.redirect_stderr(io.StringIO()):
            return fc.check(fc.Brief(p), listing, repo)


def ids(fails, cid, kind="FAIL"):
    return [f for f in fails if f.startswith(f"{kind} {cid} ")]


class FreezeCheck(unittest.TestCase):
    def test_fields_prints_the_rule_fields_and_class_words(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(fc.main(["--fields"]), 0)
        self.assertIn("a trace that the step ran", out.getvalue())
        self.assertIn("unchanged", out.getvalue())

    def assertRedGreen(self, cid, bad, good=GOOD_BRIEF, **kw):
        self.assertEqual(ids(run_fc(good, **kw), cid), [], f"{cid} not green on the good brief")
        self.assertTrue(ids(run_fc(bad, **kw), cid), f"{cid} not red on its bad brief")

    def test_good_brief_passes_everything(self):
        self.assertEqual(run_fc(GOOD_BRIEF, LISTING), [])

    def test_f1_a_missing_section(self):
        self.assertRedGreen("F1", GOOD_BRIEF.replace("## 8. Out of scope", "## Out of scope"))

    def test_f2_an_attack_line_with_no_reading(self):
        bad = GOOD_BRIEF.replace("Mutants for 3b:", "- A4 a dropped ladle → oracle the cook's ears"
                                 "\n\nMutants for 3b:")
        self.assertRedGreen("F2", bad)

    def test_f2_an_attack_line_with_no_id(self):
        bad = GOOD_BRIEF.replace("- A1 a full pot", "- a full pot")
        self.assertRedGreen("F2", bad)

    def test_f2_ids_in_parentheses_and_packed_readings(self):
        good = GOOD_BRIEF.replace("- A1 a full pot on high heat → oracle",
                                  "- `enumerate: pot sizes {small, large}` (A1) → oracle")
        good = good.replace("- A1 a full pot on high heat → the floor stays dry. Holds: test 1.",
                            "- 0a round one: A1 pot sizes → dry floor; A5 the spoon → fine.")
        self.assertEqual(ids(run_fc(good), "F2"), [])

    def test_f3_not_run_missing_from_the_3a_cell(self):
        self.assertRedGreen("F3", GOOD_BRIEF.replace(A3_CELL, lane_cell("3a", ["none", "A1"])))

    def test_f3_partition_not_run_needs_the_3a_cell_to_say_partition(self):
        bad = GOOD_BRIEF.replace("| salted water | the cook | test 2 | stays in the pot |",
                                 "| salted water | the cook | — | NOT RUN (no salt) |")
        good = bad.replace(A3_CELL, lane_cell("3a", ["A2 and the salted-water Partition row",
                                                     "A1"]))
        self.assertRedGreen("F3", bad, good)

    def test_f3_sources_not_run_needs_the_3a_cell_to_say_sources(self):
        bad = GOOD_BRIEF.replace("| paraphrased (the page rounds) |", "| NOT RUN (offline) |")
        good = bad.replace(A3_CELL, lane_cell("3a", ["A2 and the Sources row marked NOT RUN",
                                                     "A1"]))
        self.assertRedGreen("F3", bad, good)

    def test_f3_no_3a_cell(self):
        bad = GOOD_BRIEF.replace(f"| 3a adversarial | read-only, scratch dir | {A3_CELL} |\n", "")
        self.assertRedGreen("F3", bad)

    def test_f4_a_sources_row_outside_the_states(self):
        self.assertRedGreen("F4", GOOD_BRIEF.replace("| paraphrased (the page rounds) |",
                                                     "| research lane |"))

    def test_f5_a_partition_row_with_no_reading(self):
        self.assertRedGreen("F5", GOOD_BRIEF.replace("| test 2 | stays in the pot |",
                                                     "| test 2 |  |"))

    def test_f6_a_clause_dropped_from_a_lane_cell(self):
        clause = "the hostile corpus"
        self.assertIn(clause, A3_CELL)
        self.assertRedGreen("F6", GOOD_BRIEF.replace(A3_CELL, A3_CELL.replace(clause, "")))

    def test_f6_added_words_between_clauses_pass(self):
        good = GOOD_BRIEF.replace(B3_CELL, B3_CELL + "; output under `reports/3b/`")
        self.assertEqual(ids(run_fc(good), "F6"), [])

    def test_f7_a_contract_class_word_with_no_id(self):
        self.assertRedGreen("F7", GOOD_BRIEF.replace("2a: the lid closes on every boil (A1)",
                                                     "2a: the lid closes on every boil"))

    def test_f7_python_none_and_code_spans_are_not_class_words(self):
        patch = PATCH_HEAD + '+def lid():\n+    """The lid, or None. Calls `any(x)`."""\n'
        self.assertEqual(ids(run_fc(GOOD_BRIEF, patches={"sketch.patch": patch}), "F7"), [])

    def test_f7a_an_added_comment_in_a_patch(self):
        good = PATCH_HEAD + "+x = 1\n+# the lid never leaks (A1)\n"
        bad = PATCH_HEAD + "+x = 1\n+# the lid never leaks\n"
        self.assertEqual(ids(run_fc(GOOD_BRIEF, patches={"sketch.patch": good}), "F7", "WARN"), [])
        out = run_fc(GOOD_BRIEF, patches={"sketch.patch": bad})
        self.assertTrue(ids(out, "F7", "WARN"))
        self.assertEqual(ids(out, "F7"), [], "an added code comment warns, never fails")

    def test_f7b_a_docstring_line_only_the_repo_read_sees(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d) / "repo"
            repo.mkdir()
            git(repo, "init", "-q")
            (repo / "pot.py").write_text(BASE_POT, encoding="utf-8")
            git(repo, "add", "pot.py")
            git(repo, "commit", "-q", "-m", "base")
            sha = git(repo, "rev-parse", "--short", "HEAD")
            brief = GOOD_BRIEF.replace("BASESHA", sha)
            patches = {"sketch.patch": MID_DOC_PATCH}
            heuristic = ids(run_fc(brief, patches=patches), "F7", "WARN")
            precise = ids(run_fc(brief, patches=patches, repo=repo), "F7", "WARN")
        self.assertEqual(heuristic, [], "the hunk-local heuristic cannot see the docstring")
        self.assertTrue(precise and "never rattles" in precise[0])

    def test_f8_a_rule_missing_its_settle_clause(self):
        bad = GOOD_BRIEF.replace("Settle: once. ", "")
        fails = run_fc(bad)
        self.assertTrue(ids(fails, "F8"))
        self.assertTrue(any(fc.RULE_FIELDS in f for f in fails), "field list not printed")
        self.assertEqual(ids(run_fc(GOOD_BRIEF), "F8"), [])

    def test_f8_a_rule_missing_its_cannot_run_reading(self):
        self.assertRedGreen("F8", GOOD_BRIEF.replace(" Cannot run: `spill=` absent, read FAIL.", ""))

    def test_f8_a_rule_read_on_sub_items(self):
        good = GOOD_BRIEF.replace(
            "- **R1 the lid holds.** `python3 tools/gate_lid.py` reads `spill=`. Dataset: the stand-in pot. "
            "Settle: once. Dry run \\\nwith the fix in: `spill=0`. FAIL reading (base): `spill=3`. "
            "Cannot run: `spill=` absent, read FAIL.",
            "- **R1 the lid holds.** `python3 tools/gate_lid.py` reads `spill=`.\n"
            "  - **Runs:** once.\n  - Dry run: `spill=0`.\n  - FAIL reading: `spill=3`.\n"
            "  - Dataset: the stand-in pot.\n  - Cannot run: `spill=` absent, read FAIL.")
        self.assertEqual(ids(run_fc(good), "F8"), [])

    def test_f9_a_lesson_tag_listed_fewer_times(self):
        bad = GOOD_BRIEF.replace("- 4 (bread) a timer test ran once → no: no timer here.\n", "")
        self.assertRedGreen("F9", bad, listing=LISTING)

    def test_f9_counts_times_marks_and_the_last_word_of_a_tag(self):
        good = GOOD_BRIEF.replace(
            "- 3 (bread) a crust test read the oven twice → matches §4.\n"
            "- 4 (bread) a timer test ran once → no: no timer here.\n"
            "- 5 (retro r2) one kitchen, two cooks → matches the run.\n",
            "- bread ×2: both match §4.\n- r2 (one kitchen) matches the run.\n")
        self.assertEqual(ids(run_fc(good, LISTING), "F9"), [])

    def test_exit_codes(self):
        with tempfile.TemporaryDirectory() as d:
            good, bad = Path(d) / "good.md", Path(d) / "bad.md"
            good.write_text(GOOD_BRIEF, encoding="utf-8")
            bad.write_text(GOOD_BRIEF.replace("## 8. Out of scope", "## Out"), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(fc.main([str(good)]), 0)
                self.assertEqual(fc.main([str(bad)]), 1)
                self.assertEqual(fc.main([str(Path(d) / "missing.md")]), 2)
            self.assertIn("PASS", out.getvalue())


PATCH_HEAD = "diff --git a/pot.py b/pot.py\n--- a/pot.py\n+++ b/pot.py\n@@ -0,0 +1,2 @@\n"
BASE_POT = 'def boil():\n    """Boil the soup.\n\n    The pot is steel.\n    """\n    return 1\n'
MID_DOC_PATCH = ("diff --git a/pot.py b/pot.py\n--- a/pot.py\n+++ b/pot.py\n"
                 "@@ -4,2 +4,3 @@\n     The pot is steel.\n+    The lid never rattles.\n"
                 '     """\n')

GOOD_BODY = f"""Plan ending: [brief commit abc1234](https://example.org/c/abc1234) · ticket `soup-1`

## What

The lid closes when the soup boils.

## Verification

| reading | command | result |
|---|---|---|
| suite | `python3 -m pytest` | 12 passed |

## Unreviewed since the last lane

```
$ git log REVIEWED..HEAD -- src
```
empty

## Decisions

{cp.DECISIONS_KEY}

| decision | label | what was done | why |
|---|---|---|---|
| Plan Q1: the lid first | RULING | lid before the timer | a timer cannot stop a spill |
| D1: a glass lid | DEFAULT | shipped (§9 D1) | the cook sees the soup |
| E1: the lid is glass | DEFAULT | accepted | as recommended |

## Findings

{cp.FINDINGS_KEY}

| finding | label | what was done | why |
|---|---|---|---|
| (review) the lid rattles | DECLINE | — | `style`: a sound, not a spill |
| (plan) the handle burns | TICKET | `soup-3` | outside the pot |

## Follow-up

- `soup-3` — the handle
"""


def run_cp(body, plan=GOOD_BRIEF, **kw):
    return cp.check(plan, body, **kw)


class CheckPr(unittest.TestCase):
    def assertRedGreen(self, cid, bad, good=GOOD_BODY, **kw):
        self.assertEqual(ids(run_cp(good, **kw), cid), [], f"{cid} not green on the good body")
        self.assertTrue(ids(run_cp(bad, **kw), cid), f"{cid} not red on its bad body")

    def test_good_body_passes(self):
        self.assertEqual(run_cp(GOOD_BODY), [])

    def test_skeleton_holds_the_keys_and_the_order(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(cp.main(["--skeleton"]), 0)
        sk = out.getvalue()
        self.assertIn(cp.DECISIONS_KEY, sk)
        self.assertIn(cp.FINDINGS_KEY, sk)
        heads = re.findall(r"^## (.+)$", sk, re.M)
        self.assertEqual(heads, cp.SECTIONS)
        self.assertIn("**RULING:** the ticket owner decided before the work went on. **DEFAULT:** "
                      "recommended and shown to the ticket owner, and it stood because they "
                      "didn't strike it.", sk)
        self.assertIn("**APPLY:** fixed in this PR. **DECLINE:** looked at and deliberately not "
                      "acted on, with the reason. **TICKET:** real, but tracked in its own ticket. "
                      "Every finding has a row, ruled ones too, tagged (plan) or (review).", sk)

    def test_p1_missing_and_reordered_sections(self):
        self.assertRedGreen("P1", GOOD_BODY.replace("## Unreviewed since the last lane", "## Notes"))
        a, b = GOOD_BODY.split("## Verification")
        swapped = a.replace("## What", "## Verification") + "## What" + b
        self.assertTrue(ids(run_cp(swapped), "P1"))

    def test_p1_first_line_must_link_the_plan(self):
        self.assertRedGreen("P1", "Soup!\n" + GOOD_BODY.split("\n", 1)[1])

    def test_p2_header_key_and_bullets(self):
        self.assertRedGreen("P2", GOOD_BODY.replace("| decision | label | what was done | why |",
                                                    "| decision | label | why |"))
        self.assertRedGreen("P2", GOOD_BODY.replace("they didn't strike it.", "nobody minded."))
        bullets = GOOD_BODY.replace(
            "| finding | label | what was done | why |\n|---|---|---|---|\n"
            "| (review) the lid rattles | DECLINE | — | `style`: a sound, not a spill |\n"
            "| (plan) the handle burns | TICKET | `soup-3` | outside the pot |\n",
            "- Corrected (plan): the handle burns.\n")
        self.assertRedGreen("P2", bullets)
        self.assertTrue(ids(run_cp(bullets), "P3"), "a bullet opening with no label")

    def test_p3_labels_and_decline_reasons(self):
        self.assertRedGreen("P3", GOOD_BODY.replace("| DEFAULT | accepted |", "| AGREED | accepted |"))
        self.assertRedGreen("P3", GOOD_BODY.replace("`style`: a sound, not a spill",
                                                    "a sound, not a spill"))
        self.assertRedGreen("P3", GOOD_BODY.replace("`style`: a sound, not a spill",
                                                    "`style`, and `unreachable` too"))

    def test_p4_a_decision_the_brief_does_not_record(self):
        self.assertRedGreen("P4", GOOD_BODY.replace("| D1: a glass lid | DEFAULT | shipped (§9 D1)",
                                                    "| D7: a glass lid | DEFAULT | shipped"))
        self.assertRedGreen("P4", GOOD_BODY.replace("| D1: a glass lid | DEFAULT | shipped (§9 D1)",
                                                    "| A glass lid | DEFAULT | shipped"))

    def test_p4_a_run_ruling_named_by_its_ruling_id(self):
        body = GOOD_BODY.replace("| E1: the lid is glass | DEFAULT | accepted | as recommended |",
                                 "| Review R1: drop the duplicate | RULING | dropped | one reason |")
        self.assertEqual(ids(run_cp(body), "P4"), [])

    def test_p5_missing_output_and_a_rerun_that_differs(self):
        self.assertRedGreen("P5", GOOD_BODY.replace("```\nempty\n", "```\n"))
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            git(repo, "init", "-q")
            (repo / "src").mkdir()
            (repo / "src" / "pot.py").write_text("x = 1\n")
            git(repo, "add", "-A")
            git(repo, "commit", "-q", "-m", "reviewed")
            reviewed = git(repo, "rev-parse", "--short", "HEAD")
            body = GOOD_BODY.replace("REVIEWED", reviewed)
            self.assertEqual(ids(run_cp(body, repo=repo), "P5"), [])
            (repo / "src" / "pot.py").write_text("x = 2\n")
            git(repo, "commit", "-qam", "unreviewed salt")
            self.assertTrue(ids(run_cp(body, repo=repo), "P5"), "a re-run listing a commit")
            new = git(repo, "log", "--oneline", f"{reviewed}..HEAD", "--", "src")
            pasted = body.replace("```\nempty\n", f"{new}\n```\n").replace(
                "$ git log", "$ git log --oneline")
            self.assertEqual(ids(run_cp(pasted, repo=repo), "P5"), [])
            short = body.replace("```\nempty\n", f"{new}\n```\n")  # short listing, full command
            self.assertEqual(ids(run_cp(short, repo=repo), "P5"), [])
            unsafe = body.replace("$ git log", "$ git log --output=/tmp/x")
            self.assertTrue(ids(run_cp(unsafe, repo=repo), "P5"))

    def test_p6_a_test_gone_after_the_tests_commit(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            git(repo, "init", "-q")
            (repo / "tests").mkdir()
            f = repo / "tests" / "test_pot.py"
            f.write_text("def test_the_lid_closes():\n    pass\n\n"
                         "def test_the_lid_closes_twice():\n    pass\n")
            git(repo, "add", "-A")
            git(repo, "commit", "-q", "-m", "tests")
            tests = git(repo, "rev-parse", "HEAD")
            f.write_text("def test_the_lid_closes():\n    pass\n")
            git(repo, "commit", "-qam", "drop one")
            body = GOOD_BODY.replace("REVIEWED", tests)
            named = run_cp(body, repo=repo, tests_commit=tests)
            unnamed = run_cp(body, plan=GOOD_BRIEF.replace(
                "`test_the_lid_closes_twice`", "the other one"), repo=repo, tests_commit=tests)
        self.assertEqual(ids(named, "P6"), [])
        self.assertTrue(ids(unnamed, "P6"))

    def test_asks_counts_and_refuses_a_bad_kind(self):
        good = ("# soup-1\n\n## Ask 2026-10-18 · interview\n\n**Q1** glass or steel?\n"
                "**Q2** lid first?\n\n## Ask 2026-10-19 · ruling\n\n**Q1** keep the rattle?\n\n"
                "## Ask 2026-10-20 · pr-open\n\nPR open.\n")
        with tempfile.TemporaryDirectory() as d:
            p, q = Path(d) / "good.md", Path(d) / "bad.md"
            p.write_text(good)
            q.write_text(good.replace("· ruling", "· chat"))
            rows, fails = cp.asks([str(p)])
            self.assertEqual(fails, [])
            self.assertIn("asks=3 questions=3 by kind: interview=1 ruling=1 pr-open=1", rows[0])
            rows, fails = cp.asks([str(q)])
            self.assertTrue(fails)

    def test_exit_codes(self):
        with tempfile.TemporaryDirectory() as d:
            plan, body = Path(d) / "plan.md", Path(d) / "body.md"
            plan.write_text(GOOD_BRIEF)
            body.write_text(GOOD_BODY)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(cp.main([str(plan), str(body)]), 0)
                body.write_text(GOOD_BODY.replace("| DEFAULT | accepted |", "| OK | accepted |"))
                self.assertEqual(cp.main([str(plan), str(body)]), 1)
                self.assertEqual(cp.main([str(plan), str(Path(d) / "none.md")]), 2)


if __name__ == "__main__":
    unittest.main()
