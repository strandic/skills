---
type: tool_used
tool: Skill
min: 1
---
**Diagnostic, never a score.** Under `--ablation with-without` the harness demotes a
`tool_used: Skill` grader to `[with-only, not scored]` automatically, so this cannot move
either arm's number or the contrast between them. It is here to answer one question a
null delta cannot answer on its own.

**Why it exists.** The first smoke sweep returned Δ 0.00 on `gate-stop-step0` with the
two arms identical down to the turn count and every grader verdict. Two explanations fit
that equally well: the skill loaded and changed nothing, or the skill never loaded at
all. Without this indicator they are indistinguishable, and they call for opposite
responses — rewrite the method, or fix the routing.

The suite's own plan quotes the harness's advice that a Skill grader is "fine as a
display-only trigger check alongside outcome graders", and then every case shipped
without one. This is that gap closed.

No probes: `tool_used` carries no pattern, so there is nothing for a probe to
discriminate.
