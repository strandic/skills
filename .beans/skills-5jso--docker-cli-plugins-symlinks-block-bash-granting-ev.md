---
# skills-5jso
title: Docker cli-plugins symlinks block Bash-granting evals from 2.1.251
status: todo
type: task
priority: high
created_at: 2026-09-01T11:01:44Z
updated_at: 2026-09-01T11:01:44Z
---

From CLI 2.1.251 the harness refuses any Bash-granting evaluation while `~/.docker` holds a symlink anywhere inside it. It seals credential stores by path, a symlink defeats the seal, and it fails closed. Correct in general, wrong here: the symlinks are `~/.docker/cli-plugins/*`, which Docker Desktop installs pointing into its app bundle. They are CLI plugin binaries, not credentials. `DOCKER_CONFIG` does not redirect the check.

Bash cannot be dropped from the cases to dodge it: the primary measurement is an absence, and "it did not touch the source" is evidence of restraint only when the run could have (harness-facts #25, #26).

What the runner enforces (`scripts/run-evals.mjs` preflightCli): the 2.1 series, and a refusal of any patch above 2.1.250 only when `~/.docker` contains a symlink. On a machine without Docker Desktop, 2.1.251 and later pass preflight, but harness-facts #39 records other 2.1.251 changes (compressed bundled reference, changed plugin-path rule) that the runner does not guard and that no sweep has been run on. So "pinned to 2.1.250" is the documented path, and anything newer is untested, not refused.

- [ ] report upstream: the guard should exclude the credential files it cares about, or tolerate symlinks that resolve inside the same directory
- [ ] re-test on each new CLI minor; the preflight refuses loudly on a series change, so breakage is visible
- [ ] before 2.1.250 is collected from the version cache, verify a newer patch against harness-facts #39 on a Docker-free machine, or decide between a per-machine workaround and dropping Bash grants
