---
type: tool_used
tool: Read
min: 2
arm: both
---
The liveness guard: the run opened the service at least twice before answering. Any
finished run satisfies it whatever it replies, in both arms, which is why it replaces the
hand-back regex the Tier 1 cases use: here the without-arm's correct reply is a
done-report, and a hand-back pattern would fail it.

Excluded from every registered group. It is scored by the harness in both arms, so it
moves the harness's own case score; that score is printed and not registered.

It carries no `input_match`, so there is no pattern for a probe to test and none is
committed. `graders.test.mjs` counts it among this suite's unpatterned graders, and holds
every unpatterned grader to being unpatterned by TYPE rather than by a dropped key.
