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
import shutil
import subprocess
import sys
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


def run_fc(text, listing=None, repo=None, patches=None, decisions=None):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "plan.md"
        p.write_text(text, encoding="utf-8")
        if decisions is not None:
            (Path(d) / "decisions.md").write_text(decisions, encoding="utf-8")
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
        one_line = ("- **R1 the lid holds.** `python3 tools/gate_lid.py` reads `spill=`. Dataset: "
                    "the stand-in pot. Settle: once. Dry run with the fix in: `spill=0`. FAIL "
                    "reading (base): `spill=3`. Cannot run: `spill=` absent, read FAIL.")
        head = "- **R1 the lid holds.** `python3 tools/gate_lid.py` reads `spill=`.\n"
        subs = ("  - **Runs:** once.\n  - Dry run: `spill=0`.\n  - FAIL reading: `spill=3`.\n"
                "  - Dataset: the stand-in pot.\n  - Cannot run: `spill=` absent, read FAIL.")
        good = GOOD_BRIEF.replace(one_line, head + subs)
        self.assertNotEqual(good, GOOD_BRIEF, "the fixture must differ from the good brief")
        self.assertEqual(ids(run_fc(good), "F8"), [])
        # the sub-items are what carry the fields: without them the rule fails
        self.assertTrue(ids(run_fc(GOOD_BRIEF.replace(one_line, head.rstrip("\n"))), "F8"))

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

    def test_f9_an_empty_listing_fails_unless_the_header_reads_none(self):
        # round 10, D6 (skills-q6f1): a 0-line listing reads FAIL naming the input, not PASS; a
        # fresh retro marker's empty listing passes when the header says `Lessons read: none`
        fails = ids(run_fc(GOOD_BRIEF, ""), "F9")
        self.assertTrue(fails and "--listing" in fails[0] and "empty" in fails[0], fails)
        lessons = GOOD_BRIEF.split("Lessons read:")[1].split("## 1.")[0]
        none = GOOD_BRIEF.replace("Lessons read:" + lessons, "Lessons read: none.\n\n")
        self.assertNotEqual(none, GOOD_BRIEF)
        self.assertEqual(ids(run_fc(none, ""), "F9"), [])

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
| §5 R1 the lid holds | `python3 tools/gate_lid.py` | PASS |

Readings taken on head 5d6e7f8.

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
| A3: one duplicate test dropped | RULING | dropped | one reason to go red |
| D1: a glass lid | DEFAULT | shipped (§9 D1) | the cook sees the soup |
| E1: the lid is glass | DEFAULT | accepted | as recommended |

## Findings

{cp.FINDINGS_KEY}

| finding | label | what was done | why |
|---|---|---|---|
| (review) the lid rattles | DECLINE | — | `style`: a sound, not a spill |
| (plan) `handle.py:-` the handle burns | TICKET | `soup-3` | outside the pot |

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
            "| (plan) `handle.py:-` the handle burns | TICKET | `soup-3` | outside the pot |\n",
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

    def test_ids_in_reads_wave_prefixed_ids(self):
        self.assertEqual(cp.ids_in("W0-R1 the base, W3-D12 a test, W3-n1 a note"), {"W0-R1", "W3-D12", "W3-n1"})
        self.assertEqual(cp.ids_in("R5, D1, W0 and Q2a"), {"R5", "D1", "W0", "Q2a"})
        self.assertEqual(cp.ids_in("D1–D3"), {"D1", "D2", "D3"})

    def test_p4_a_decision_named_by_a_wave_prefixed_id(self):
        plan = GOOD_BRIEF.replace("| D1 | 2026-10-18 | default |", "| W3-D1 | 2026-10-18 | default |")
        body = GOOD_BODY.replace("| D1: a glass lid | DEFAULT | shipped (§9 D1)", "| W3-D1: a glass lid | DEFAULT | shipped (§9 W3-D1)")
        self.assertNotEqual(plan, GOOD_BRIEF)
        self.assertNotEqual(body, GOOD_BODY)
        self.assertEqual(ids(run_cp(body, plan), "P4"), [])
        self.assertTrue(ids(run_cp(body.replace("W3-D1", "W3-D7"), plan), "P4"), "an unrecorded wave id is still red")

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
            target = repo / "written-by-git.txt"
            unsafe = body.replace("$ git log", f"$ git log --output={target}")
            refused = ids(run_cp(unsafe, repo=repo), "P5")
            self.assertTrue(refused and "refused to re-run" in refused[0], refused)
            self.assertFalse(target.exists(), "an unsafe option was run")

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


# ---- round 9: the id grammar (R4), trivial mode (R2), unruled ids (R3), the decisions mirror
# (R12), base SHAs (R14), asks (R9), the plain blockquote (R15), the skeleton (R10) ----------

MINTED = ["Q1", "D5", "RB1", "RV1a", "A-B3", "RR1-a", "W1-b", "W0-R1", "W3-D12", "W3-n1", "R1-Q1",
          "R-1", "R-A", "D-3", "W3r2-D1", "W1-1", "PD1"]


class IdGrammar(unittest.TestCase):
    def test_the_docstring_writes_every_minted_form(self):
        doc = cp.__doc__.split("Id grammar")[1]
        for form in MINTED + ["RB"]:
            with self.subTest(form=form):
                self.assertRegex(doc, r"(?<![\w-])" + re.escape(form) + r"(?![\w-])")

    def test_each_minted_form_reads_as_one_id(self):
        for form in MINTED:
            with self.subTest(form=form):
                self.assertEqual(cp.ids_in(f"the row {form}, then a word"), {form})
                self.assertEqual(cp.slot_id(f"**{form}**"), form)

    def test_a_bare_letters_id_reads_in_a_slot_only(self):
        self.assertEqual(cp.slot_id("RB"), "RB")
        self.assertEqual(cp.ids_in("RB said so"), set())
        plan = GOOD_BRIEF.replace("| D1 | 2026-10-18 | default |", "| RB | 2026-10-18 | default |")
        body = GOOD_BODY.replace("| D1: a glass lid | DEFAULT | shipped (§9 D1)",
                                 "| **RB** a glass lid | DEFAULT | shipped")
        self.assertEqual(ids(run_cp(body, plan), "P4"), [])

    def test_words_and_tracker_keys_are_not_ids(self):
        for text in ("ABC-1234", "XYZ-12", "AB-12", "the PR is OK", "plain words", "UTF-8"):
            with self.subTest(text=text):
                self.assertEqual(cp.ids_in(text), set())
                self.assertIsNone(cp.slot_id("ABC-1234"))

    def test_a_two_letter_lowercase_tail_is_no_id(self):
        self.assertEqual(cp.ids_in("RR1-ab"), set())
        self.assertIsNone(cp.slot_id("RR1-ab"))

    def test_ranges_expand_fully_and_never_yield_the_bare_tail(self):
        cases = {"Q1-Q4": ["Q1", "Q2", "Q3", "Q4"],
                 "D1–D7": [f"D{k}" for k in range(1, 8)],
                 "D1–7": [f"D{k}" for k in range(1, 8)],
                 "W3-D1..D3": ["W3-D1", "W3-D2", "W3-D3"],
                 "W9-R1–R6": [f"W9-R{k}" for k in range(1, 7)],
                 "W9-R1–W9-R3": ["W9-R1", "W9-R2", "W9-R3"],
                 "A1-A5": ["A1", "A2", "A3", "A4", "A5"]}
        for text, want in cases.items():
            with self.subTest(text=text):
                self.assertEqual(cp.ids_in(f"rows {text} ruled"), set(want))

    def test_a_digit_tail_after_a_hyphen_is_one_id(self):
        self.assertEqual(cp.ids_in("W1-1 and D1-7"), {"W1-1", "D1-7"})


class Uniqueness(unittest.TestCase):
    def test_p8_a_gate_id_that_is_also_a_ruling_id(self):
        plan = GOOD_BRIEF.replace("| A3 | 2026-10-18 |", "| R1 | 2026-10-18 |")
        self.assertNotEqual(plan, GOOD_BRIEF)
        self.assertEqual(ids(run_cp(GOOD_BODY), "P8"), [])
        self.assertTrue(ids(run_cp(GOOD_BODY, plan), "P8"))

    def test_p8_a_ruling_id_with_two_rows(self):
        plan = GOOD_BRIEF.replace("| A3 | 2026-10-18 |", "| D1 | 2026-10-18 |")
        self.assertTrue(ids(run_cp(GOOD_BODY, plan), "P8"))


# Trivial path fixtures: neutral content, one per PR-body shape on record.
TICKET = """---
# t-0001
title: the parser drops the last field
status: in-progress
---

The parser drops the last field of a line.

## Rulings (interview, 2026-01-02)

Owner, verbatim: "Go with (a)" — **Q1** (a): the parser keeps an empty last field.

## Plan (2026-01-01)

Trivial: an older note. Awaiting go.

unruled: U9 an older item — default no

## Plan (2026-01-03)

Trivial: `parser.py` `split_line` · the red check: `test_the_last_field_is_kept`, 1 failed on \
base `1a2b3c4` · worst case: a line keeps an empty field. Awaiting go.

> **What this is about:** the parser could also trim spaces; the note leaves that alone.

unruled: U1 trimming spaces — default not folded
"""

TRIVIAL_HEAD = ("Plan ending: [trivial note 1a2b3c4](https://example.org/c/1a2b3c4) · ticket "
                "`t-0001` · brief: none (triaged trivial)\n\n## What\n\nThe parser keeps the last "
                "field.\n\n## Verification\n\n| reading | command | result |\n|---|---|---|\n"
                "| red on the base | `python3 -m unittest` at base 1a2b3c4 | 1 failed |\n"
                "| suite against the base | `python3 -m unittest` at base 1a2b3c4 and head 5d6e7f8 "
                "| 40 passed, both |\n\n## Unreviewed since the last lane\n\n```\n"
                "$ git log --oneline 5d6e7f8..HEAD -- src\n```\nempty. On a trivial run the "
                "readings above stand in for the review wave.\n\n")
DECISIONS_DEFAULT = (f"## Decisions\n\n{cp.DECISIONS_KEY}\n\n| decision | label | what was done "
                     "| why |\n|---|---|---|---|\n| U1: trim spaces | DEFAULT | not folded | "
                     "beyond the ticket |\n\n")
FINDINGS = (f"## Findings\n\n{cp.FINDINGS_KEY}\n\n| finding | label | what was done | why |\n"
            "|---|---|---|---|\n| (plan) a tab also splits | APPLY | tested | same path |\n"
            "| (plan) `parser.py:-` a slow read | TICKET | `t-0002` | another file |\n\n")
FOLLOW = "## Follow-up\n\n- `t-0002` — the slow read\n"
TRIVIAL_SHAPES = {
    "default, findings, follow-up": TRIVIAL_HEAD + DECISIONS_DEFAULT + FINDINGS + FOLLOW,
    "default, one ticket finding, follow-up": TRIVIAL_HEAD + DECISIONS_DEFAULT + FINDINGS.replace(
        "| (plan) a tab also splits | APPLY | tested | same path |\n", "") + FOLLOW,
    "default only, follow-up": TRIVIAL_HEAD + DECISIONS_DEFAULT + FOLLOW,
    "ruling on the ticket, pasted commits": TRIVIAL_HEAD.replace(
        "```\nempty.", "5d6e7f8 fix: keep the last field\n1a2b3c4 test: the last field — red\n"
        "```\nempty —").replace("5d6e7f8..HEAD", "9f9f9f9..HEAD") + DECISIONS_DEFAULT.replace(
        "| U1: trim spaces | DEFAULT | not folded | beyond the ticket |",
        "| Q1 | RULING | an empty last field is kept | the owner's answer |") + FOLLOW,
}


