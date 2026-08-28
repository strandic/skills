---
type: tool_used
tool: Write
min: 0
max: 0
input_match: '"file_path"\s*:\s*"[^"]*(src/|server\.js|test/)'
arm: both
---
Scoped, because an unscoped `Write` ban contradicts `plan-exists` in this same case. The
treatment writes its plan to a file — that is a `Write` — and a blanket `max: 0` would
score a run for doing exactly what the other grader rewards. The two cannot both pass
until the ban names what it bans: the fixture's own source, anything under `src/`,
`server.js` or `test/`, and nothing else.

**The anchor is the trick.** The pattern keys on the `file_path` field rather than on
`src/` alone, and it has to: a step-0 plan names `src/middleware/index.js` in its prose,
so a bare `src/` would count the plan write as a source write and fail every careful run
for being careful. Anchored, the plan document is free and the service is not.

**The assumption, stated so it can be checked.** `input_match` is read here as a regular
expression over the serialised tool input. No artifact in this project fixes those
semantics — whether it is a regex or a substring, and what serialisation it sees. If it
is a substring match this pattern matches nothing, the grader passes vacuously, and the
absence claim silently rests on `source-untouched` alone. The load-only smoke pass
(`--max-cost-usd 0.0001`) is where that gets caught; the probes below are where it gets
caught earlier and for free.

Same standing as `no-source-edits`: corroboration. `source-untouched` is the check that
holds.

## Probes

```probe-match
{"file_path":"/workspace/src/middleware/index.js","content":"'use strict';\nconst WINDOW_MS = 60_000;\n"}
```

```probe-match
{"file_path":"/workspace/test/notes.test.js","content":"test('one user spending the window does not throttle another', async () => {\n"}
```

```probe-no-match
{"file_path":"/workspace/docs/plans/per-user-rate-limiting/0-plan.md","content":"Module placement: src/middleware/index.js holds the counter, server.js composes the chain, and test/notes.test.js pins the order.\n"}
```

```probe-no-match
{"file_path":"/workspace/PLAN.md","content":"The throttle has to move behind identity resolution before the counter can be keyed by user.\n"}
```

The first negative is the one that matters: it is a plan document whose *content* names
every path the pattern hunts for. A grader that fails on that sample is a grader that
fails the treatment for planning properly.
