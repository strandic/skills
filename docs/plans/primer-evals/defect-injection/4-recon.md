# Step 4 — recon

Nine real harness runs, three isolated authoring agents, thirty-nine isolated reviewers,
and sixty-five judge calls, all against the real harness, the real CLI and the real
fixture. Spike reverted; corrections kept; the instrument kept, since it is the run's
input and not its throwaway (0-plan.md D9).

**Total spend: about $17 API-equivalent** (subscription-metered; no money moved): harness
runs $5.10, judge probe $4.85, authoring and review agents about $7 by token count.

Every seam below was probed by running. Where a claim rests on reading rather than
execution it says so. The two findings that matter most are at the end, because they
change what the plan asserted and re-open gate 0.

## Seam 1 — the transcript resumes and the treatment does step 4

```bash
CLAUDE_CODE_WALNUT_SPIRE=1 CLAUDE_CONFIG_DIR=~/.claude-personal ~/.local/share/claude-pinned/2.1.250 \
  plugin eval . --eval-dir evals/seven-steps-primer-defects --ablation none --runs 1 \
  --model sonnet --judge-model opus --threshold 0.6 --scaffold --no-publish --keep-temp \
  --case step4-seeded-defects --allow-tools Bash Edit Write
```

**Observed.** On the marked, un-seeded skeleton: 28 turns, 154 s, $0.54. The Skill tool
fired once (`current:seven-steps-primer`). The run implemented on the markers, ran the
suite, drove the service in-process with `node -e` scripts that `require('./server.js')`
and `listen(0)`, wrote a step-4 table of seams with commands and observed mechanisms,
and closed on **Gate 4.** It kept the implementation and reverted only a debug hook.
The trace (124 lines) carried every tool result as JSON-escaped text (`\n` inside strings),
did not carry the replayed history (zero hits for any record's text), and carried the
loaded skill body inside the Skill tool result ("Recon is a run, not a read").

**Resolution.** The replay design holds. Fact 2's open half is settled: a signature that
arrives in a tool result is matchable by a regex over `trace`, and the replayed history
cannot produce a false positive. The treatment's way of running is in-process, not
`node server.js`; the `service-started` guard now matches both shapes (seam 7).

## Seam 2 — both arms on a replay case, through the runner's `--suite` path

```bash
EVAL_CLAUDE_BIN=~/.local/share/claude-pinned/2.1.250 CLAUDE_CONFIG_DIR=~/.claude-personal \
  node scripts/run-evals.mjs --suite evals/seven-steps-primer-defects --condition treatment --runs 1 --keep-temp
```

**Observed.** The runner spike resolved `--suite`, ran the drift check against the second
suite's own treatment mirror, digested that suite, read the declared `evidence: delta` /
`ablation: with-without` pair and built one tag-filtered invocation (`--tag outcome
scored`) carrying `--keep-temp`. The harness printed "Ablation: 2 arms × 1 case (2 runs)".
The record landed at the suite's own `results/treatment.json` with `ablations:
{step4-seeded-defects: with-without}`. With-arm: 31 turns, $0.74, skill fired, body in the
trace, a two-seam report, spike reverted by `git checkout`. Without-arm: 20 turns, $0.38,
no Skill call at all, implemented the feature, ran the suite, replied "Done." The
`skill-fired` grader appeared in the with-arm as `withOnly: true, scored: false` and was
absent from the without-arm's grader list, as the reference says.

**Resolution.** Fact 4 holds by execution: an explicit `--ablation with-without` runs both
arms on a `history_file` case. The `none` column is what D1 said: no instruction text, a
gated transcript, an agent that implements. The runner changes are the step-6 shape.

## Seam 3 — the readiness test: the skill fires in every with-arm run and no without-arm run

**Observed.** Across the three treatment runs (seams 1, 2 and 6): with-arm Skill tool use
3 of 3, the loaded body present in all three traces; without-arm Skill tool use 0 of 2.
Placebo (seams 5 and 6): with-arm 2 of 2, without-arm 0 of 1 (the other without-arm run
died on the session limit, seam 9).

**Resolution.** The instrument-readiness test in D1 passes on the neutral seed line and
prompt. No direction is withheld on this ground.

## Seam 4 — the judge in print mode (the open seam of step 2)

```bash
printf '%s' "$USER_PROMPT" | CLAUDE_CONFIG_DIR=~/.claude-personal ~/.local/share/claude-pinned/2.1.250 \
  -p --model opus --system-prompt "You are a strict, terse evaluation judge for coding-agent traces." --output-format json
```

**Observed.** Print mode accepts a separate system prompt (`--system-prompt`) with the user
prompt on stdin and answers with one word in `result`; `total_cost_usd` is reported. Cost
per call about $0.075 (65 calls, $4.85), which is seventeen times Tier 1's measured
harness judge rate: print mode carries the CLI's own context and the harness's judge call
does not. Three consecutive calls returned "Not logged in · Please run /login"
(`is_error`, zero cost, 220 ms) within one minute, then every combination of model,
system-prompt flag, stdin or argument, text or JSON returned normally and never failed
again. The harness runs were logged in throughout.

**Resolution.** `AskJudge` is resolved: the pinned CLI in print mode, system prompt
separate, JSON output, one retry on `is_error` before reporting `unclear`. The offline
probe is priced apart from the sweep; the sweep's judge cost is measured from the
records' `judgeCostUsd` once llm graders run, not from print mode.

## Seam 5 — the placebo on the transcript

```bash
EVAL_CLAUDE_BIN=… node scripts/run-evals.mjs --suite evals/seven-steps-primer-defects --condition placebo --runs 1 --keep-temp
```

**Observed.** Un-seeded skeleton, with-arm: 12 turns, $0.29, skill fired, no Bash beyond
`ls`, `cat`, `find`. A read-through: it checked every inventory value against the files,
found three things "that change what's already been said", and asked the placebo's setup
questions. Not a back-fill. Seeded fixture, with-arm (seam 6): 9 turns, $0.20; it asked
the setup questions (record home, one file or many, per-gate commits) and stopped before
its read-through, "once you confirm". So the placebo's step 4 happens in one run of two;
the other run stops on the setup questions the transcript never answered.

**Resolution.** D1's transcript-superset held: neither placebo run tried to back-fill
steps 1 to 3. A new variance source is named for the registration: the transcript's step 0
names no record home, and both documents' setup sections ask for one. Whether to name a
home in record 1 is a gate-0 question re-opened below; it is shared fixture state and
changes both conditions alike.

## Seam 6 — the seeded fixture: treatment and placebo, both arms

Same runner commands as seams 2 and 5, after the twelve defects and the ledger were copied
into `fixtures/notesvc-seeded/`.

**Observed.** Treatment with-arm: 26 turns, 298 s, $0.65. It built the spike, ran the
suite, drove five seams of the feature itself (per-caller isolation, chain reorder, window
rollover on a real 61-second clock, eviction, an unauthenticated flood), reverted, and
reported "No defect required correcting an upstream artifact". **No planted signature
appeared in its trace, and its report names no planted defect.** Without-arm: 17 turns,
$0.34, implemented, no signature. Placebo with-arm: stopped on setup questions (seam 5).
Placebo without-arm: 17 turns, $0.35, implemented, no signature.

**Resolution.** This is the first of the two findings that re-open gate 0. See *The
defects the run met* below.

## Seam 7 — the `service-started` guard

**Observed.** The first treatment run matched the placeholder pattern only because a
`grep` command contained the word `TODO`. Its real service use was `node -e "… require
('./server.js') … listen(0 …)"`. The anchored pattern
`"command"\s*:\s*"(?:(?:[^"\\]|\\.)*[;&|]\s*)?(?:[A-Z_]+=\S+\s+)*node\b(?:[^"\\]|\\.)*server\.js`
was tested against eleven command shapes (five must match, six must not) and holds:
`node server.js`, `PORT=0 node server.js &`, a `node -e` script that requires `server.js`,
and `cd x; node server.js` match; `node --test`, `grep "node server.js" README.md`,
`cat server.js` and `ls; grep node server.js` do not.

**Resolution.** The grader carries the pattern and nine probes. A defect that fires only
in the `require.main` startup block is reachable by `node server.js` and not by the
in-process shape; the grader says so.

## Seam 8 — the seeded scaffold

```bash
cd "$(mktemp -d)" && bash <worktree>/evals/seven-steps-primer-defects/fixtures/notesvc-seeded/scaffold.sh
```

**Observed.** Five files, `.git`, `.integrity`; no `defects/`; `shasum -c .integrity`
passes; `node --test` 10 of 10. The service binds `PORT ?? 0` and prints the port.

**Resolution.** Holds. Every `detect.sh` starts the service on port 0 and reads the port
from stdout, so sequential runs cannot collide.

## Seam 9 — the session limit, and what a killed run looks like

**Observed.** During the placebo probe the without-arm run died: `error: exit 1: You've hit
your session limit · resets 12:50am`, 7 turns, $0.09, and the harness still graded it
(score 0.50, both structural graders evaluated). The designer agent died on the same limit
after writing its ledger; a second designer died on it at its first turn. The runner
recorded the placebo sweep with `exitCode 1` and kept the document.

**Resolution.** A limit-killed run is a run with a non-null `error` that I1c does not
refuse, which is exactly the case D4's error count exists for. The sweep must be started
at the top of a limit window and the count of errored runs published beside the scores.
A limit hit mid-sweep is a stop, not a number.

## The instrument, as built

- **The ledger.** Twelve defects from one isolated Opus designer (28 tool uses, no path
  under the repository in any call, no git; transcript digest `91d2f12689938090`). Every
  `diff.patch` applies alone to the pristine copy and all twelve together reproduce the
  seeded service. Mechanical acceptance, all twelve: suite green with everything present
  (10 of 10); every `detect.sh` red on seeded, green on clean, and still red after the
  reference per-user implementation (whose own suite is 11 of 11); every signature is in
  the allowed alphabet, at least six characters, not a bare status code, and a literal in
  no shipped file; `behaviour.md` and `cause.md` name no file or function; every file
  present. `detect.sh` takes the service root as its argument and defaults to its own
  ledger's service, which my first acceptance pass missed and reported every script as
  firing on the clean copy.
- **The criteria.** One isolated Opus author (6 tool uses, nothing outside its directory;
  digest `aa1eb06f85313e8d`) wrote twelve rules from `behaviour.md`, `cause.md`, the
  signature and the captured detect output. The judge probe: 59 of 60 verdicts as
  registered; the one failure, the body-type rule passing its neighbour's reply, went
  back to the author with the probe result and nothing else and now passes all five.
- **The reviewers.** Thirty-nine isolated Sonnet readers (237 tool uses, none outside
  their directory, none running code). Both tallies are in each ledger entry.
- **The transcript.** Eight records: the Tier 1 six rewritten as a superset of both
  methods' steps 1 to 3, plus gate 2 cleared and the markers placed. Record 0 and the
  prompt carry Amendment 2's line.
- **Vocabulary.** The plan's provisional word list over 86 ledger, probe and brief files:
  zero hits. The human's list at step 5 is the real check.

## The defects the readers saw

The registered rule: reviewed alone, named by none is run-only, by two or more is
read-visible, by exactly one is dropped.

| defect | intended | alone | in company | class by the rule |
|---|---|---|---|---|
| body-buffer-shared | run-only | 3/3 | 3/3 | read-visible |
| body-limit-too-small | run-only | 3/3 | 3/3 | read-visible |
| body-type-passthrough | run-only | 3/3 | 0/3 | read-visible |
| clienterror-code-leak | run-only | 3/3 | 0/3 | read-visible |
| echo-bypass | read-visible | 3/3 | 3/3 | read-visible |
| method-gate-not-post | run-only | 3/3 | 1/3 | read-visible |
| not-found-reflects-url | run-only | 2/3 | 3/3 | read-visible |
| owner-case-folded | run-only | 3/3 | 3/3 | read-visible |
| owner-prefix-leak | read-visible | 3/3 | 3/3 | read-visible |
| request-id-echo | read-visible | 2/3 | 0/3 | read-visible |
| title-coerced | read-visible | 2/3 | 0/3 | read-visible |
| url-decoded-path | run-only | 3/3 | 3/3 | read-visible |

**Every defect is read-visible.** Three cold readers with one defect planted in a
300-line service named it in 34 of 36 reads, including the concurrency bug the designer
meant as the hardest. The run-only class is empty. The plan's minimum of four is
unreachable, and under D3 as written the experiment does not proceed.

In company the picture is different: four defects were named by nobody, one by a single
reader. Attention divides, as D3 predicted. But "missed by cold readers when eleven other
defects compete" is a weaker property than "invisible to a read", and it is not what the
ceiling sentence certifies.

## The defects the run met

The treatment's step 4 on the seeded fixture exercised the feature's own seams and none
of the twelve defects. That is not a failure of the run; it is a contradiction in the
plan. D3 says "the defects sit on the seams that change crosses, so a spike of the feature
meets them". The round-two fix says "defects stay clear of the code the spike rewrites".
On this service those are the same code: the throttle, the chain order, the quota route.
Pushed off the rewritten code, the defects sit on paths a faithful step-4 run has no reason
to take: a non-string body, a malformed request line, a client-sent request id, a
percent-encoded target, a prefix-sharing owner, two posts at once. Every one needs an
input the feature's spike does not send. And every one must keep `node --test` green,
which already exercises the feature's ordinary path with a real HTTP client, so a defect
that fires on that path is a defect the tests would catch. At this fixture size the two
constraints leave almost nothing between them.

So the expected treatment score on any run-only group is near zero, and so is every
control's. The headline row would be a difference of zeros.

## Artifacts corrected upstream

| Defect | Owning artifact | Gate |
|---|---|---|
| "A floor of exactly zero" is unreachable in floating point; identical runs give 2e-16 | 0-plan D4, 2-interfaces (`ComputeGroupFloor`, `ComputeGroupContrasts`), types (`Contrast.floor`) | 0, 1, 2 re-open on one word: at or below `NOISE_EPSILON` |
| The treatment runs the service in-process; the guard assumed `node server.js` | 0-plan D4, the `service-started` grader | 0 re-opens; corrected in place |
| `test/notes.test.js` carries a marker line, so it is not byte-identical to the clean fixture's | 0-plan D3 acceptance | 0 re-opens on one clause: identical apart from marker lines |
| The transcript names the marker token in record 7 | 3-todos, `case.yaml` comment | — (no grader greps the transcript) |
| The neutral line invites a filesystem search; one placebo run's `find /` listed the shipped skill, the Tier 1 suite and three other installed copies of the primer, and read none of them | 0-plan D1, D3's trace check | 0 re-opens: the trace check would refuse that run; the registration must say whether refused runs are replaced or reported |
| The transcript names no record home; one placebo run of two stopped on the setup questions | 0-plan D1 (the transcript) | 0 re-opens: name a home in record 1, or accept the variance |
| The alone-tally protocol certifies nothing as run-only on this fixture | 0-plan D3, D4, D5, D6 | **0 re-opens: a design decision, below** |
| A faithful step-4 run does not meet defects placed off the rewritten code | 0-plan D3 (both clauses), Appendix A | **0 re-opens: the same decision** |
| `AskJudge` | 2-interfaces (seam table), `ledger.mjs` marker | 2 closes: resolved |
| The suite list for the tests | 3-todos, two markers | 3 closes: enumerate `evals/*/PRE-REGISTRATION.md` |
| Caps and the runaway ceiling | `case.yaml` | set from the measured runs: `max_turns` 60, `timeout_seconds` 900, ceiling 2 × $0.74 × runs × 2 |

## What gate 0 has to decide again

The two bold rows are one problem: on a service small enough to read in full, "a defect
a run reveals and a read does not" is not a class the reviewers can certify, and the
feature's own recon does not reach the defects that were placed to survive it. Four ways
forward, with what each measures and costs. The plan's directions are frozen; whichever
is chosen, the registration is written from the corrected plan, not from this list.

1. **Register one group over all accepted defects, no run-only class.** The question
   becomes: does the primer's step 4 report more planted defects than the placebo's
   read-through, the one-sentence run instruction, and no instruction? The placebo is the
   read; the treatment is the run; the difference row goes. The honest direction against
   the placebo is what the evidence now says, not what the method claims: the placebo
   reads the neighbourhood and named things on the un-seeded skeleton; the treatment ran
   the feature and named nothing on the seeded one. Cost as planned (about $60 to $135).
   What it buys: a published measurement of the method's central claim on one fixture,
   with the sign the evidence predicts written down before the run.
2. **Take the in-company tally as the class.** Four defects nobody named in company become
   the run-only group, seven the read-visible group, one dropped. Meets the minimum on
   paper. But the four are a non-string body, a malformed request line, a client-sent id
   and a non-string title, none on the feature's path, so the treatment's expected score
   on that group is zero and the headline is a difference of zeros. Not recommended.
3. **A second designer round with a different constraint:** defects on code the feature
   calls at runtime (`withIdentity`, `withJsonBody`, `sendJson`, the store) that fire only
   under inputs a real client sends and the tests do not: two callers at once, a header
   the tests never set, a body the tests never post. The designer already tried; the
   concurrency bug it planted was named by every reader. Cheap to try once more (about
   $3 and an hour), unlikely to change the picture, and it does not fix the reader
   problem.
4. **A larger fixture.** Run-only is a property of code a reader cannot hold in one pass.
   A service of a few thousand lines, several modules, where the feature's runtime path
   crosses shared code with room for a defect to hide. That is a feature of its own, and
   this bean is not it.

Recommendation: option 1, with the direction against the placebo registered as the
evidence says, and the in-company tallies published as description beside the numbers.
It answers the backlog's question on this fixture and stops the experiment claiming a
class it cannot certify.

## Not probed, and therefore not claimed

- Two more treatment runs for a five-of-five readiness count: three of three is what D1
  asked after round two, and no further harness money was spent once seam 6 showed the
  design question.
- The merger's group scoring on a real sweep record: exercised on the recon document
  (extract, difference, counts, floor, contrasts, the zero-floor case) and on synthetic
  numbers, not on three records. The spike is reverted; its diff is in the session's
  scratch directory, outside the repository, for step 6 to consult and not to copy.
- The read-only diagnostic, `step4-read-only`: not run. Its `history_file` reuse is still
  the copy-or-path question from step 3.
- Judge agreement with a human: no verdicts to label until a sweep runs.

## Process findings, for the record

- A workflow subagent's transcript file lagged its work by more than twelve minutes. I
  read that as a hang, stopped a second instance, and reset the working copy while the
  first was still running. It survived because it wrote per-defect patches against the
  pristine copy. Check activity in the scratch directory, not transcript growth.
- The session limit ended two agents and one harness run. Long authoring runs and sweeps
  belong at the start of a limit window.
