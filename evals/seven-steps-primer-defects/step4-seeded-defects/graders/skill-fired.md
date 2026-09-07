---
type: tool_used
tool: Skill
min: 1
---
A monitor, never a score, never the test. Under `--ablation with-without` the harness
demotes a `tool_used: Skill` grader with no `arm` to a with-only indicator, excluded from
the score in both arms and evaluated in the with arm only. So it cannot say whether the
without-arm attempted the skill, and it counts attempted calls rather than resolved ones.

The instrument-readiness test the plan requires (the Skill tool result carrying the loaded
body in every with-arm recon trace and in no without-arm trace) is read from the kept
traces at step 4, not from this grader.

`arm` is deliberately unset, so the harness demotes it. Recon confirmed the demotion on
this case: the with-arm record carries it as `withOnly: true, scored: false`, and the
without-arm record does not list it at all (`4-recon.md`, seam 2).
