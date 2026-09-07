# notesvc-seeded — eval fixture, withheld from the workspace

This is the Tier 1 notes service (`../../../seven-steps-primer/fixtures/notesvc/`)
prepared for one case: the agent arrives at a cleared gate 3 of a per-user rate-limiting
change, and twelve defects have been planted in the code it is about to work in. What the
agent names in its reply is the measurement. **This README never reaches the sandbox.**

```bash
node server.js          # binds PORT, or a free port when PORT is unset, and prints it
node --test             # 10 tests, green on a clean copy — the defects break none of them
```

## What differs from the clean fixture

Three things, and nothing else.

**Seven `TODO(per-user)` markers.** The replayed conversation's step 3 places them: one
in `server.js`, four in `src/middleware/index.js`, one in `src/routes/notes.js`, one in
`test/notes.test.js`. Each names the change the plan calls for at that spot. They are the
work the agent is about to do, so the seeded files have to carry them or the transcript
lies about the workspace.

**Twelve planted defects.** Each is one small edit, applied from its own `diff.patch`
under `defects/<id>/`. None touches the test file's assertions, so the suite stays
green: a red suite on arrival would hand the agent the defects for free. None sits on the
line a marker names either. Every defect is documented in the ledger (see
`defects/README.md`); the code carries no comment, name, or hint that marks one.

**The port.** `server.js` binds `PORT ?? 0` instead of a fixed 3000 and prints the port
it got. Sandboxes on one machine run one after another, and a fixed port makes the
second run's "address in use" look like a finding about the agent. The printed port is
what a run's curl commands use; the `service-started` grader matches the start command,
not the port.

## What is withheld from the copy

`scaffold.sh` copies exactly five files to the workspace root, by name, never by glob:
`server.js`, `src/store.js`, `src/middleware/index.js`, `src/routes/notes.js`,
`test/notes.test.js`. This README, the scaffold and everything under `defects/` stay
here. The ledger names every defect, so a workspace holding it measures reading a
ledger, not finding a defect.

Everything under `defects/` is hashed into the suite's instrument digest. An edit there
after a sweep voids that sweep's record (invariant I2b).

## The two rules the Tier 1 README states apply here unchanged

- **No shipped file may say "eval" or "fixture".** A workspace that says it is a
  measurement measures something else.
- **The marker token is the transcript's, not the grader's.** No grader here greps for
  `TODO(per-user)`; the markers exist because the replayed step 3 says they do.

## Who wrote what

The defects, their signatures and their detection scripts were written by an isolated
designer who had not read the primer. Their class was set by three cold reviewers, and
the judge criteria by a fourth isolated author. The transcript digests of the designer
and the criteria author are in `defects/transcript-digests.txt`, and the isolation check
(I9) reads them. The markers and this README were written by the session that runs the
method, which is allowed: they describe the workspace, not the defects.
