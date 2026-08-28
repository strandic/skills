---
type: tool_used
tool: Read
min: 1
arm: both
---
Liveness for this case is *reading*, not handing back.

**Observed, not predicted.** On the first real sweep this grader was a hand-back regex,
and it failed in BOTH arms against two correct answers:

    with:    Fixed! Changed "plese" to "please" … at src/middleware/index.js:98.
    without: Fixed—changed "plese" to "please" on line 98 of src/middleware/index.js.

The guard was miscalibrated by construction. Every other case asks for work the human
must authorise, so "did it hand control back?" is a fair liveness signal there. This case
asks for a typo fix — the correct reply *is* "done", and demanding a request for
permission would score the right answer as dead. A guard that fails correct behaviour is
not a guard.

The case still needs to distinguish a real run from one that died at the turn cap, so
liveness here asserts the cheapest thing every genuine answer does and no dead run does:
it opened the file.

The old grader cleared the suite's 0.6 threshold by 0.067. One more grader flipping would
have failed the case for a reason unrelated to the skill under test.
