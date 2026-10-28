---
# skills-iim2
title: 'shawarma retro: a CODING_STANDARDS.md review lane'
status: todo
type: feature
priority: normal
tags:
    - shawarma
created_at: 2026-10-13T12:56:39Z
updated_at: 2026-10-28T10:26:07Z
---

Let shawarma use a per-project CODING_STANDARDS.md to review the code's shape. It complements, and does not replace, the behaviour checks the method already runs. Source: Matt Pocock's "fixing the PR bottleneck" talk (aihero.dev/skills). His points: the implementer agent is already overloaded, so standards go to a separate reviewer with its own context; checks can lie through tests that restate the implementation, tests tied to code structure, and mocks that cannot fail.

What shawarma covers today: mutant rows catch tests that cannot fail. Nothing catches tests that restate the implementation or that depend on code structure. 3a and 3b are either-or, so a standards check inside 3b would be skipped on adversarial runs. DECLINE accepts `style` as a reason, so any standards finding can be dismissed.

Proposed (input to the next retro; the skill text changes only there):
- [ ] **Rule format** for CODING_STANDARDS.md: id · rule · the kind of failure it prevents · good and bad example as `path:line` · check command or `manual`. A rule that can be checked mechanically becomes a lint rule, and the file keeps only a pointer to it. The `init` ticket depends on this format.
- [ ] **Never in the implementer prompt.** The implementer reads only the brief and its files.
- [ ] **Plan-time check.** Before the freeze, a lane reads the §4 tests and the sketch against the standards file (the 0a lane, or its own lane). The planner writes the tests, and changing a test after the freeze touches frozen text.
- [ ] **3c standards lane** in brief-template.md §7. It runs on every run, beside 3a or 3b. Inputs: the diff, CODING_STANDARDS.md and §3. Read-only, output under `reports/3c/`.
- [ ] **Evidence for standards findings.** Instead of a runnable reproduction: the rule id, the quoted `path:line`, and the output of the rule's check command if it has one.
- [ ] **Close the `style` gap.** A finding that cites a rule id cannot be DECLINEd as `style`. Going against a rule is a DEFAULT or a RULING.
- [ ] **Pin the version.** The brief's §5 records `CODING_STANDARDS.md@<sha>`, so the bar cannot move after the gate rules are written.
- [ ] **Retro.** CODING_STANDARDS.md becomes a third place a lesson can be adopted, beside the method and the house rules. Human review comments on PRs are appended as lessons.
- [ ] House rules point to the file; they do not restate it. House rules cover how the process works, the standards cover what the code looks like.

Keep in mind: the retro must cut at least as many words as it adds. Measure what this adds to SKILL.md and brief-template.md.

## Round 7

Dropped this round (R7): adds lane text with no case in this window. Stays open for a round that has one.
