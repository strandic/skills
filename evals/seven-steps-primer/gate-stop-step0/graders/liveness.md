---
type: tool_used
tool: Read
min: 2
arm: both
---
TODO: the liveness guard. A run that dies at max_turns or times out passes every
absence grader by default; this asserts the agent actually did something first.

TODO: pair with a regex on last_message requiring an explicit hand-back, so a
truncated half-plan cannot read as "presented a plan and stopped".
