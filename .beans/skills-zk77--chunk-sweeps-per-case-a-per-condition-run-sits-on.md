---
# skills-zk77
title: Chunk sweeps per case — a per-condition run sits on the ~35min kill boundary
status: todo
type: task
priority: normal
created_at: 2026-09-01T11:01:44Z
updated_at: 2026-09-03T09:32:25Z
---

Backgrounded tasks in this environment die near a 35-minute wall clock: four attempts went 41m killed, 34m killed, 34m completed, 33m killed, the last emitting output right up to the kill. A whole-condition sweep sits on that boundary.

Done on 2026-09-03: the runner now spawns one harness invocation per scored case inside one process (five per condition), because `--case` takes one name; each invocation is 8 to 13 minutes. The per-case documents are combined into one `results/<condition>.json` with the shape the merger reads. Stale results are refused by I2b (instrument digest on every record). So the remaining item is only about where the process runs.

What is still open: a process that runs five invocations back to back still lives 45 minutes and is still killed when backgrounded from a Claude Code session. The documented path is a terminal. If per-case launches from a session are wanted, each case needs to be a separately launched task, and the runner needs an entry point that runs one case and a merge step that assembles the five documents into one record. That is fifteen launches per sweep. Decide whether it is worth it against "run it from a terminal".

- [x] one harness invocation per case, documents combined (done 2026-09-03, `scripts/run-evals.mjs` planSweep)
- [x] refuse stale results (I2b, instrument digest)
- [ ] decide: per-case launches as separate tasks, or keep the terminal as the documented path
- [ ] if per-case launches: a `--case` entry point that writes a per-case record, and a merge step that assembles five into one
