# Step 2 — interfaces

Artifact: `scripts/interfaces.mjs` — 24 `@callback` signatures, no bodies.
This document carries the intent; the file carries the contract.

## The one decision

**Everything that decides something is pure. Everything that touches the world
takes a named handle as its first parameter.**

That line is drawn where it is because of what this suite is for. It exists to
produce numbers that survive a skeptical reader, and every judgement it makes —
which flags go on the command line, which runs count toward a score, what a
contrast is worth against the noise floor — is a place where a quiet mistake
produces a *plausible number* rather than an error. Pure functions make each of
those assertable in a test that spawns nothing and touches no disk.

The corollary matters as much: the effectful functions are then thin enough to be
obviously correct by reading, because all they do is move bytes.

## One sweep, end to end

```mermaid
flowchart LR
  INV["EvalInvocation<br/>(condition · runs · models · tools)"]

  INV --> SEL["SelectCondition"]
  SEL -->|CopyDirectory| COND[("_condition/<br/>copy of conditions/&lt;id&gt;")]

  INV --> ARGV["BuildEvalArgv<br/><em>pure</em>"]

  ARGV --> RUN["RunSweep"]
  COND --> RUN
  CMD["EvalCommand<br/><strong>OPEN SEAM</strong>"] -.-> RUN

  RUN -->|SpawnCapture| CLI["claude plugin eval"]
  CLI --> DOC["aggregate-result.json"]
  LOC["ResultsLocator<br/><strong>OPEN SEAM</strong>"] -.-> DOC
  DOC --> PR["SweepResult"]

  classDef seam stroke-dasharray: 4 3;
  class CMD,LOC seam
```

The condition is **not** a command-line flag. The harness discovers the plugin from
the path it is pointed at, so choosing a condition means putting that condition's
directory at `_condition/` before the process starts. Every case names that one
fixed path, which is what lets a single set of cases serve three conditions.

It has to be a real copy. The harness's plugin ownership check rejects a path that
"is a symlink (or can be read as a link)" (`harness-facts.md` #2), so the tidier
symlink version fails at the point of use rather than at the point of writing.

## Three sweeps into one comparison

```mermaid
flowchart TD
  T["sweep · treatment"] --> MP
  O["sweep · oneliner"]  --> MP
  P["sweep · placebo"]   --> MP

  MP["MergeSweeps<br/><em>pure</em>"]
  PREREG["PreRegistration<br/>(expected direction)"] --> MP
  PROV["Provenance<br/>(shas · models · version)"] --> MP

  MP --> DR["deltaRows"]
  MP --> CR["capabilityRows"]
  MP --> BS["baselineSpread"]

  DR --> FMT["FormatComparison<br/><em>pure</em>"]
  CR --> FMT
  BS --> FMT
```

Each sweep yields a `with` arm and — under `with-without` — its own `without` arm
of stock Claude Code against identical cases. Three sweeps therefore
produce three independent baselines, and **their spread is the noise floor,
measured for free**. `FormatComparison` prints it beside the contrasts because a
contrast smaller than the spread is not a finding.

`deltaRows` and `capabilityRows` leave `MergeSweeps` as separate arrays rather
than one list with a discriminator field, so combining them downstream takes a
deliberate concatenation instead of a forgotten filter.

`ComputeContrasts` reads expected direction from the pre-registration and never
infers it from the numbers in front of it. That is the entire value of having
registered it.

## The three open seams

Each is an injected dependency that reads as clean precisely because it defers the
question of who supplies it. None may reach implementation unanswered.

### `EvalCommand` — what to actually execute

Two facts make this unresolvable by hardcoding:

- The executable is `claude` on a stock install, but a differently-named wrapper
  wherever `CLAUDE_CONFIG_DIR` is split across profiles — as it is on this machine.
- `plugin eval` is early access. An account without the server-side flag needs
  `CLAUDE_CODE_WALNUT_SPIRE=1` in the environment, or every invocation exits 1
  before running a single case. This account is not flag-enabled.

A committed script can hardcode neither without breaking on the next machine.
Candidates: an env var the runner reads, a gitignored local config, or required CLI
flags. **The variable must not go in the repo's `.claude/settings.json`** — project
settings are untrusted before the workspace trust step and this one is not
allowlisted.

### `ResultsLocator` — where the document landed

The default is `<plugin>/<eval dir>/results/<timestamp>/`, but `--eval-dir` changes
it and `--output-dir` overrides it again, and the documented rule branches on
whether the target is an installed plugin or a path. Which applies to this suite's
shape is unverified. `--json <file>` probably sidesteps the question by naming the
destination outright — but that is a guess until a run proves it. Recon target.

### `PreRegistrationDigest` — blob sha or content hash

The two disagree exactly when the working tree is dirty, which is the case that
matters: a digest of a modified-but-uncommitted pre-registration records a value no
reader can check out. The real question underneath is whether a dirty
pre-registration should hard-fail the run, and that is policy rather than
implementation.

## Deliberately absent

- **No orchestrator signature.** What sequences the three sweeps is step 6's
  business; naming it now would fix an execution order this step has no evidence
  for.
- **No error type.** `RunSweep` returns a `SweepResult` with an exit code rather than
  throwing, because exit 1 means "a case scored below threshold" — a result, not a
  failure. A thrown error here would erase the distinction.
- **No streaming.** `SpawnCapture` buffers stdout to a string. The child can emit
  up to 64 MiB under `--json`; fine at this suite's size, wrong if it grows. A known
  simplification, not a seam.

## Correction to step 1

Step 2 surfaced two types step 1 missed, now added to `types.mjs`:

- **`EvalInvocation`** — everything that varies between sweeps. Without it
  `BuildEvalArgv` takes a dozen loose parameters.
- **`SweepResult`** — what a sweep yields, including the exit-code semantics above.

Corrected in place rather than logged and deferred. This changes what step 1
asserted, so gate 1 re-opens for those two additions.
