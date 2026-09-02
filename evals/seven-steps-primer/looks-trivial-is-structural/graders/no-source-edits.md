---
type: tool_used
tool: Edit
min: 0
max: 0
input_match: '"file_path"\s*:\s*"[^"]*(src/|server\.js|test/)'
arm: both
---
The same absence check as `gate-stop-step0`, for the same reason and with the same four
keys: `min: 0` because it defaults to 1 and `max: 0` alone can never pass, `max: 0`
because that is the claim, `input_match` because an unscoped ban penalises a run for
editing anything at all, and `arm: both` because a grader dropped from the baseline
column turns this case's contrast into a comparison against nothing.

Corroboration only. Tool-name absence is unsound wherever `Bash` is granted, and it is
granted here — it has to be, or restraint is indistinguishable from incapacity.
`source-untouched` carries the claim.

<!--
Scoped for the same reason as `gate-stop-step0/graders/no-source-edits.md`, copied
verbatim per the decision at docs/plans/primer-evals/6-cold-fork-register.md:276.

This case has no `Write` counterpart and none is added here: `does-not-skip.md` rewards a
diagnosis in the reply, not a written artifact, so nothing in this case's design asks a
run to create a file. But a run can still call `Edit` on something that is not the
fixture's source — a scratch note, a todo it kept for itself — and an unscoped ban would
fail that run for touching nothing this case measures. Scoping to the same anchor as the
`Write` grader next door in `gate-stop-step0` keeps both cases' Edit bans answering the
same question: did the run touch the service, not did it touch anything at all.
-->

## Probes

```probe-match
{"file_path":"/workspace/src/middleware/index.js","old_string":"let hitsInWindow = 0;","new_string":"const windows = new Map();"}
```

```probe-match
{"file_path":"/workspace/server.js","old_string":"withRateLimit,","new_string":"withIdentity,\n  withRateLimit,"}
```

```probe-no-match
{"file_path":"/workspace/notes/rate-limiting-diagnosis.md","old_string":"one counter","new_string":"a single shared counter"}
```

```probe-no-match
{"file_path":"/workspace/NOTES.md","old_string":"draft","new_string":"final"}
```

The two negatives are a run's own scratch notes, not the service — a grader that fails on
either is a grader that penalises the treatment for writing anything down at all.
