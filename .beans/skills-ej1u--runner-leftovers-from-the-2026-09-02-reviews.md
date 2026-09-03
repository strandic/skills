---
# skills-ej1u
title: Runner leftovers from the 2026-09-02 reviews
status: todo
type: task
priority: low
created_at: 2026-09-03T09:32:25Z
updated_at: 2026-09-03T14:04:07Z
---

Informational items the 2026-09-02 review verifiers left open, none blocking. Record in `docs/plans/primer-evals/pr-1-review-2026-09-02.md`, outcome section.

- [ ] `invocationFor` computes `--allow-tools` over the full case set even for a one-case invocation; correct today because every case needs the same tools; no test pins it
- [ ] an interrupted run exits the process with 1, the same code as "below threshold"; the record carries 128+N, the process does not
- [ ] `combineHarnessDocuments` returns a null document for four reasons and only one is a stop reason in `sweepStopReason`
- [ ] a nested README (e.g. `prompt-fixtures/README.md`) is part of the instrument digest; a typo fix there costs a full re-sweep
- [ ] the `input_match` anchor `(src/|server\.js|test/)` matches any path containing those segments
- [ ] `graders.test.mjs` heading "target first" describes one tag-scoped invocation; the suite now runs per-case invocations



2026-09-03, four of six done in scripts/ while the full sweep ran (nothing under the suite directory was touched, so the sweep's digest stands):
- [x] allow-tools over the full case set: documented as intentional (one grant per sweep) and pinned by a test
- [x] interrupted run exit code: new processExitCode — the process exits 128+N for a signal, 2 for a partial, 1 for a refusal, with tests
- [x] combine-time null documents: the runner now prints its 'runner:' notes to the terminal when a record has no document and no stop reason
- [x] graders.test heading renamed to 'one per-case invocation'
Deferred until after the merge, because each changes the shared instrument digest:
- [ ] nested README in the digest (instrument.mjs rule change → skip README.md at any depth? decide; a typo fix there should not cost a sweep)
- [ ] input_match anchor (src/|server\.js|test/) matches any path containing those segments — anchor to the workspace root
