---
# skills-zk77
title: Chunk sweeps per case — a per-condition run sits on the ~35min kill boundary
status: todo
type: task
priority: high
created_at: 2026-09-01T11:01:44Z
updated_at: 2026-09-01T11:01:44Z
---

The runner sweeps a whole condition per invocation — five cases, ~34 minutes. Backgrounded tasks in this environment appear to die near a 35-minute wall clock: four attempts went 41m killed, 34m killed, ~34m completed, 33m killed, and the last was emitting output continuously right up to the kill, so it is not a silence/inactivity reaper.

A per-condition sweep sits exactly on that boundary. Per-case runs are 5-8 minutes and sit comfortably under it.

- [ ] chunk the sweep loop per case: one `claude plugin eval --case <name>` invocation each
- [ ] merge the per-case documents into one `results/<condition>.json` with the same shape the merger already reads
- [ ] keep the whole-condition path available for terminal use, where no supervision applies
- [ ] clear or timestamp `results/` per sweep — nothing does today, and a stale `<condition>.json` from an older successful sweep would merge silently and mix conditions measured weeks apart

The wrong diagnosis (that `--json` silence caused the kills) is corrected in `scripts/run-evals.mjs`; this is the actual fix.