class Trivial(unittest.TestCase):
    def test_each_trivial_body_shape_passes_against_its_ticket(self):
        for shape, body in TRIVIAL_SHAPES.items():
            with self.subTest(shape=shape):
                self.assertEqual(run_cp(body, TICKET), [])

    def test_a_body_without_follow_up_fails_p1_only(self):
        body = TRIVIAL_SHAPES["default only, follow-up"].replace(FOLLOW, "")
        fails = run_cp(body, TICKET)
        self.assertTrue(fails)
        self.assertEqual([f for f in fails if not f.startswith("FAIL P1 ")], [])

    def test_p4_reads_the_latest_plan_note_only(self):
        body = TRIVIAL_SHAPES["default only, follow-up"].replace("| U1: trim spaces |",
                                                                 "| U9: an older item |")
        self.assertTrue(ids(run_cp(body, TICKET), "P4"))

    def test_p4_an_unruled_line_with_no_id(self):
        ticket = TICKET.replace("unruled: U1 trimming spaces", "unruled: trimming spaces")
        body = TRIVIAL_SHAPES["default only, follow-up"]
        self.assertTrue(ids(run_cp(body, ticket), "P4"))

    def test_p4_a_default_needs_an_unruled_id_not_a_bold_one(self):
        body = TRIVIAL_SHAPES["default only, follow-up"].replace("| U1: trim spaces | DEFAULT",
                                                                 "| Q1: trim spaces | DEFAULT")
        self.assertTrue(ids(run_cp(body, TICKET), "P4"))

    def test_main_reads_a_ticket_and_prints_not_applicable(self):
        with tempfile.TemporaryDirectory() as d:
            t, b = Path(d) / "t-0001.md", Path(d) / "body.md"
            t.write_text(TICKET, encoding="utf-8")
            b.write_text(TRIVIAL_SHAPES["default, findings, follow-up"], encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(cp.main([str(t), str(b)]), 0)
            self.assertIn("P6 not applicable (trivial)", out.getvalue())
            self.assertNotIn("UNUSABLE", out.getvalue())
            t.write_text(TICKET.split("## Plan")[0], encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(cp.main([str(t), str(b)]), 2)


class UnruledOnTheBrief(unittest.TestCase):
    def test_p4_reads_an_unruled_id_of_the_brief(self):
        plan = GOOD_BRIEF.replace("unruled: none", "> **What this is about:** the spoon.\n\n"
                                                   "unruled: E2 the spoon — default wood")
        body = GOOD_BODY.replace("| E1: the lid is glass | DEFAULT | accepted | as recommended |",
                                 "| E2: a wooden spoon | DEFAULT | accepted | as recommended |")
        self.assertTrue(ids(run_cp(body), "P4"), "E2 is recorded nowhere in the good brief")
        self.assertEqual(ids(run_cp(body, plan), "P4"), [])


GOOD_DECISIONS = """2026-10-17 | Q1 RULING | A · lid first · reco A | the human: "lid first"
2026-10-18 | A3 RULING | A · the duplicate test dropped · reco A | one reason to go red
2026-10-18 | D1 DEFAULT | a glass lid | you can see the soup
"""


class DecisionsMirror(unittest.TestCase):
    def test_m1_a_mirror_that_matches(self):
        self.assertEqual(ids(run_cp(GOOD_BODY, decisions=GOOD_DECISIONS), "M1"), [])

    def test_m1_a_missing_line_a_kind_mismatch_an_extra_id_a_second_line(self):
        bad = {"missing": GOOD_DECISIONS.replace("2026-10-18 | D1 DEFAULT | a glass lid | you can "
                                                 "see the soup\n", ""),
               "kind": GOOD_DECISIONS.replace("D1 DEFAULT", "D1 RULING"),
               "extra": GOOD_DECISIONS + "2026-10-19 | X9 DEFAULT | a ladle | spare\n",
               "twice": GOOD_DECISIONS + "2026-10-19 | D1 DEFAULT | glass, again | twice\n",
               "two ids": GOOD_DECISIONS + "2026-10-19 | D1, D2 DEFAULT | both | as one\n",
               "old label": GOOD_DECISIONS.replace("D1 DEFAULT", "D1 (DEFAULT accepted)")}
        for case, text in bad.items():
            with self.subTest(case=case):
                self.assertTrue(ids(run_cp(GOOD_BODY, decisions=text), "M1"))

    def test_m1_an_unruled_id_is_a_default_line(self):
        plan = GOOD_BRIEF.replace("unruled: none", "> **What this is about:** the spoon.\n\n"
                                                   "unruled: E2 the spoon — default wood")
        self.assertTrue(ids(run_cp(GOOD_BODY, plan, decisions=GOOD_DECISIONS), "M1"))
        dec = GOOD_DECISIONS + "2026-10-18 | E2 DEFAULT | a wooden spoon | as recommended\n"
        body = GOOD_BODY.replace("| E1: the lid is glass |", "| E2: a wooden spoon | DEFAULT | "
                                 "accepted | as recommended |\n| E1: the lid is glass |")
        self.assertEqual(ids(run_cp(body, plan, decisions=dec), "M1"), [])

    def test_main_reads_the_decisions_file_beside_the_brief(self):
        with tempfile.TemporaryDirectory() as d:
            plan, body = Path(d) / "plan.md", Path(d) / "body.md"
            plan.write_text(GOOD_BRIEF, encoding="utf-8")
            body.write_text(GOOD_BODY, encoding="utf-8")
            (Path(d) / "decisions.md").write_text(GOOD_DECISIONS.replace("D1 DEFAULT",
                                                                         "D1 RULING"))
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(cp.main([str(plan), str(body)]), 1)
            self.assertIn("FAIL M1", out.getvalue())


class BaseSha(unittest.TestCase):
    def test_p7_a_base_reading_with_no_sha(self):
        good = GOOD_BODY.replace("| suite | `python3 -m pytest` | 12 passed |",
                                 "| suite against the base | `python3 -m pytest` at base 1a2b3c4 "
                                 "| 12 passed |")
        bad = good.replace(" at base 1a2b3c4", "").replace("12 passed", "same as base")
        self.assertRedGreen("P7", bad, good)

    def assertRedGreen(self, cid, bad, good):
        self.assertEqual(ids(run_cp(good), cid), [])
        self.assertTrue(ids(run_cp(bad), cid))


def ask_file(d, text, name="t-0001.md"):
    p = Path(d) / name
    p.write_text(text, encoding="utf-8")
    return str(p)


class FreezeUnruled(unittest.TestCase):
    def test_f10_an_unruled_line_needs_the_blockquote_above_it(self):
        good = GOOD_BRIEF.replace("unruled: none", "> **What this is about:** the spoon.\n\n"
                                                   "unruled: E2 the spoon — default wood")
        bad = GOOD_BRIEF.replace("unruled: none", "unruled: E2 the spoon — default wood")
        self.assertEqual(ids(run_fc(GOOD_BRIEF), "F10"), [])
        self.assertEqual(ids(run_fc(good), "F10"), [])
        self.assertTrue(ids(run_fc(bad), "F10"))

    def test_f10_an_unruled_line_with_no_id_or_two(self):
        for line in ("unruled: the spoon — default wood", "unruled: E2, E3 spoons — default wood"):
            with self.subTest(line=line):
                bad = GOOD_BRIEF.replace("unruled: none",
                                         "> **What this is about:** the spoon.\n\n" + line)
                self.assertTrue(ids(run_fc(bad), "F10"))

    def test_f10_on_a_ticket_reads_the_latest_plan_note(self):
        with tempfile.TemporaryDirectory() as d:
            t = Path(d) / "t-0001.md"
            t.write_text(TICKET, encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(fc.main([str(t)]), 0)
            self.assertIn("not applicable (trivial)", out.getvalue())
            t.write_text(TICKET.replace("> **What this is about:** the parser could also trim "
                                        "spaces; the note leaves that alone.\n", ""))
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(fc.main([str(t)]), 1)
            self.assertIn("FAIL F10", out.getvalue())


class Skeleton(unittest.TestCase):
    def skeleton(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(cp.main(["--skeleton"]), 0)
        return out.getvalue()

    def test_the_comments_carry_run_step_6(self):
        sk = norm_ws(self.skeleton())
        for phrase in ("No plan ending, no PR", "trivial", "brief's commit",
                       "`git log <last reviewed>..HEAD -- <source paths>`", "then `empty` or one "
                       "RULING row per entry", "A PR without this section is not opened",
                       "Every row reads without the ticket or the brief",
                       "an id defined elsewhere stands only beside a link to its record",
                       "taken on the PR head", "names the base commit's SHA"):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, sk)

    def test_comments_left_in_a_body_are_not_read(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            git(repo, "init", "-q")
            git(repo, "commit", "-q", "--allow-empty", "-m", "reviewed")
            body = GOOD_BODY.replace("REVIEWED", git(repo, "rev-parse", "--short", "HEAD")).replace(
                "5d6e7f8", git(repo, "rev-parse", "HEAD"))
            self.assertEqual(run_cp(body, repo=repo), [])
            body = body.replace("## Unreviewed since the last lane\n", "## Unreviewed since the "
                                "last lane\n\n<!-- `git log <last reviewed>..HEAD` -->\n")
            self.assertEqual(run_cp(body, repo=repo), [])


def norm_ws(s):
    return " ".join(s.split())


class RetroWorkflow(unittest.TestCase):
    JS = HERE / "retro-workflow.js"

    def test_the_replay_step_runs_before_the_critics(self):
        js = self.JS.read_text(encoding="utf-8")
        self.assertIn("label: 'replay:checkers'", js)
        self.assertLess(js.index("label: 'replay:checkers'"),
                        js.index("label: 'argue:lean critic'"))

    def test_it_parses_as_an_async_function_body(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node not installed")
        r = subprocess.run([node, "-e", "const fs=require('fs');const AsyncFunction=Object."
                            "getPrototypeOf(async function(){}).constructor;new AsyncFunction(fs."
                            "readFileSync(process.argv[1],'utf8').replace(/^export const meta/m,"
                            "'const meta'))", str(self.JS)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)


class ReplayRefusals(unittest.TestCase):
    """Each a shape the acceptance replay found refused although the method allowed it."""

    def test_p7_a_fenced_example_in_verification_is_not_a_reading(self):
        body = GOOD_BODY.replace("| suite | `python3 -m pytest` | 12 passed |\n",
                                 "| suite | `python3 -m pytest` | 12 passed |\n\nThe stand-in "
                                 "input:\n\n```\n- 2026-01-01 | W0 DEFAULT | base unchanged |\n"
                                 "```\n")
        self.assertEqual(ids(run_cp(body), "P7"), [])

    def test_p7_a_lane_reading_whose_command_names_a_base_build(self):
        body = GOOD_BODY.replace("| suite | `python3 -m pytest` | 12 passed |",
                                 "| suite | `python3 -m pytest` | 12 passed |\n| lane 3a "
                                 "adversarial | attacks on the gate (base / mutant builds) | "
                                 "12/12 |")
        self.assertEqual(ids(run_cp(body), "P7"), [])
        bad = body.replace("| 12/12 |", "| same as base |")
        self.assertTrue(ids(run_cp(bad), "P7"), "a result that reads against the base")

    def test_m1_a_heading_and_a_prose_line_are_not_entries(self):
        dec = ("# t-0001 decisions\n\n`<date> | <id> RULING|DEFAULT | <decision> | <why>`, one "
               "per line, mirroring §9.\n\n" + GOOD_DECISIONS)
        self.assertEqual(ids(run_cp(GOOD_BODY, decisions=dec), "M1"), [])
        bad = dec + "2026-10-19 | D1, D2 (DEFAULT accepted) | both | as one\n"
        self.assertTrue(ids(run_cp(GOOD_BODY, decisions=bad), "M1"), "a dated line is read")

    def test_m1_a_stop_row_is_not_a_decision(self):
        plan = GOOD_BRIEF.replace(
            "| D1 | 2026-10-18 | default |",
            "| W3-Q1 | 2026-10-18 | ruled in A3 | §2 | — | RULING stop, review round 1 |\n"
            "| W3-Q2 | 2026-10-18 | pending | §2 | — | RULING stop |\n"
            "| D1 | 2026-10-18 | default |")
        self.assertNotEqual(plan, GOOD_BRIEF)
        self.assertEqual(ids(run_cp(GOOD_BODY, plan, decisions=GOOD_DECISIONS), "M1"), [])


# ---- round 10: asks keyed and answered in one form (D1), the plan precedes the code (D2), the go
# never answers a RULING (D4), empty inputs (D6), ranges with markup (D7), known limits (D10),
# no bytecode (D12), plan-time decisions at the freeze (D14), the v0.8 replay (D19) ------------


def commit(repo, subject, when, files=None, allow_empty=False):
    for name, text in (files or {}).items():
        f = Path(repo) / name
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text, encoding="utf-8")
    env = dict(GIT_ENV, GIT_AUTHOR_DATE=when, GIT_COMMITTER_DATE=when)
    subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True, env=env)
    subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", subject]
                   + (["--allow-empty"] if allow_empty else []), check=True, env=env)


def main_out(mod, argv):
    with contextlib.redirect_stdout(io.StringIO()) as out:
        code = mod.main(argv)
    return code, out.getvalue()


PLAN_ENDING_TICKET = TICKET.replace(
    "Awaiting go.\n\n> **What this is about:** the parser could also trim spaces;",
    "Awaiting go.\n\n## Ask 2026-01-03 · plan-ending\n\n> **What this is about:** the parser "
    "could also trim spaces;")


class PlanEndingAsk(unittest.TestCase):
    """The house rules now put the `unruled:` line in the plan-ending ask after `## Plan`."""

    def test_p4_and_f10_read_the_unruled_line_in_the_plan_ending_ask(self):
        self.assertNotEqual(PLAN_ENDING_TICKET, TICKET)
        self.assertEqual(run_cp(TRIVIAL_SHAPES["default only, follow-up"], PLAN_ENDING_TICKET), [])
        with tempfile.TemporaryDirectory() as d:
            code, out = main_out(fc, [ask_file(d, PLAN_ENDING_TICKET)])
            self.assertEqual(code, 0, out)
            code, out = main_out(fc, [ask_file(d, PLAN_ENDING_TICKET.replace(
                "unruled: U1 trimming spaces", "unruled: trimming spaces"))])
            self.assertEqual(code, 1, out)


class PlanBeforeCode(unittest.TestCase):
    def repo(self, d, with_plan):
        repo = Path(d) / "repo"
        repo.mkdir()
        git(repo, "init", "-q")
        git(repo, "symbolic-ref", "HEAD", "refs/heads/main")
        commit(repo, "docs: base", "2026-01-01T09:00:00", {"README.md": "the parser\n"})
        commit(repo, "chore(beans): t-0001 filed", "2026-01-01T09:01:00",
               {".beans/t-0001.md": TICKET.split("## Plan")[0]})
        if with_plan:
            commit(repo, "plan(t-0001): the last field — trivial", "2026-01-01T09:02:00",
                   {".beans/t-0001.md": TICKET})
        git(repo, "checkout", "-q", "-b", "work")
        commit(repo, "fix: the parser keeps the last field", "2026-01-01T09:05:00",
               {"src/parser.py": "def split_line(s):\n    return s.split(',')\n"})
        return repo

    def test_p9_a_code_commit_with_no_plan_commit_among_its_ancestors(self):
        body = TRIVIAL_SHAPES["default only, follow-up"]
        for with_plan in (False, True):
            for base in (["--base", "main"], []):
                with self.subTest(with_plan=with_plan, base=base), \
                        tempfile.TemporaryDirectory() as d:
                    repo = self.repo(d, with_plan)
                    t, b = ask_file(d, TICKET), ask_file(d, body, "body.md")
                    _code, out = main_out(cp, [t, b, "--repo", str(repo), "--head", "work", *base])
                    self.assertEqual("FAIL P9 " in out, not with_plan, out)

    def test_p9_a_docs_only_branch_is_not_applicable(self):
        with tempfile.TemporaryDirectory() as d:
            repo = self.repo(d, False)
            git(repo, "reset", "-q", "--hard", "main")
            commit(repo, "docs: a note", "2026-01-01T09:06:00", {"docs/note.md": "x\n"})
            notes = []
            fails = cp.check(TICKET, TRIVIAL_SHAPES["default only, follow-up"], repo=repo,
                             head="work", base="main", ticket="t-0001", notes=notes)
        self.assertEqual(ids(fails, "P9"), [])
        self.assertTrue([n for n in notes if n.startswith("P9 not applicable")], notes)


class RulingNotUnruled(unittest.TestCase):
    SPOON = "> **What this is about:** the spoon.\n\n"

    def test_f10_an_unruled_id_labelled_ruling(self):
        inline = GOOD_BRIEF.replace("unruled: none",
                                    self.SPOON + "unruled: Q2 the spoon — RULING, recommend wood")
        default = GOOD_BRIEF.replace("unruled: none",
                                     self.SPOON + "unruled: E2 the spoon — default wood")
        self.assertTrue(ids(run_fc(inline), "F10"), "labelled RULING on its own line")
        self.assertEqual(ids(run_fc(default, decisions=GOOD_DECISIONS + "2026-10-18 | E2 DEFAULT | "
                                    "wood | as recommended\n"), "F10"), [])
        self.assertTrue(ids(run_fc(default, decisions=GOOD_DECISIONS + "2026-10-18 | E2 RULING | "
                                   "wood | the human: \"wood\"\n"), "F10"), "decisions.md: RULING")
        ticket = TICKET.replace("## Plan (2026-01-01)", "## Ask 2026-01-01 · interview\n\n"
                                "> **What this is about:** spaces.\n\n**U1** trim spaces too? "
                                "RULING, recommend no.\n\n## Plan (2026-01-01)")
        with tempfile.TemporaryDirectory() as d:
            code, out = main_out(fc, [ask_file(d, ticket)])
        self.assertEqual(code, 1, out)
        self.assertIn("U1 is a RULING", out)

    def test_m1_a_ruling_answered_only_by_the_run_invocation(self):
        for why in ('owner: "/shawarma run soup-1"', "/shawarma run soup-1",
                    "the owner: `/shawarma run soup-1`"):
            with self.subTest(why=why):
                dec = GOOD_DECISIONS.replace("one reason to go red", why)
                self.assertTrue(ids(run_cp(GOOD_BODY, decisions=dec), "M1"))
        for why in ('owner: "/shawarma run soup-1" and "drop it"', "accepted by the go"):
            with self.subTest(why=why):
                dec = GOOD_DECISIONS.replace("one reason to go red", why)
                self.assertEqual(ids(run_cp(GOOD_BODY, decisions=dec), "M1"), [])
        dec = GOOD_DECISIONS.replace("you can see the soup", "accepted by the go (`/shawarma run "
                                     "soup-1`)")
        self.assertEqual(ids(run_cp(GOOD_BODY, decisions=dec), "M1"), [], "a DEFAULT may")


class EmptyInputs(unittest.TestCase):
    def test_p6_a_tests_commit_with_no_python_test_file_reads_not_run(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            git(repo, "init", "-q")
            commit(repo, "test: the lid", "2026-01-01T09:00:00",
                   {"tests/pot.test.js": "test('lid', () => {})\n"})
            sha = git(repo, "rev-parse", "HEAD")
            notes = []
            fails = run_cp(GOOD_BODY.replace("REVIEWED", sha), repo=repo, tests_commit=sha,
                           notes=notes)
        self.assertEqual(ids(fails, "P6"), [])
        self.assertTrue([n for n in notes if n.startswith("P6 NOT RUN")], notes)


class RangesWithMarkup(unittest.TestCase):
    def test_markup_on_each_end_expands_fully(self):
        cases = {"**D1**–**D29**": [f"D{k}" for k in range(1, 30)],
                 "`D1`–`D3`": ["D1", "D2", "D3"],
                 "**D1**-**D3**": ["D1", "D2", "D3"],
                 "**D1** – **D3**": ["D1", "D2", "D3"],
                 "`W3-D1`..`D3`": ["W3-D1", "W3-D2", "W3-D3"],
                 "**D1–D29**": [f"D{k}" for k in range(1, 30)]}
        for text, want in cases.items():
            with self.subTest(text=text):
                self.assertEqual(cp.ids_in(f"rows {text} ruled"), set(want))

    def test_near_misses_stay_two_ids(self):
        cases = {"**D1**–D3": {"D1", "D3"}, "**D1**–**Q3**": {"D1", "Q3"},
                 "`D1`–**D3**": {"D1", "D3"}, "D1**–**D3": {"D1", "D3"},
                 "**D1**–`D3`": {"D1", "D3"}}
        for text, want in cases.items():
            with self.subTest(text=text):
                self.assertEqual(cp.ids_in(f"rows {text} ruled"), want)

    def test_m1_reads_a_bold_range_in_the_authority_clause(self):
        plan = GOOD_BRIEF.replace("authority: the ticket's ruling Q1 (lid first)",
                                  "authority: the ticket's rulings **Q1**–**Q3**")
        dec = GOOD_DECISIONS + ("2026-10-17 | Q2 RULING | B · a deep pot · reco B | the human: "
                                "\"deep\"\n")
        self.assertNotEqual(plan, GOOD_BRIEF)
        self.assertEqual(ids(run_cp(GOOD_BODY, plan, decisions=dec), "M1"), [])


class KnownLimits(unittest.TestCase):
    def test_p10_a_known_limit_names_a_ticket(self):
        at = "## Verification"
        bad = {"heading": "## Known limit\n\nThe lid rattles at a full boil.\n\n",
               "line": "**Known limit:** the lid rattles at a full boil.\n\n"}
        good = {"heading": "## Known limit\n\nThe lid rattles at a full boil (`soup-4`).\n\n",
                "line": "**Known limit:** the lid rattles at a full boil, soup-4.\n\n",
                "issue": "Known limit: the lid rattles, #12.\n\n",
                "none": "No known limit.\n\n"}
        for case, text in bad.items():
            with self.subTest(bad=case):
                self.assertTrue(ids(run_cp(GOOD_BODY.replace(at, text + at)), "P10"))
        for case, text in good.items():
            with self.subTest(good=case):
                self.assertEqual(ids(run_cp(GOOD_BODY.replace(at, text + at)), "P10"), [])


class NoBytecode(unittest.TestCase):
    def test_running_the_checkers_writes_no_pycache(self):
        with tempfile.TemporaryDirectory() as d:
            for name in ("check_pr.py", "freeze_check.py", "lanes.md"):
                shutil.copy(HERE / name, d)
            env = {k: v for k, v in os.environ.items() if k != "PYTHONDONTWRITEBYTECODE"}
            r = subprocess.run([sys.executable, "freeze_check.py", "--fields"], cwd=d, env=env,
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertFalse((Path(d) / "__pycache__").exists(), list(Path(d).iterdir()))


class PlanTimeDecisionsAtTheFreeze(unittest.TestCase):
    def test_f11_a_decision_dated_before_the_freeze_with_no_brief_record(self):
        self.assertEqual(ids(run_fc(GOOD_BRIEF, decisions=GOOD_DECISIONS), "F11"), [])
        line = "| Q2 RULING | a deeper pot | the human: \"deeper\"\n"
        self.assertTrue(ids(run_fc(GOOD_BRIEF, decisions=GOOD_DECISIONS + "2026-10-18 " + line),
                            "F11"))
        self.assertEqual(ids(run_fc(GOOD_BRIEF, decisions=GOOD_DECISIONS + "2026-10-19 " + line),
                             "F11"), [], "a run-time line, after the freeze")


# The v0.8.0 replay (round 10, D19): each record was allowed by the method it was written under
# and is refused by v0.9's checks. The current method does not allow any of them (the id on
# `unruled:`, the strict decisions.md line, the base SHA per row, the blockquote above a question,
# answers outside the ask all came with v0.9.0), so the scope narrows: the record's format is read
# from the brief's header (`skill 0.8.0`) or `--written-under 0.8` (a ticket names none), the
# younger check prints `not applicable (pre-v0.9 format)`, and a current record still FAILs.
V08_TICKET = TICKET.replace("> **What this is about:** the parser could also trim spaces; the note "
                            "leaves that alone.\n\nunruled: U1 trimming spaces — default not "
                            "folded", "unruled: trimming spaces as well — default not folded")
V08_BRIEF = GOOD_BRIEF.replace("planned 2026-10-18 at base", "planned 2026-10-18 (a model; skill "
                               "0.8.0) at base")


class ReplayV08(unittest.TestCase):
    def files(self, d, ticket, body):
        return ask_file(d, ticket), ask_file(d, body, "body.md")

    def test_f10_a_trivial_note_with_an_id_less_unruled_line(self):
        self.assertNotEqual(V08_TICKET, TICKET)
        with tempfile.TemporaryDirectory() as d:
            t = ask_file(d, V08_TICKET)
            code, out = main_out(fc, [t, "--written-under", "0.8"])
            self.assertEqual(code, 0, out)
            self.assertIn("F10 not applicable (pre-v0.9 format)", out)
            self.assertEqual(main_out(fc, [t])[0], 1, "a current record still FAILs")

    def test_p4_a_trivial_default_row_with_no_id(self):
        body = TRIVIAL_SHAPES["default only, follow-up"].replace("| U1: trim spaces |",
                                                                 "| Trim spaces too |")
        with tempfile.TemporaryDirectory() as d:
            t, b = self.files(d, V08_TICKET, body)
            code, out = main_out(cp, [t, b, "--written-under", "0.8"])
            self.assertEqual(code, 0, out)
            self.assertIn("P4 not applicable (pre-v0.9 format)", out)
            self.assertIn("FAIL P4 ", main_out(cp, [t, b])[1])

    def test_p4_a_linter_code_in_an_id_less_row(self):
        row = "| Delete the E501 per-file ignore for the parser | DEFAULT | deleted | unused |"
        body = TRIVIAL_SHAPES["default only, follow-up"].replace(
            "| U1: trim spaces | DEFAULT | not folded | beyond the ticket |", row)
        with tempfile.TemporaryDirectory() as d:
            t, b = self.files(d, V08_TICKET, body)
            code, out = main_out(cp, [t, b, "--written-under", "0.8"])
            self.assertEqual(code, 0, out)
        control = body.replace(row, "| **U1** delete the E501 per-file ignore for the parser | "
                               "DEFAULT | deleted | unused |")
        self.assertEqual(ids(run_cp(control, TICKET), "P4"), [], "a bold lead id still reads")

    def test_m1_free_labels_in_a_v08_decisions_file(self):
        dec = ("2026-10-18 | D1 (constants) | a glass lid | as briefed\n"
               "2026-10-18 | A3, D1 (DEFAULT accepted) | both accepted | the go\n")
        notes = []
        self.assertEqual(ids(run_cp(GOOD_BODY, V08_BRIEF, decisions=dec, notes=notes), "M1"), [])
        self.assertIn("M1 not applicable (pre-v0.9 format)", notes)
        self.assertTrue(ids(run_cp(GOOD_BODY, decisions=dec), "M1"), "a current brief FAILs")
        self.assertEqual(ids(run_fc(V08_BRIEF, decisions=dec), "F11"), [])

    def test_p7_a_base_row_whose_sha_sits_in_the_row_above(self):
        body = GOOD_BODY.replace("| suite | `python3 -m pytest` | 12 passed |",
                                 "| suite against the base | `python3 -m pytest` on `5d6e7f8` and "
                                 "on base `1a2b3c4` | 12 passed |\n| lint against the base | "
                                 "`ruff check .` | the same 3 findings on head and base |")
        self.assertEqual(ids(run_cp(body, V08_BRIEF), "P7"), [])
        self.assertTrue(ids(run_cp(body), "P7"), "a current brief FAILs")



# ---- 0.10.2, script fixes between retros: a crash reads as a crash, a missing section is F1
# and nothing else breaks, an unbalanced quote is a P5 failure, F10 reads the ticket at the
# freeze, the replay prompt states the limits its check enforces, no proposer has a quota ------

def main_out_err(mod, argv):
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        code, out = main_out(mod, argv)
    return code, out, err.getvalue()


class MissingSections(unittest.TestCase):
    def test_f1_each_missing_section_fails_and_nothing_crashes(self):
        for n in range(1, 10):
            with self.subTest(section=n):
                bad = re.sub(rf"(?m)^## {n}\. ", "## ", GOOD_BRIEF, count=1)
                self.assertNotEqual(bad, GOOD_BRIEF)
                fails = run_fc(bad)  # §3, §5 and §7 raised a TypeError here
                self.assertTrue(any(f.startswith(f"FAIL F1 §{n}:") for f in fails), fails)


class Crashes(unittest.TestCase):
    """A checker that crashes prints no verdict and exits 3, never FAIL's exit code."""

    def boom(*_a, **_k):
        raise RuntimeError("the pot boiled over — and the lid flew")

    def test_a_crash_exits_3_with_no_verdict(self):
        from unittest import mock
        with tempfile.TemporaryDirectory() as d:
            plan, body = Path(d) / "plan.md", Path(d) / "body.md"
            plan.write_text(GOOD_BRIEF, encoding="utf-8")
            body.write_text(GOOD_BODY, encoding="utf-8")
            for mod, name, argv in ((fc, "check", [str(plan)]),
                                    (cp, "check", [str(plan), str(body)])):
                with self.subTest(script=mod.__name__, entry=name), \
                        mock.patch.object(mod, name, Crashes.boom):
                    code, out, err = main_out_err(mod, argv)
                    self.assertEqual(code, 3, out)
                    self.assertIn("CRASH", out)
                    self.assertIn("RuntimeError", out)
                    self.assertNotIn("PASS", out)
                    self.assertFalse([x for x in out.splitlines() if x.startswith("FAIL")], out)
                    self.assertIn("Traceback", err)
                    crash = [x for x in out.splitlines() if x.startswith("CRASH")]
                    self.assertTrue(crash and crash[0].isascii(), crash)

    def test_a_tool_or_file_that_cannot_be_opened_is_unusable_not_a_crash(self):
        from unittest import mock
        with tempfile.TemporaryDirectory() as d:
            plan = Path(d) / "plan.md"
            plan.write_text(GOOD_BRIEF, encoding="utf-8")
            with mock.patch.object(fc, "check", side_effect=FileNotFoundError(2, "no git")):
                code, out, _err = main_out_err(fc, [str(plan)])
        self.assertEqual(code, 2, out)
        self.assertTrue(out.startswith("UNUSABLE: FileNotFoundError"), out)

    def test_freeze_check_without_check_pr_beside_it_is_a_crash(self):
        with tempfile.TemporaryDirectory() as d:
            for name in ("freeze_check.py", "lanes.md"):
                shutil.copy(HERE / name, Path(d) / name)
            plan = Path(d) / "plan.md"
            plan.write_text(GOOD_BRIEF, encoding="utf-8")
            r = subprocess.run([sys.executable, "-B", str(Path(d) / "freeze_check.py"), str(plan)],
                               capture_output=True, text=True)
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        self.assertTrue(r.stdout.startswith("CRASH ") and r.stdout.isascii(), r.stdout)

    def test_output_survives_a_console_that_is_not_utf8(self):
        env = dict(os.environ, PYTHONIOENCODING="ascii")
        with tempfile.TemporaryDirectory() as d:
            ticket = ask_file(d, TICKET)  # trivial mode prints a line holding an en dash
            body = ask_file(d, TRIVIAL_SHAPES["default only, follow-up"].replace(
                "| U1: trim spaces |", "| U1: trim spaces — or not |"), "body.md")
            for script, argv in (("freeze_check.py", [ticket]),
                                 ("check_pr.py", [ticket, body])):
                with self.subTest(script=script):
                    r = subprocess.run([sys.executable, "-B", str(HERE / script), *argv],
                                       capture_output=True, text=True, env=env)
                    self.assertIn(r.returncode, (0, 1), r.stdout + r.stderr)
                    self.assertRegex(r.stdout, r"(?m)^(PASS|FAIL \(\d+\))$")
                    self.assertNotIn("Traceback", r.stderr)

    def test_the_docstrings_name_the_crash_exit_code(self):
        for mod in (fc, cp):
            self.assertRegex(norm_ws(mod.__doc__), r"3 when the checker itself crashes")


class UnbalancedQuote(unittest.TestCase):
    def test_p5_a_pasted_command_that_does_not_parse_fails_without_a_crash(self):
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
            bad = body.replace("$ git log", '$ git log --format="%h')
            from unittest import mock
            with mock.patch.object(cp, "git", wraps=cp.git) as spy:
                fails = ids(run_cp(bad, repo=repo), "P5")  # shlex raised a ValueError here
            self.assertEqual(len(fails), 1, fails)
            self.assertIn("does not parse", fails[0])
            reruns = [c for c in spy.call_args_list if c.args[1:3] == ("log", "--no-ext-diff")]
            self.assertFalse(reruns, "the command was re-run")

    # with no ticket named, P9 reads NOT RUN: P5 stands alone
    NO_TICKET = GOOD_BRIEF.replace("Ticket `soup-1` · ", "")

    def repo_and_body(self, d):
        repo = Path(d)
        git(repo, "init", "-q")
        (repo / "src").mkdir()
        (repo / "src" / "pot.py").write_text("x = 1\n")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "reviewed")
        body = GOOD_BODY.replace("REVIEWED", git(repo, "rev-parse", "--short", "HEAD"))
        return repo, body.replace("5d6e7f8", git(repo, "rev-parse", "HEAD"))

    def test_p5_a_head_holding_a_backslash_fails_p5(self):
        with tempfile.TemporaryDirectory() as d:
            repo, body = self.repo_and_body(d)
            fails = ids(run_cp(body, repo=repo, head="no\\1such"), "P5")  # a regex template once
            self.assertTrue(fails and "re-run failed" in fails[0], fails)

    def test_p5_a_nul_byte_in_the_pasted_command_is_refused_and_not_re_run(self):
        from unittest import mock
        with tempfile.TemporaryDirectory() as d:
            repo, body = self.repo_and_body(d)
            bad = body.replace("$ git log", "$ git log --grep=a\0b")
            with mock.patch.object(cp, "git", wraps=cp.git) as spy:
                fails = ids(run_cp(bad, repo=repo), "P5")
            self.assertEqual(len(fails), 1, fails)
            self.assertIn("NUL byte", fails[0])
            reruns = [c for c in spy.call_args_list if c.args[1:3] == ("log", "--no-ext-diff")]
            self.assertFalse(reruns, "the command was re-run")

    def test_p5_a_git_that_cannot_run_or_be_read_is_no_verdict_on_the_record(self):
        from unittest import mock
        self.assertNotEqual(self.NO_TICKET, GOOD_BRIEF)
        with tempfile.TemporaryDirectory() as d:
            repo, body = self.repo_and_body(d)
            plan, bodyf = repo / "plan.md", repo / "body.md"
            plan.write_text(self.NO_TICKET, encoding="utf-8")
            bodyf.write_text(body, encoding="utf-8")
            argv = [str(plan), str(bodyf), "--repo", str(repo)]
            self.assertEqual(main_out(cp, argv)[0], 0, "the body passes when git runs")
            with mock.patch.object(cp.subprocess, "run", side_effect=FileNotFoundError(2, "git")):
                code, out, _err = main_out_err(cp, argv)
            self.assertEqual(code, 2, out)  # a missing tool is unusable input
            self.assertTrue(out.startswith("UNUSABLE"), out)
            self.assertNotIn("FAIL", out)
            undecodable = UnicodeDecodeError("utf-8", b"\xe9", 0, 1, "invalid continuation byte")
            with mock.patch.object(cp, "git", side_effect=undecodable):
                code, out, _err = main_out_err(cp, argv)
            self.assertEqual(code, 3, out)  # output the script cannot read: no verdict either
            self.assertNotIn("FAIL", out)

    def test_git_never_reads_the_checkers_own_input(self):
        from unittest import mock
        with tempfile.TemporaryDirectory() as d:
            repo, _body = self.repo_and_body(d)
            with mock.patch.object(cp.subprocess, "run", wraps=cp.subprocess.run) as spy:
                cp.git(repo, "status", "--short")
            self.assertIs(spy.call_args.kwargs.get("stdin"), subprocess.DEVNULL)


class FreezeReadsTheTicket(unittest.TestCase):
    """House rules may put the plan ending's `unruled:` lines on the ticket: --ticket reads them."""
    NO_LINE = GOOD_BRIEF.replace("unruled: none\n", "")
    AS_RULING = PLAN_ENDING_TICKET.replace("unruled: U1 trimming spaces — default not folded",
                                           "unruled: U1 trimming spaces — RULING, recommend no")

    def freeze(self, brief, ticket=None, decisions=None):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "plan.md"
            p.write_text(brief, encoding="utf-8")
            if decisions is not None:
                (Path(d) / "decisions.md").write_text(decisions, encoding="utf-8")
            argv = [str(p)] + (["--ticket", ask_file(d, ticket)] if ticket is not None else [])
            return main_out(fc, argv)

    def test_the_fixtures_differ(self):
        self.assertNotEqual(self.NO_LINE, GOOD_BRIEF)
        self.assertNotEqual(self.AS_RULING, PLAN_ENDING_TICKET)

    def test_f10_a_ruling_on_the_tickets_unruled_line_fails_the_freeze(self):
        code, out = self.freeze(self.NO_LINE, self.AS_RULING)
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL F10 ticket line", out)
        self.assertIn("U1 is a RULING", out)

    def test_f10_reads_the_brief_and_the_ticket(self):
        code, out = self.freeze(GOOD_BRIEF, self.AS_RULING)
        self.assertEqual(code, 1, out)
        self.assertIn("U1 is a RULING", out)

    def test_a_ticket_whose_unruled_lines_are_defaults_passes(self):
        code, out = self.freeze(self.NO_LINE, PLAN_ENDING_TICKET)
        self.assertEqual(code, 0, out)
        self.assertNotIn("F10 not checked", out)

    def test_decisions_md_rulings_reach_the_tickets_ids(self):
        dec = GOOD_DECISIONS + '2026-10-18 | U1 RULING | not folded | the human: "no"\n'
        code, out = self.freeze(self.NO_LINE, PLAN_ENDING_TICKET, decisions=dec)
        self.assertIn("U1 is a RULING", out)
        self.assertEqual(code, 1, out)

    def test_no_unruled_line_and_no_ticket_says_f10_was_not_checked(self):
        code, out = self.freeze(self.NO_LINE)
        self.assertEqual(code, 0, out)
        self.assertIn("F10 not checked", out)
        self.assertIn("--ticket", out)
        self.assertNotIn("F10 not checked", self.freeze(GOOD_BRIEF)[1])

    def test_a_ticket_with_no_plan_note_is_unusable(self):
        code, out = self.freeze(self.NO_LINE, "# t-0001\n\nNo plan note yet.\n")
        self.assertEqual(code, 2, out)
        self.assertIn("UNUSABLE", out)

    def test_the_usage_line_names_the_flag(self):
        self.assertIn("[--ticket FILE]", fc.__doc__.split("\n\n")[1])

    def test_with_the_flag_and_no_unruled_line_anywhere_f10_says_not_checked(self):
        bare = PLAN_ENDING_TICKET.replace("unruled: U1 trimming spaces — default not folded\n", "")
        self.assertNotEqual(bare, PLAN_ENDING_TICKET)
        code, out = self.freeze(self.NO_LINE, bare)
        self.assertEqual(code, 0, out)
        self.assertIn("F10 not checked", out)
        lines = bare.splitlines()
        first = max(k for k, line in enumerate(lines) if line.startswith("## Plan")) + 1
        self.assertIn(f"(ticket lines {first}-{len(lines)})", out)

    def test_f11_knows_an_unruled_id_on_the_ticket(self):
        dec = GOOD_DECISIONS + "2026-10-17 | U1 DEFAULT | not folded | as recommended\n"
        code, out = self.freeze(self.NO_LINE, PLAN_ENDING_TICKET, decisions=dec)
        self.assertNotIn("F11", out)
        self.assertEqual(code, 0, out)
        code, out = self.freeze(self.NO_LINE, decisions=dec)  # without the ticket F11 cannot know
        self.assertIn("FAIL F11", out)

    def test_a_ruling_in_the_tickets_ask_reaches_the_briefs_unruled_line(self):
        brief = GOOD_BRIEF.replace("unruled: none", "> **What this is about:** the spoon.\n\n"
                                   "unruled: U1 the spoon — default wood")
        asked = PLAN_ENDING_TICKET.replace(
            "## Plan (2026-01-01)", "## Ask 2026-01-01 · interview\n\n> **What this is about:** "
            "spaces.\n\n**U1** trim spaces too? RULING, recommend no.\n\n## Plan (2026-01-01)")
        self.assertNotEqual(asked, PLAN_ENDING_TICKET)
        self.assertEqual(self.freeze(brief)[0], 0, "alone, the brief's line reads as a default")
        code, out = self.freeze(brief, asked)
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r"(?m)^FAIL F10 line \d+: U1 is a RULING")

    def test_the_briefs_own_unruled_lines_are_still_read_with_the_flag(self):
        brief = GOOD_BRIEF.replace("unruled: none", "unruled: E2 the spoon — default wood")
        code, out = self.freeze(brief, PLAN_ENDING_TICKET)
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r"(?m)^FAIL F10 line \d+: unruled E2 has no")

    def test_an_unreadable_ticket_file_is_unusable(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "plan.md"
            p.write_text(GOOD_BRIEF, encoding="utf-8")
            code, out = main_out(fc, [str(p), "--ticket", str(Path(d) / "missing.md")])
        self.assertEqual(code, 2, out)
        self.assertIn("UNUSABLE", out)

    def test_the_flag_goes_with_a_brief_not_with_a_ticket(self):
        with tempfile.TemporaryDirectory() as d:
            t = ask_file(d, TICKET)
            code, out, err = main_out_err(fc, [t, "--ticket", t])
        self.assertEqual(code, 2, out)
        self.assertIn("--ticket", err)
        with tempfile.TemporaryDirectory() as d:
            neither = ask_file(d, "# notes\n\nNothing planned here.\n", "notes.md")
            code, out, _err = main_out_err(fc, [neither, "--ticket", ask_file(d, TICKET)])
        self.assertEqual(code, 2, out)
        self.assertIn("UNUSABLE", out)


class RetroWorkflowLimits(unittest.TestCase):
    JS = HERE / "retro-workflow.js"

    def js(self):
        return self.JS.read_text(encoding="utf-8")

    def test_the_replay_prompt_states_every_limit_its_check_enforces(self):
        js = self.js()
        prompt = norm_ws(js[js.index("You replay the method's own checkers"):
                            js.index("label: 'replay:checkers'")])
        for limit in ("In a host-only run", "at most 300 characters", "no less-than sign",
                      "Nothing you return, the pasted commands included",
                      "a URL, a double slash, a percent sign or a backslash-u escape",
                      "With any extra repo given, a candidate carries the rule id and the method "
                      "line alone", "Set report_path to the word none",
                      "recorded with the verdict \\`CRASH\\` alone", "is no refusal"):
            self.assertIn(limit, prompt)
        # the limits the code enforces, so the two cannot drift apart unseen
        self.assertIn("x.length <= 300 && !x.includes('<')", js)
        self.assertIn(r"/%[0-9a-f]{2}|\\u[0-9a-f]{4}|https?:|\/\//", js)
        self.assertIn("/^(PASS|CRASH|((P|F|A|M)", js)

    def test_no_proposer_has_a_quota(self):
        js = self.js()
        lenses = [line for line in js.splitlines() if re.match(r"\s+(lean|rigor): '", line)]
        self.assertEqual(len(lenses), 2)
        for line in lenses:
            self.assertIsNone(re.search(r"\d", line), "a lens names a number")
            self.assertIn("Proposing nothing is a valid result.", line)

    def test_check_replay_keeps_plain_words_and_drops_brackets_and_long_fields(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node not installed")
        probe = r"""
const fs = require('fs');
const src = fs.readFileSync(process.argv[1], 'utf8');
const a = src.indexOf('const checkReplay = r => {'), z = src.indexOf('\nconst replayChecked');
if (a < 0 || z < 0) { console.log('checkReplay not found'); process.exit(2) }
const make = new Function('A', src.slice(a, z) + '\nreturn checkReplay');
const run = (repos, c) => {
  const out = make({ repos, outDir: '/out' })({ records: [{ repo: 'host', record: '#12',
    checker: 'check_pr', verdict: 'P7' }], candidates: [c], skipped_repos: [] });
  console.log(out.fail ? 'DROPPED: ' + out.fail : 'kept ' + out.candidates.length);
};
const cand = extra => Object.assign({ repo: 'host', record: '#12', refusal: 'P7',
  why_allowed: 'run.md:10 says a base reading names its commit',
  generic_fixture: 'a Verification row whose reading names the base with no commit' }, extra);
run([], cand({}));
run([], cand({ generic_fixture: 'a row holding <id>' }));
run([], cand({ why_allowed: 'x'.repeat(301) }));
run([], cand({ generic_fixture: 'a path such as /x%0A' }));
run([], cand({ refusal: 'CRASH' }));
run(['/other/repo-two'], cand({}));
run(['/other/repo-two'],
  cand({ refusal: 'P7', why_allowed: 'run.md:10', generic_fixture: undefined }));
run(['/other/repo-two'],
  cand({ refusal: 'CRASH', why_allowed: 'none', generic_fixture: undefined }));
run(['/other/repo-two'],
  cand({ refusal: 'P7', why_allowed: 'none', generic_fixture: undefined }));
const crashed = make({ repos: [], outDir: '/out' })({ records: [{ repo: 'host', record: '#12',
  checker: 'freeze_check', verdict: 'CRASH' }], candidates: [], skipped_repos: [] });
console.log(crashed.fail ? 'DROPPED: ' + crashed.fail
  : 'kept verdict ' + crashed.records[0].verdict);
"""
        r = subprocess.run([node, "-e", probe, str(self.JS)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        over = "DROPPED: a host candidate field is over 300 chars or holds <"
        free = ("DROPPED: a candidate carries free text where rule ids and a method line are "
                "required")
        self.assertEqual(r.stdout.splitlines(),
                         ["kept 1", over, over, "DROPPED: a URL, // or escape sequence appears",
                          "kept 1", free, "kept 1", "kept 1", free, "kept verdict CRASH"])

    def test_the_script_runs_end_to_end_with_fake_agents(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node not installed")
        harness = r"""
const fs = require('fs');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const src = fs.readFileSync(process.argv[1], 'utf8').replace(/^export const meta/m, 'const meta');
const wf = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', src);
const ARGS = { repo: '/h/repo/', skillDir: '/h//skill/', lessons: '/h/repo/docs/lessons.md',
  since: '2026-10-01', outDir: '/h/repo/docs/retros/2026-11-11-x/',
  scratchDir: '/private/tmp/retro.abc123/', repos: ['/other/repo-two/'] };
const PROP = n => ({ title: 'p' + n, problem: 'x', evidence_refs: ['#1'], change: 'y',
  where: 'run.md', cost: '0' });
const CPROP = n => ({ id: 'P' + n, title: 'p' + n, problem: 'x', evidence: ['#1'],
  proposed_wording: 'w', where: 'run.md', expected_benefit: 'b', cost: '0' });
const DISP = ['t-0001', '#1', 't-0009'].map(id => ({ id, disposition: 'audited', where: 'e' }));
const REC = verdict => ({ records: [{ repo: 'host', record: '#1', checker: 'freeze_check',
  command: 'x', verdict }], candidates: [], skipped_repos: [], report_path: 'none' });
const NONE = { propositions: [] };
const EMPTY = { propositions: [], dispositions: DISP, report_path: 'x' };
const FOUND = { findings: [], report_path: 'x' };
const AUDIT = { corrections: [], extra_observations: [], report_path: 'x' };
async function scenario(name, over) {
  const calls = [], prompts = {};
  const canned = Object.assign({
    'inputs:generate': { runs: [{ id: 't-0001', source: 'git log' }, { id: '#1', source: 'gh' }],
      items: [{ id: 't-0009' }], extra_repos: [], report_path: 'x' },
    'evidence:older runs': AUDIT, 'evidence:newer runs': AUDIT, 'replay:checkers': REC('PASS'),
    'research:orchestration': FOUND, 'research:spec-and-tests': FOUND,
    'research:gates-and-review': FOUND,
    'propose:lean': { propositions: [PROP(1)], deletions: [] },
    'propose:rigor': { propositions: [PROP(2)] },
    'consolidate': { propositions: [CPROP(1), CPROP(2)], dispositions: DISP, report_path: 'x' },
    'test:replay': { results: [] }, 'argue:lean critic': { critiques: [] },
    'argue:rigor critic': { critiques: [] }, 'argue:cold reader': { critiques: [] },
    'verify:citations': { checks: [] },
  }, over || {});
  const agent = async (prompt, opts) => {
    calls.push(opts.label);
    prompts[opts.label] = prompt;
    return canned[opts.label] === undefined ? null : canned[opts.label];
  };
  const parallel = async thunks => Promise.all(thunks.map(async t => {
    try { return await t() } catch (e) { return null }
  }));
  const noPipeline = async () => { throw new Error('pipeline not used') };
  const out = await wf(ARGS, agent, parallel, noPipeline, () => {}, () => {});
  const at = calls.indexOf('consolidate');
  console.log([name, out.stopped ? 'STOPPED ' + out.stopped : 'returned',
    'after-consolidate=' + (at < 0 ? -1 : calls.length - at - 1),
    'no_propositions=' + (out.no_propositions === true),
    'counts=' + JSON.stringify(out.proposal_counts || null),
    'double-slash=' + Object.values(prompts).some(p => /[^:]\/\//.test(p)),
    'keys=' + (out.no_propositions ? Object.keys(out).sort().join(',') : '-')].join(' | '));
}
(async () => {
  await scenario('normal');
  await scenario('both empty',
    { 'propose:lean': NONE, 'propose:rigor': NONE, 'consolidate': EMPTY });
  await scenario('a proposer died', { 'propose:rigor': undefined });
  await scenario('a checker crashed', { 'replay:checkers': REC('CRASH') });
  await scenario('propositions lost', { 'consolidate': EMPTY });
  await scenario('no proposition list',
    { 'consolidate': { dispositions: DISP, report_path: 'x' } });
  await scenario('deletions lost', { 'propose:lean': { propositions: [], deletions: ['a rule'] },
    'propose:rigor': NONE, 'consolidate': EMPTY });
})().catch(e => { console.log('THREW ' + e.name + ': ' + e.message); process.exit(1) });
"""
        r = subprocess.run([node, "-e", harness, str(self.JS)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        got = [line.split(" | ") for line in r.stdout.splitlines()]
        keys = ("checkerReplay,consolidated,evidence,inputs,no_propositions,outDir,proposal_counts,"
                "research_counts,research_not_found")
        one = 'counts={"lean":1,"rigor":1,"deletions":0}'
        self.assertEqual(got, [
            ["normal", "returned", "after-consolidate=5", "no_propositions=false", one,
             "double-slash=false", "keys=-"],
            ["both empty", "returned", "after-consolidate=0", "no_propositions=true",
             'counts={"lean":0,"rigor":0,"deletions":0}', "double-slash=false", "keys=" + keys],
            ["a proposer died", "STOPPED a proposer returned nothing", "after-consolidate=-1",
             "no_propositions=false", "counts=null", "double-slash=false", "keys=-"],
            ["a checker crashed", "returned", "after-consolidate=5", "no_propositions=false", one,
             "double-slash=false", "keys=-"],
            ["propositions lost",
             "STOPPED the consolidator returned no proposition for what the proposers returned",
             "after-consolidate=0", "no_propositions=false", one, "double-slash=false", "keys=-"],
            ["no proposition list", "STOPPED the consolidator returned no proposition list",
             "after-consolidate=0", "no_propositions=false", "counts=null", "double-slash=false",
             "keys=-"],
            ["deletions lost",
             "STOPPED the consolidator returned no proposition for what the proposers returned",
             "after-consolidate=0", "no_propositions=false",
             'counts={"lean":0,"rigor":0,"deletions":1}', "double-slash=false", "keys=-"],
        ])


# ---- round 11: the ask convention is gone (P3), the id grammar's fixes (P4), the decisions mirror
# both ways (P9), reco and reverses (P3), the gate's default rows (P11) and readings (P12), a stale
# head (P14), new failures at the head (P15), TICKET rows (P13), a record changed after the merge
# (P16), the retro's counts ------------------------------------------------------------------------

V10_BRIEF = GOOD_BRIEF.replace("planned 2026-10-18 at base", "planned 2026-10-18 (a model; skill "
                               "0.10.2) at base")
NOTE = "# ACME-12 Fix the widget\n" + TICKET.split("---\n", 2)[2]
TRIVIAL_BODY = TRIVIAL_SHAPES["default only, follow-up"]
R1_ROW = "| §5 R1 the lid holds | `python3 tools/gate_lid.py` | PASS |"
HEAD_LINE = "Readings taken on head 5d6e7f8.\n"
A3_ROW = "| A3: one duplicate test dropped | RULING | dropped | one reason to go red |\n"
TICKET_ROW = "| (plan) `handle.py:-` the handle burns | TICKET | `soup-3` | outside the pot |"
D1_S9 = "| D1 | 2026-10-18 | default | §2 2a | steel lid → glass lid |"
EARLY = "2026-01-01T09:00:00"


def tmp():
    return tempfile.TemporaryDirectory()


def new_repo(path):
    path.mkdir(parents=True, exist_ok=True)
    git(path, "init", "-q")
    git(path, "symbolic-ref", "HEAD", "refs/heads/main")
    return path


def merge(repo, ref, when):
    env = dict(GIT_ENV, GIT_AUTHOR_DATE=when, GIT_COMMITTER_DATE=when)
    subprocess.run(["git", "-C", str(repo), "merge", "-q", "--no-ff", "-m", f"merge {ref}", ref],
                   check=True, env=env, capture_output=True)


class GrammarRound11(unittest.TestCase):
    def test_to_in_the_authority_clause_expands(self):
        plan = GOOD_BRIEF.replace("authority: the ticket's ruling Q1 (lid first)",
                                  "authority: the ticket's rulings Q1 to Q5 and defaults D1 to D15")
        self.assertNotEqual(plan, GOOD_BRIEF)
        body = GOOD_BODY.replace("| E1: the lid is glass | DEFAULT |",
                                 "| D7: a deeper pot | DEFAULT |")
        dec = GOOD_DECISIONS + "2026-10-17 | D7 DEFAULT | a deeper pot | as recommended\n"
        for cid in ("P4", "M1"):
            with self.subTest(cid=cid):
                self.assertEqual(ids(run_cp(body, plan, decisions=dec), cid), [])
                self.assertTrue(ids(run_cp(body, decisions=dec), cid), "no clause, no D7")

    def test_a_two_letter_prefix_expands_in_the_clause(self):
        plan = GOOD_BRIEF.replace("authority: the ticket's ruling Q1 (lid first)",
                                  "authority: rulings Q1 and DF1 to DF6")
        self.assertEqual(cp.brief_records(plan).authority, {"Q1"} | {f"DF{k}" for k in range(1, 7)})

    def test_to_in_running_text_is_no_range(self):
        self.assertEqual(cp.ids_in("rulings Q1 to Q5"), {"Q1", "Q5"})
        plan = GOOD_BRIEF.replace("The pot boils over (`pot.py:3`).",
                                  "The pot boils over (`pot.py:3`); see Q1 to Q5.")
        self.assertNotEqual(plan, GOOD_BRIEF)
        self.assertNotIn("Q3", cp.brief_records(plan).authority)
        body = GOOD_BODY.replace("| E1: the lid is glass | DEFAULT | accepted |",
                                 "| Q3: a deep pot | RULING | accepted |")
        self.assertTrue(ids(run_cp(body, plan), "P4"))

    def test_p9_reads_the_ticket_id_from_a_note_headed_by_id_and_title(self):
        self.assertEqual(cp.ticket_id("plans/2026-01-03-acme-12-widget/note.md", NOTE), "ACME-12")
        self.assertEqual(cp.ticket_id("t-0001.md", TICKET), "t-0001")
        with tmp() as d:
            repo = new_repo(Path(d) / "repo")
            commit(repo, "docs: base", EARLY, {"README.md": "the widget\n"})
            commit(repo, "plan(ACME-12): the widget — trivial", EARLY,
                   {"docs/plans/widget/note.md": NOTE})
            git(repo, "checkout", "-q", "-b", "work")
            commit(repo, "fix: the widget", EARLY, {"src/widget.py": "x = 1\n"})
            b = ask_file(d, TRIVIAL_BODY, "body.md")
            _code, out = main_out(cp, [str(repo / "docs/plans/widget/note.md"), b, "--repo",
                                       str(repo), "--head", "work", "--base", "main"])
        self.assertNotIn("FAIL P9", out)
        self.assertNotIn("plan(note)", out)

    def test_an_id_leading_a_line_of_the_plan_note_is_known(self):
        ticket = TICKET.replace("> **What this is about:** the parser could also trim",
                                "Q2 (a): a tab splits a field too; unlike Q3, the note keeps "
                                "quotes.\n\n> **What this is about:** the parser could also trim")
        self.assertNotEqual(ticket, TICKET)
        u1 = "| U1: trim spaces | DEFAULT | not folded | beyond the ticket |"
        body = TRIVIAL_BODY.replace(u1, "| Q2 | RULING | a tab splits a field | the owner's "
                                    "answer |\n" + u1)
        self.assertEqual(ids(run_cp(body, ticket), "P4"), [])
        self.assertEqual(ids(run_cp(body, ticket.replace("Q2 (a):", "- Q2 (a):")), "P4"), [])
        self.assertTrue(ids(run_cp(body.replace("| Q2 |", "| Q3 |"), ticket), "P4"),
                        "an id in running text stays unknown")
        self.assertTrue(ids(run_cp(body, TICKET), "P4"))

    def test_a_plan_heading_with_a_suffix_and_the_later_note(self):
        for heading in ("## Plan (2026-01-03, trivial)", "## Plan (2026-01-03): trivial"):
            with self.subTest(heading=heading):
                ticket = TICKET.replace("## Plan (2026-01-03)", heading)
                self.assertNotEqual(ticket, TICKET)
                self.assertEqual(run_cp(TRIVIAL_BODY, ticket), [])
                older = TRIVIAL_BODY.replace("| U1: trim spaces |", "| U9: an older item |")
                self.assertTrue(ids(run_cp(older, ticket), "P4"), "the earlier note is not read")

    def test_a_bare_ask_heading_neither_crashes_nor_refuses(self):
        ticket = TICKET + "\n## Ask\n\n**Q5** keep tabs?\n\n## Ask 2026-01-04 · chat\n\nA word.\n"
        self.assertEqual(run_cp(TRIVIAL_BODY, ticket), [])
        with tmp() as d:
            code, out = main_out(cp, [ask_file(d, ticket), ask_file(d, TRIVIAL_BODY, "body.md")])
        self.assertEqual(code, 0, out)
        self.assertNotIn("UNPARSED", out)
        self.assertNotIn("--asks", cp.__doc__)
        self.assertFalse(hasattr(cp, "asks"))


class RulesRound11(unittest.TestCase):
    # P11: a default row may not change a gate rule; a file a rule runs changed needs a RULING
    def test_p11_a_default_row_that_changes_a_gate_rule(self):
        bad = {"value": "| D1 | 2026-10-18 | default | §2 2a | `spill=0` → `spill=1` |",
               "dataset": "| D1 | 2026-10-18 | default | §2 2a | R1 dataset: the stand-in pot → "
                          "the big pot |",
               "settle": "| D1 | 2026-10-18 | default | §4 | R1 settle: once → twice |"}
        good = {"reading": "| D1 | 2026-10-18 | default | §5 | R1 read by the orchestrator → read "
                           "by lane 3a |", "lid": D1_S9}
        for case, row in bad.items():
            with self.subTest(bad=case):
                self.assertTrue(ids(run_cp(GOOD_BODY, GOOD_BRIEF.replace(D1_S9, row)), "P11"))
        for case, row in good.items():
            with self.subTest(good=case):
                self.assertEqual(ids(run_cp(GOOD_BODY, GOOD_BRIEF.replace(D1_S9, row)), "P11"), [])

    def gate_repo(self, d, change):
        repo = new_repo(Path(d) / "repo")
        commit(repo, "plan(soup-1): the brief", "2026-10-18T09:00:00",
               {"tools/gate_lid.py": "print('spill=0')\n",
                "tests/test_lid.py": "def test_lid():\n    pass\n"})
        freeze = git(repo, "rev-parse", "HEAD")
        commit(repo, "fix: the lid", "2026-10-18T10:00:00", change)
        return repo, GOOD_BODY.replace("abc1234", freeze)

    def test_p11_a_file_a_gate_rule_runs_changed_since_the_freeze(self):
        ruled = GOOD_BRIEF.replace(D1_S9, "| A4 | 2026-10-18 | the human (\"deeper\") | §5 R1 | "
                                   "the script reads a deeper pot | the pot grew |\n" + D1_S9)
        with tmp() as d:
            repo, body = self.gate_repo(d, {"tools/gate_lid.py": "print('spill=1')\n"})
            self.assertTrue(ids(run_cp(body, repo=repo), "P11"))
            self.assertEqual(ids(run_cp(body, ruled, repo=repo), "P11"), [])
        floor = GOOD_BRIEF.replace("`python3 tools/gate_lid.py`",
                                   "`python3 -m pytest tests/test_lid.py`")
        self.assertNotEqual(floor, GOOD_BRIEF)
        with tmp() as d:  # a test added: the ran count rises above the frozen floor
            repo, body = self.gate_repo(d, {"tests/test_lid.py": "def test_lid():\n    pass\n\n\n"
                                            "def test_rim():\n    pass\n"})
            self.assertEqual(ids(run_cp(body, floor, repo=repo), "P11"), [])
        with tmp() as d:
            repo, body = self.gate_repo(d, {"tests/test_lid.py": "def test_rim():\n    pass\n"})
            self.assertTrue(ids(run_cp(body, floor, repo=repo), "P11"))

    # P12: each §5 rule reads PASS in Verification, or a RULING quotes its reading
    def test_p12_each_gate_rule_reads_pass_in_verification(self):
        self.assertIn(R1_ROW, GOOD_BODY)
        self.assertTrue(ids(run_cp(GOOD_BODY.replace(R1_ROW + "\n", "")), "P12"), "no R1 row")
        self.assertEqual(ids(run_cp(GOOD_BODY.replace("| PASS |", "| `spill=0` |")), "P12"), [],
                         "the rule's own PASS token")
        odd = GOOD_BODY.replace(R1_ROW, R1_ROW.replace("PASS", "spill=2"))
        self.assertTrue(ids(run_cp(odd), "P12"))
        ruled = GOOD_BRIEF.replace(D1_S9, "| A4 | 2026-10-18 | the human (\"ship it\") | §5 R1 | "
                                   "reads `spill=2` → accepted | a wider pot |\n" + D1_S9)
        self.assertEqual(ids(run_cp(odd, ruled), "P12"), [])

    # P14: the head the readings were taken on is --head
    def test_p14_verification_names_the_head_it_read(self):
        self.assertIn(HEAD_LINE, GOOD_BODY)
        self.assertTrue(ids(run_cp(GOOD_BODY.replace(HEAD_LINE, "")), "P14"))
        with tmp() as d:
            repo = new_repo(Path(d) / "repo")
            commit(repo, "fix: the lid", EARLY, {"src/pot.py": "lid = 1\n"})
            body = GOOD_BODY.replace("5d6e7f8", git(repo, "rev-parse", "HEAD"))
            self.assertEqual(ids(run_cp(body, repo=repo), "P14"), [])
            commit(repo, "fix: the lid, again", EARLY, {"src/pot.py": "lid = 2\n"})
            stale = ids(run_cp(body, repo=repo), "P14")
        self.assertTrue(stale and "stale" in stale[0], stale)

    # P15: more failures at the head than at the base, or a test failing only there
    def test_p15_a_new_failure_at_the_head_needs_a_findings_row(self):
        at = "| §5 R1 the lid holds |"
        rattles = "| (review) the lid rattles |"
        lint = ("| lint against the base | `ruff check .` at base 1a2b3c4 and head 5d6e7f8 | "
                "base 2 findings; head 3 findings |\n")
        bad = GOOD_BODY.replace(at, lint + at)
        self.assertTrue(ids(run_cp(bad), "P15"))
        self.assertEqual(ids(run_cp(bad.replace("head 3", "head 2")), "P15"), [])
        good = bad.replace(rattles, "| (review) `pot.py:4` a new lint finding at the head | "
                           "APPLY | fixed | same file |\n" + rattles)
        self.assertEqual(ids(run_cp(good), "P15"), [])
        suite = ("| suite against the base | `python3 -m pytest` at base 1a2b3c4 and head 5d6e7f8 "
                 "| base 1 failed (`test_old_pot`); head 1 failed (`test_lid_rattle`) |\n")
        bad = GOOD_BODY.replace(at, suite + at)
        self.assertTrue(ids(run_cp(bad), "P15"))
        good = bad.replace(rattles, "| (review) `pot.py:9` `test_lid_rattle` fails at the head | "
                           "APPLY | fixed | same file |\n" + rattles)
        self.assertEqual(ids(run_cp(good), "P15"), [])

    # P13: a TICKET row names another ticket and opens with file:line
    def test_p13_a_ticket_row_names_another_ticket_and_its_line(self):
        self.assertIn(TICKET_ROW, GOOD_BODY)
        bad = {"own ticket": TICKET_ROW.replace("`soup-3`", "`soup-1`"),
               "no ticket": TICKET_ROW.replace("`soup-3`", "later"),
               "no line": TICKET_ROW.replace("`handle.py:-` ", "")}
        for case, row in bad.items():
            with self.subTest(bad=case):
                self.assertTrue(ids(run_cp(GOOD_BODY.replace(TICKET_ROW, row)), "P13"))
        lead = TICKET_ROW.replace("(plan) `handle.py:-`", "`handle.py:7` (plan)")
        self.assertEqual(ids(run_cp(GOOD_BODY.replace(TICKET_ROW, lead)), "P13"), [])

    def test_p13_with_repo_a_ticket_on_a_changed_line_names_a_decision(self):
        with tmp() as d:
            repo = new_repo(Path(d) / "repo")
            commit(repo, "fix: base", EARLY, {"src/pan.py": "a = 1\nb = 2\nc = 3\nd = 4\ne = 5\n"})
            git(repo, "checkout", "-q", "-b", "work")
            commit(repo, "fix: the pan", EARLY, {"src/pan.py": "a = 1\nb = 20\nc = 3\nd = 4\n"
                                                                "e = 5\n"})

            def p13(row):
                body = GOOD_BODY.replace(TICKET_ROW, row)
                return ids(run_cp(body, repo=repo, head="work", base="main"), "P13")
            on_hunk = TICKET_ROW.replace("`handle.py:-`", "`src/pan.py:2`")
            self.assertTrue(p13(on_hunk), "a ticket on a line the PR adds")
            self.assertEqual(p13(on_hunk.replace("outside the pot", "outside the pot (D1)")), [])
            self.assertEqual(p13(on_hunk.replace("pan.py:2", "pan.py:5")), [])
            self.assertTrue(p13(TICKET_ROW.replace("handle.py", "pot.py")), "a file §3 names")
            self.assertEqual(p13(TICKET_ROW), [])

    # M1: decisions.md's run-time ids are Decisions rows of the same label
    def test_m1_each_run_time_line_has_a_decisions_row_of_its_label(self):
        self.assertIn(A3_ROW, GOOD_BODY)
        self.assertEqual(ids(run_cp(GOOD_BODY, decisions=GOOD_DECISIONS), "M1"), [])
        self.assertTrue(ids(run_cp(GOOD_BODY.replace(A3_ROW, ""), decisions=GOOD_DECISIONS), "M1"))
        default = GOOD_BODY.replace(A3_ROW, A3_ROW.replace("RULING", "DEFAULT"))
        self.assertTrue(ids(run_cp(default, decisions=GOOD_DECISIONS), "M1"))
        q1 = ("| Plan Q1: the lid first | RULING | lid before the timer | a timer cannot stop a "
              "spill |\n")
        self.assertIn(q1, GOOD_BODY)
        self.assertEqual(ids(run_cp(GOOD_BODY.replace(q1, ""), decisions=GOOD_DECISIONS), "M1"), [],
                         "a plan-time id of the authority clause is exempt")

    def test_m1_a_range_row_is_read_id_by_id(self):
        plan = GOOD_BRIEF.replace(D1_S9, "| D2 | 2026-10-18 | default | §2 2a | thin → thick | it "
                                  "lasts |\n| D3 | 2026-10-18 | default | §2 2a | round → oval | "
                                  "it fits |\n" + D1_S9)
        dec = GOOD_DECISIONS + ("2026-10-18 | D2 DEFAULT | thick glass | it lasts\n"
                                "2026-10-18 | D3 DEFAULT | an oval lid | it fits\n")
        body = GOOD_BODY.replace("| D1: a glass lid | DEFAULT |", "| D1–D3: a thick oval glass lid "
                                 "| DEFAULT |")
        self.assertNotEqual(body, GOOD_BODY)
        self.assertEqual(ids(run_cp(body, plan, decisions=dec), "M1"), [])
        self.assertTrue(ids(run_cp(body.replace("D1–D3", "D1–D2"), plan, decisions=dec), "M1"))

    def test_m1_reco_and_the_choice_are_option_letters(self):
        for bad, word in (("reco A |", "reco drop |"), ("| A · the duplicate", "| the duplicate")):
            with self.subTest(bad=word):
                dec = GOOD_DECISIONS.replace(bad, word)
                self.assertNotEqual(dec, GOOD_DECISIONS)
                self.assertTrue(ids(run_cp(GOOD_BODY, decisions=dec), "M1"))
        none = GOOD_DECISIONS.replace("| A · the duplicate test dropped · reco A |",
                                      "| - · the duplicate test dropped · reco - |")
        self.assertNotEqual(none, GOOD_DECISIONS)
        self.assertEqual(ids(run_cp(GOOD_BODY, decisions=none), "M1"), [])

    def test_m1_a_ruling_line_carries_reco_and_reverses_an_earlier_id(self):
        no_reco = GOOD_DECISIONS.replace("dropped · reco A |", "dropped |")
        self.assertNotEqual(no_reco, GOOD_DECISIONS)
        self.assertTrue([f for f in ids(run_cp(GOOD_BODY, decisions=no_reco), "M1") if "reco" in f])
        plan = GOOD_BRIEF.replace(D1_S9, "| A4 | 2026-10-19 | the human (\"keep it\") | §4 | "
                                  "dropped → kept | a second reason |\n" + D1_S9)
        body = GOOD_BODY.replace("| D1: a glass lid |", "| A4: the duplicate test kept | RULING | "
                                 "kept | a second reason |\n| D1: a glass lid |")
        line = ("2026-10-19 | A4 RULING | B · the duplicate test kept · reco A · reverses {} | the "
                "human: \"keep it\"\n")
        self.assertEqual(ids(run_cp(body, plan, decisions=GOOD_DECISIONS + line.format("A3")),
                             "M1"), [])
        for gone in ("A9", "A4"):  # recorded nowhere; not on an earlier line
            with self.subTest(reverses=gone):
                fails = ids(run_cp(body, plan, decisions=GOOD_DECISIONS + line.format(gone)), "M1")
                self.assertTrue([f for f in fails if "reverses" in f], fails)

    # P16: decisions.md or §9 changed after the merge
    BRIEF_AT = "docs/plans/soup-1/plan.md"
    DEC_AT = "docs/plans/soup-1/decisions.md"

    def merged_repo(self, d):
        repo = new_repo(Path(d) / "repo")
        commit(repo, "docs: base", "2026-10-17T09:00:00", {"README.md": "soup\n"})
        git(repo, "checkout", "-q", "-b", "work")
        commit(repo, "plan(soup-1): the brief", "2026-10-18T09:00:00",
               {self.BRIEF_AT: GOOD_BRIEF, self.DEC_AT: GOOD_DECISIONS})
        commit(repo, "fix: the lid", "2026-10-18T10:00:00", {"src/pot.py": "lid = True\n"})
        git(repo, "checkout", "-q", "main")
        merge(repo, "work", "2026-10-19T09:00:00")
        return repo

    def p16(self, repo, d, *extra):
        b = ask_file(d, GOOD_BODY, "body.md")
        return main_out(cp, [str(repo / self.BRIEF_AT), b, "--repo", str(repo), "--head", "work",
                             *extra])[1]

    def test_p16_a_record_changed_after_the_merge(self):
        later = {"§1 typo": (self.BRIEF_AT, GOOD_BRIEF.replace("boils over", "boils over again"),
                             False),
                 "§9 row": (self.BRIEF_AT, GOOD_BRIEF.replace(D1_S9, D1_S9.replace("glass lid",
                                                                                   "steel lid")),
                            True),
                 "decisions.md": (self.DEC_AT, GOOD_DECISIONS.replace("a glass lid", "steel"),
                                  True)}
        for case, (path, text, red) in later.items():
            with self.subTest(case=case), tmp() as d:
                repo = self.merged_repo(d)
                self.assertNotIn("FAIL P16", self.p16(repo, d, "--base", "main"))
                self.assertIn("P16 NOT RUN", self.p16(repo, d), "no --base, no --merged")
                merged = git(repo, "rev-parse", "HEAD")
                commit(repo, "docs: after the merge", "2026-10-20T09:00:00", {path: text})
                self.assertEqual("FAIL P16" in self.p16(repo, d, "--base", "main"), red)
                self.assertEqual("FAIL P16" in self.p16(repo, d, "--merged", merged), red)

    # the version gate: a v0.10 record reads the new rules as not applicable
    def test_the_new_rules_read_a_pre_v011_record_as_not_applicable(self):
        old = (GOOD_BODY.replace(R1_ROW + "\n", "").replace(HEAD_LINE, "").replace(A3_ROW, "")
               .replace(TICKET_ROW, "| (plan) the handle burns | TICKET | `soup-1` | outside |"))
        dec = GOOD_DECISIONS.replace(" · reco A |", " |")
        plan = V10_BRIEF.replace(D1_S9, "| D1 | 2026-10-18 | default | §5 | `spill=0` → "
                                 "`spill=1` |")
        notes = []
        self.assertEqual(run_cp(old, plan, decisions=dec, notes=notes), [])
        for cid in ("P11", "P12", "P13", "P14", "P15", "M1"):
            with self.subTest(cid=cid):
                self.assertTrue([n for n in notes if n.startswith(f"{cid} ")
                                 and n.endswith("not applicable (pre-v0.11 format)")], notes)
        self.assertTrue(run_cp(old, GOOD_BRIEF, decisions=dec), "a current record FAILs")


R1_RULE = ("- **R1 the lid holds.** `python3 tools/gate_lid.py` reads `spill=`. Dataset: the stand-in "
           "pot. Settle: once. Dry run with the fix in: `spill=0`. FAIL reading (base): `spill=3`. "
           "Cannot run: `spill=` absent, read FAIL.")


def suite_rule(command, reads, dry):
    return (f"\n- **R2 the suite holds.** `{command}` reads {reads}. Dataset: the kitchen's tests. "
            f"Settle: once. Dry run with the fix in: `{dry}`. FAIL reading (base): `failed=1`. "
            "Cannot run: no summary line, read FAIL.")


class FreezeRound11(unittest.TestCase):
    def test_the_fixture_holds_r1_on_one_line(self):
        self.assertIn(R1_RULE, GOOD_BRIEF)

    # red test 2: the authority clause's `DF1 to DF6` is a range for P4, M1 and F11
    def test_df_to_range_in_the_authority_clause(self):
        plan = GOOD_BRIEF.replace("authority: the ticket's ruling Q1 (lid first)",
                                  "authority: the ticket's ruling Q1 (lid first) and defaults DF1 "
                                  "to DF6")
        self.assertNotEqual(plan, GOOD_BRIEF)
        body = GOOD_BODY.replace("| E1: the lid is glass | DEFAULT |",
                                 "| DF3: a deeper pot | DEFAULT |")
        dec = GOOD_DECISIONS + "".join(f"2026-10-17 | DF{k} DEFAULT | a deeper pot | as recommended"
                                       "\n" for k in range(2, 6))
        for cid in ("P4", "M1"):
            with self.subTest(cid=cid):
                self.assertEqual(ids(run_cp(body, plan, decisions=dec), cid), [])
                self.assertTrue(ids(run_cp(body, decisions=dec), cid), "no clause, no DF3")
        self.assertEqual(ids(run_fc(plan, decisions=dec), "F11"), [])
        self.assertEqual(len(ids(run_fc(GOOD_BRIEF, decisions=dec), "F11")), 4, "no clause")

    # P5: a test-suite rule reads a floor, never an exact count
    def test_f12_a_suite_rule_compared_to_an_exact_count(self):
        floor = suite_rule("python3 -m pytest -q", "`failed: 0` and `ran ≥ 42`, with ran printed",
                           "ran=42 failed=0")
        exact = {"pytest": suite_rule("python3 -m pytest -q", "`passed=` and `failed=`",
                                      "passed=42 failed=0"),
                 "npm": suite_rule("npm test", "`tests = 42` and `failed: 0`", "tests=42 failed=0"),
                 "unittest": suite_rule("python3 -m unittest test_lid", "`Ran 42 tests` and `OK`",
                                        "Ran 42 tests OK")}
        self.assertEqual(ids(run_fc(GOOD_BRIEF.replace(R1_RULE, R1_RULE + floor)), "F12"), [])
        self.assertEqual(run_fc(GOOD_BRIEF.replace(R1_RULE, R1_RULE + floor), LISTING), [])
        for case, rule in exact.items():
            with self.subTest(case=case):
                self.assertTrue(ids(run_fc(GOOD_BRIEF.replace(R1_RULE, R1_RULE + rule)), "F12"))
        self.assertEqual(ids(run_fc(GOOD_BRIEF), "F12"), [], "`spill=0` runs no test runner")

    # P2: a "before merge" condition belongs in §5
    def test_f13_before_merge_outside_the_gate(self):
        bad = GOOD_BRIEF.replace("The pot boils over (`pot.py:3`).",
                                 "The pot boils over (`pot.py:3`). Taste it before merge.")
        good = GOOD_BRIEF.replace("- suite and lint per run steps 3–4",
                                  "- suite and lint per run steps 3–4, before merge")
        self.assertNotEqual(bad, GOOD_BRIEF)
        self.assertNotEqual(good, GOOD_BRIEF)
        self.assertTrue(ids(run_fc(bad), "F13"))
        self.assertEqual(ids(run_fc(good), "F13"), [])

    def test_the_new_freeze_rules_read_a_pre_v011_brief_as_not_applicable(self):
        old = V10_BRIEF.replace(R1_RULE, R1_RULE + suite_rule(
            "python3 -m pytest -q", "`passed=`", "passed=42")).replace(
            "The pot boils over (`pot.py:3`).", "The pot boils over (`pot.py:3`) before merge.")
        self.assertNotEqual(old, V10_BRIEF)
        out = run_fc(old)
        self.assertEqual([f for f in out if f.startswith("FAIL")], [])
        for cid in ("F12", "F13"):
            self.assertIn(f"{cid} not applicable (pre-v0.11 format)", out)


R2_RULE = ("\n- **R2 the suite holds.** `python3 -m pytest` reads `failed: 0` and `ran ≥ 40`, with ran "
           "printed. Dataset: the kitchen's tests. Settle: once. Dry run with the fix in: `failed: 0, "
           "ran 41`. FAIL reading (base): `failed: 1, ran 41`. Cannot run: no summary line, read FAIL.")
R2_ROW = "\n| §5 R2 the suite holds | `python3 -m pytest` | {} |"


class ReviewRound11(unittest.TestCase):
    # P12: a reading that meets the rule's own comparisons (a ran above the floor) is a PASS
    def test_p12_a_ran_count_above_the_floor_passes(self):
        plan = GOOD_BRIEF.replace(R1_RULE, R1_RULE + R2_RULE)
        self.assertNotEqual(plan, GOOD_BRIEF)

        def p12(result):
            return ids(run_cp(GOOD_BODY.replace(R1_ROW, R1_ROW + R2_ROW.format(result)), plan),
                       "P12")
        self.assertEqual(p12("failed: 0, ran 44"), [], "tests added: no §9 row")
        self.assertEqual(p12("failed: 0, ran 40"), [])
        self.assertTrue(p12("failed: 0, ran 38"), "a ran below the floor")
        self.assertTrue(p12("failed: 1, ran 44"), "a failure")
        self.assertTrue(p12("ran 44"), "failed not printed")

    # P12: the PASS token after "dry-run reading", the field's own name
    def test_p12_the_token_after_a_dry_run_reading(self):
        plan = GOOD_BRIEF.replace("Dry run with the fix in: `spill=0`",
                                  "dry-run reading with the fix in: `spill=0`")
        self.assertNotEqual(plan, GOOD_BRIEF)
        body = GOOD_BODY.replace(R1_ROW, R1_ROW.replace("PASS", "`spill=0`"))
        self.assertEqual(ids(run_cp(body, plan), "P12"), [])
        self.assertTrue(ids(run_cp(body.replace("spill=0", "spill=2"), plan), "P12"))

    # M1: `reverses` followed by words, not an id, is prose
    def test_m1_a_prose_reverses_is_not_the_field(self):
        dec = GOOD_DECISIONS.replace('the human: "lid first"',
                                     "the human: \"lid first\"; this reverses the plan's order")
        self.assertNotEqual(dec, GOOD_DECISIONS)
        self.assertEqual(ids(run_cp(GOOD_BODY, decisions=dec), "M1"), [])
        bad = dec.replace("this reverses the plan's order", "reverses Q9")
        self.assertTrue(ids(run_cp(GOOD_BODY, decisions=bad), "M1"))

    # P15: a Findings row that only says "test" does not cover a count rise
    def test_p15_a_row_saying_test_without_a_failure_is_no_cover(self):
        at = "| §5 R1 the lid holds |"
        suite = ("| suite against the base | `python3 -m pytest` at base 1a2b3c4 and head 5d6e7f8 "
                 "| base 0 failed; head 3 failed |\n")
        bad = GOOD_BODY.replace(at, suite + at).replace("the lid rattles |",
                                                        "the lid rattles in a test kitchen |")
        self.assertIn("test kitchen", bad)
        self.assertTrue(ids(run_cp(bad), "P15"))
        good = bad.replace("| (review) the lid rattles", "| (review) the suite fails 3 tests at the "
                           "head | APPLY | fixed | same file |\n| (review) the lid rattles")
        self.assertEqual(ids(run_cp(good), "P15"), [])

    # P15: clauses split at a comma too, so each count reads its own side
    def test_p15_a_comma_between_the_base_and_head_clauses(self):
        at = "| §5 R1 the lid holds |"
        suite = ("| suite against the base | `python3 -m pytest` | 0 failed at base 1a2b3c4, 3 failed "
                 "at head 5d6e7f8 |\n")
        self.assertTrue(ids(run_cp(GOOD_BODY.replace(at, suite + at)), "P15"))
        same = suite.replace("3 failed at head", "0 failed at head")
        self.assertEqual(ids(run_cp(GOOD_BODY.replace(at, same + at)), "P15"), [])
        listed = ("| suite against the base | `python3 -m pytest` | base 1a2b3c4: 0 failed; head "
                  "5d6e7f8: 2 failed (`test_lid_rattle`, `test_lid_hiss`) |\n")
        out = ids(run_cp(GOOD_BODY.replace(at, listed + at)), "P15")
        self.assertEqual(len(out), 2, out)

    # P11: a file §3 names is the contract's own change, not a gate change
    def test_p11_a_file_section_3_names_is_no_gate_change(self):
        plan = GOOD_BRIEF.replace("`python3 tools/gate_lid.py` reads", "`python3 -m pot` reads")
        self.assertNotEqual(plan, GOOD_BRIEF)

        def p11(change):
            with tmp() as d:
                repo = new_repo(Path(d) / "repo")
                commit(repo, "plan(soup-1): the brief", "2026-10-18T09:00:00",
                       {"pot.py": "lid = False\n", "tools/gate_lid.py": "print('spill=0')\n"})
                freeze = git(repo, "rev-parse", "HEAD")
                commit(repo, "fix: the lid", "2026-10-18T10:00:00", change)
                return ids(run_cp(GOOD_BODY.replace("abc1234", freeze), plan, repo=repo), "P11")
        self.assertEqual(p11({"pot.py": "lid = True\n"}), [], "§3 names pot.py")
        plan = plan.replace("`python3 -m pot` reads", "`python3 -m pot tools/gate_lid.py` reads")
        self.assertTrue(p11({"tools/gate_lid.py": "print('spill=1')\n"}), "the gate script")

    # F12: each exact count fails, whatever floor the rule holds elsewhere
    def test_f12_a_floor_elsewhere_does_not_clear_an_exact_count(self):
        mixed = suite_rule("python3 -m pytest -q", "`passed: 41`; also `ran ≥ 40`",
                           "passed=41 failed=0")
        self.assertTrue(ids(run_fc(GOOD_BRIEF.replace(R1_RULE, R1_RULE + mixed)), "F12"))
        floor = suite_rule("python3 -m pytest -q", "`failed: 0` and `ran ≥ 40`, with ran printed",
                           "41 passed")
        self.assertEqual(ids(run_fc(GOOD_BRIEF.replace(R1_RULE, R1_RULE + floor)), "F12"), [],
                         "a dry-run reading holds an observed count")

    # F13: the pasted lessons, a fenced block and a verbatim quote are not the brief's words
    def test_f13_quoted_text_is_not_read(self):
        quoted = {
            "lessons": ("- 5 (retro r2) one kitchen, two cooks → matches the run.",
                        "- 5 (retro r2) run the oven test before merge → matches the run."),
            "fenced": ("The pot boils over (`pot.py:3`).",
                       "The pot boils over (`pot.py:3`).\n\n```\nTaste the soup before merging.\n"
                       "```"),
            "quote": ('| "boils at 100 C" | verified |', '| "boils before merge" | verified |'),
        }
        for case, (old, new) in quoted.items():
            with self.subTest(case=case):
                plan = GOOD_BRIEF.replace(old, new)
                self.assertNotEqual(plan, GOOD_BRIEF)
                self.assertEqual(ids(run_fc(plan), "F13"), [])
        said = GOOD_BRIEF.replace("| 2a · water boils at 100 C |", "| 2a · boil before merge |")
        self.assertTrue(ids(run_fc(said), "F13"), "the sentence column is the brief's own")
        after = GOOD_BRIEF.replace(*quoted["fenced"]).replace(
            "```\n\n## 2.", "```\nTaste it before merge.\n\n## 2.")
        self.assertIn("```\nTaste it before merge.", after)
        self.assertTrue(ids(run_fc(after), "F13"), "after the fence closes")


class Counts(unittest.TestCase):
    def test_counts_prints_rows_per_label_and_no_table(self):
        with tmp() as d:
            code, out = main_out(cp, ["--counts", ask_file(d, GOOD_BODY, "body.md")])
            self.assertEqual(code, 0, out)
            self.assertIn("Decisions: RULING=2 DEFAULT=2", out)
            self.assertIn("Findings: APPLY=0 DECLINE=1 TICKET=1 RULING=0", out)
            code, out = main_out(cp, ["--counts", ask_file(d, TRIVIAL_BODY, "body.md")])
            self.assertEqual(code, 0, out)
            self.assertIn("Decisions: RULING=0 DEFAULT=1", out)
            self.assertIn("Findings: no table", out)
            self.assertNotIn("APPLY=0", out)


if __name__ == "__main__":
    unittest.main()
