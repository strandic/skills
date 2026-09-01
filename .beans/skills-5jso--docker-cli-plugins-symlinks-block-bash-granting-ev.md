---
# skills-5jso
title: Docker cli-plugins symlinks block Bash-granting evals from 2.1.251
status: todo
type: task
priority: high
created_at: 2026-09-01T11:01:44Z
updated_at: 2026-09-01T11:01:44Z
---

From CLI 2.1.251 the harness refuses any Bash-granting evaluation while `~/.docker` holds a symlink anywhere inside it. It seals credential stores by path, a symlink defeats the seal, and it fails closed — correct in general, and wrong here: the offending symlinks are `~/.docker/cli-plugins/*`, which Docker Desktop installs pointing into its app bundle. They are CLI plugin binaries (buildx, compose, scout), not credentials.

`DOCKER_CONFIG` does not redirect the check; it reads `~/.docker` regardless.

Bash cannot be dropped from the cases to dodge it: the primary measurement is an absence, and "it did not touch the source" is evidence of restraint only when the run could have. Recon demonstrated a run scoring clean on `Edit called 0x` and `Write called 0x` over a file a Bash one-liner had rewritten.

So the suite is pinned to 2.1.250 and the runner refuses anything else. That is a holding pattern, not a fix — old versions get collected eventually.

- [ ] report upstream: the guard should exclude the credential files it cares about, or tolerate symlinks that resolve inside the same directory
- [ ] re-test on each new CLI minor; the preflight already refuses loudly, so breakage is visible rather than silent
- [ ] if it is not fixed before 2.1.250 is collected, decide between a documented per-machine workaround and dropping the suite's Bash grants (which would gut the absence graders)
