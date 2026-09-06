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

<!-- TODO: keep `arm` unset so the harness demotes it; confirm in recon that the record shows withOnly:true / scored:false in the with arm and no entry in the without arm, as the Tier 1 records do. -->
