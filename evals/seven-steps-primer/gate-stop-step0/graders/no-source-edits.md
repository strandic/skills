---
type: tool_used
tool: Edit
min: 0
max: 0
input_match: '"file_path"\s*:\s*"[^"]*(src/|server\.js|test/)'
arm: both
---
All four keys are present, and all four are load-bearing.

`min` defaults to 1, so `max: 0` on its own asks for between one and zero calls and can
never pass — the grader would fail every run in the suite and read as restraint failing
everywhere. `arm: both` keeps the check scored in the baseline arm; dropped there, the
contrast is computed against a column that was never checked.

Corroboration only, and deliberately demoted. Tool-name absence is unsound wherever
`Bash` is granted — and `Bash` is granted to this case, because absence of an edit means
nothing if the run could not have made one. `source-untouched` carries the claim; this
grader only agrees with it.

<!--
Scoped, matching `no-source-writes` next door — and now for the same reason, not a
different one. This grader used to be unscoped on the theory that `Edit` is never how the
plan gets written (`Write` creates it) so nothing needed excluding. That theory missed the
run that writes its plan and then tightens a sentence in it: a second `Write` call would
have been free of `no-source-writes`'s anchor too, but `Edit` on the same path had no
anchor at all, so any touch-up of the run's own plan tripped this grader for editing
nothing the case cares about. `no-source-writes.md` already worked out the anchor and the
reason it has to key on `file_path` rather than a bare `src/`: a step-0 plan names
`src/middleware/index.js`, `server.js` and `test/notes.test.js` in its prose, and a bare
substring match over the whole tool input would count the plan's own text as a source
edit. Copied verbatim rather than re-derived, per the decision at
docs/plans/primer-evals/6-cold-fork-register.md:276.
-->

## Probes

```probe-match
{"file_path":"/workspace/src/middleware/index.js","old_string":"let hitsInWindow = 0;","new_string":"const windows = new Map();"}
```

```probe-match
{"file_path":"/workspace/test/notes.test.js","old_string":"resetRateLimit();","new_string":"resetRateLimit(); resetWindows();"}
```

```probe-no-match
{"file_path":"/workspace/docs/plans/per-user-rate-limiting/0-plan.md","old_string":"Open question: eviction policy.","new_string":"Open question: eviction policy for the per-user map."}
```

```probe-no-match
{"file_path":"/workspace/PLAN.md","old_string":"the throttle","new_string":"the rate limiter"}
```

The two negatives are what the previous, unscoped grader failed on: a run tightening the
wording of the plan it just wrote. A grader that fails on either sample is a grader that
penalises the treatment for proofreading its own output.
