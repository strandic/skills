# Tier 2 backlog — outcome evals for `seven-steps-primer`

Not part of the current build. Captured so the design survives a context compaction.

**Why Tier 2 exists.** Tier 1 measures what the agent *does* — it produces one
step's artifact, it stops, it triages correctly. That is a **compliance** measure,
and its ceiling (D7 in `0-plan.md`) forbids any claim about the software that comes
out the far end. Tier 2 is the only thing that can say *this method produces better
software*, and it does so by never grading against SKILL.md at all.

**The trap Tier 2 is built to escape.** Graders written from the skill text are the
skill with a `type:` field bolted on: the rubric says "score 0 if it self-certifies",
the with-arm emits skill vocabulary, the judge scores 1. Every instrument below is
authored by someone who has not read SKILL.md, or is deterministic.

---

## O1 — Artifact Sufficiency Transfer *(the spine)*

The skill states its own falsifiable test, and this is it. SKILL.md: planning is
finished only when implementation is **mechanical** — "the feature buildable from
the artifacts alone". And step 6's cold fork: a fresh context carrying only the step
artifacts + invariant checks, "so the artifacts alone drive the build and **the
method itself is validated**". Measure exactly that.

**Stage A — generation (unscored).** Same feature request, same fixture, five arms:

| Arm | Notes |
|---|---|
| `primer` | gates auto-cleared by a scripted proceed |
| `oneliner` | "Present a plan and wait for my explicit approval before editing any code." |
| `generic` | effort-matched process doc, ~same length ("plan carefully, test, ask when unsure") |
| `none` | no instruction |
| `placebo` | same seven gates, arbitrary contents |

Output per run: a `docs/plans/` bundle + in-source markers. **No scores in stage A.**

Note the reversal: baking the gates' approval into the prompt is *invalid* as a gate
test (Tier 1's rejected S3) but perfectly valid here, because the gate is not the
measurement — the artifacts are.

**Stage B — the measurement.** Hand each bundle to a **fresh, method-blind
implementer**: *"Implement this feature using only the documents in this directory.
Do not ask questions."* Then grade with instruments that never saw the skill:

- **`O-hidden-acceptance`** — a held-out suite written **before** the eval by a
  feature specifier, shown to no arm. **Pass rate is the dependent variable.**
- `O-build`, `O-suite-still-green` — deterministic.
- `O-improvised` — count of `TODO`/`FIXME`/"assumed" in the *implementer's* output.
  This measures "was it mechanical?" directly, which is the method's central claim.
- `O-turns`, `O-cost` — efficiency.

Compliance drops out entirely. A skill producing beautiful gate prose and
insufficient artifacts loses. A one-liner producing sufficient artifacts wins, and
deserves to.

**Power.** Continuous DV over ~20 hidden tests, per-run SD ≈ 0.2, n=20/arm →
**MDE ≈ 0.18** in pass-rate terms. Real, and meaningful at that size. But the true
n for a generalisation claim is **features, not runs**: 2 features is too few, 5–6
is defensible.

**Cost.** Hidden acceptance suite ≈ **1 human-day per feature** and there is no way
around it — no outcome measure without an outcome spec. Stage A ≈ 100 planning runs
($150–400, recon-heavy). Stage B ≈ 100 short implementer runs ($100–250).
**≈ $250–650 + ~3 human-days for 2 features**; ~$1–2k and a week for 5–6.

---

## O2 — Defect-injection / recon yield *(best evidence per dollar)*

Isolates the method's most distinctive and most falsifiable claim — *"recon is a
run, not a read"* — with **zero compliance rubric**.

Fixture seeded with N latent defects **placed by a method-blind author**, split by
discoverability:

- **readable** — visible by tracing the source
- **run-only** — an async race, a library whose runtime behaviour contradicts its
  types, an env-dependent path, middleware ordering that only manifests under
  concurrency

**DV = recall of the run-only defects.** Graded by regex on defect-specific
identifiers, or by a judge handed *the defect list* — never the skill.

Arms: `primer` · `oneliner` · "be thorough" · `placebo`. 4 arms × 15 runs ≈ **60
runs, $80–200 + ~0.5–1 human-day**.

Reading it: run-only recall of .70 vs .65 for a one-liner means the recon prose does
no work. .70 vs .20 is a genuine finding.

**This replaces, rather than extends, a Tier 1 case I rejected.** An earlier design
had a "crown jewel" case with a type mismatch planted exactly where the method looks.
That measures hit rate on planted evidence and can never measure miss rate. A fair
fixture puts defects where the method *won't* look too.

---

## O3 — Component ablation *(near-free, and the most practically useful result)*

Tier 1's ladder (none / one-liner / placebo) tells you *whether* the method works.
Component ablation tells you **which parts of it to keep**: strip only recon, only
triage, only the failure-modes section, and re-run.

That is the result you cannot get any other way, and it is the one that would
actually change what ships. Cheap once O1 or O2 exists — it reuses their harness and
only varies the arm.

---

## Reporting rules — the conditions that make any of it credible

1. **Pre-register** rubrics, thresholds, arms, and expected direction as a committed
   file with a git hash **before any run**. Tier 1 already commits to this (D6);
   Tier 2 inherits it.
2. **Report per-case scatter, never means alone.**
3. **Report judge–human κ** on a labelled subsample. A judge with no agreement
   statistic against ~30 human labels is an unvalidated instrument, and every
   `llm` grader leans on it.
4. **Publish the placebo arm** alongside the treatment, always.
5. **Never typeset predicted numbers like results.** A table of estimates formatted
   identically to measurements will be screenshotted and quoted as measurement.
6. **Pin and record the model.** Scores are not portable across models or harnesses;
   re-evaluate whenever either changes. Anthropic's own guidance is to test across
   Haiku / Sonnet / Opus — and when you do, *the spread is the signal*, so do not
   average it into one number.

---

## Deferred: the user simulator (3–5 days)

**The one thing it buys that nothing else can: gate re-opening as a lived sequence.**
Step 4 finds a defect → the agent corrects step 1's artifact in place → that gate
re-opens → the human re-clears it → *then* the revert lands. Three reactive turns
whose content depends on what the agent found. No fixed `history_file` replay can
produce it, because you cannot script the human's response to a defect the agent has
not discovered yet.

**Cost breakdown.** Session driver + resume (~0.5d) · simulator prompt and the
persona discipline to stop it being a sycophant that proceeds on everything (~1d,
and this is the hard part — **a lenient simulator silently converts a gate eval into
a baked-approval eval**) · stop-detection heuristic (~0.5d) · grading and aggregation
(~1d). Then you have re-implemented for free what the built-in harness already gives:
the no-plugin baseline arm, per-run isolation, credential lifecycle, MCP mocks, the
results schema, the HTML report.

**Prior art worth stealing before building anything:**

- **τ²-bench** (`sierra-research/tau2-bench`) — the simulator **does not see the
  agent's tool calls**, modelling real information asymmetry. Scores final **database
  state against an annotated goal state** — objective outcome, not a judge.
- **SimulatorArena** (arXiv 2510.05444) — **persona-conditioned** simulators reach
  Spearman ρ ≈ 0.7 with human judgments; unconditioned, the correlation collapses.
  ρ = 0.7 is "useful proxy", not "replaces humans".
- **`pass^k`, not `pass@k`** — all k attempts succeed. The right primitive for a
  method: *a skill that helps 60% of the time is not a workflow you can hand to a
  colleague.* No skill-eval framework found reports it.
- **Known noise floor:** in τ-bench-Airline, **11/50 (22%)** of conversations had the
  simulator behaving out of line with its own instructions. The simulator is itself a
  noise source and needs its own eval.

Cheaper 80% if the full build is not justified: a **two-case chain** where case A's
recorded output becomes case B's `history_file`, refreshed by hand when the skill
changes. Ugly, and a fraction of the cost.

---

## What no eval can show, at any budget

Keep this list in the README. It is the difference between a credible result and an
advocacy document.

1. **The rubber-stamp gate.** The skill's first-named failure mode lives entirely in
   the human. The gate is testable; the *review* is not. This is the largest hole and
   it is unclosable — and it is exactly why D5 says not to run the method under
   urgency: a hurried reviewer does not make the gates expensive, it makes them fake.
   Worse, it inverts the optimisation target — if reviewers stamp without reading, a
   method that maximises gate count is actively *harmful*, and a compliance suite
   would score it highest.
2. **Gate re-opening as a lived sequence.** See the simulator section. Fixed replay
   cannot branch on a defect the agent has not found.
3. **Step 7 entirely.** "Invariants hold in production", "does something real no
   existing tool could", live data. There is no production in a throwaway sandbox.
   (Also: the Artifact tool is unavailable inside eval runs, so any deliverable that
   becomes an artifact is ungradeable.)
4. **That the cold fork succeeds.** You can test that step 6 *asks* the cold/warm
   question. Proving cold *works* is a two-session experiment — O1 is the partial
   proxy, and it tests the artifacts rather than the skill.
5. **Compounding value.** Whether seven gated steps beat one-shot needs a full
   multi-turn run *and* a feature-quality metric. Both out of reach; the second is
   high-variance even with unlimited turns.
6. **Long-horizon gate integrity.** Whether gates still hold at step 6 after five
   prior gates and a large context. Seeding step 6 via `history_file` gives you the
   *content* of that position but not its *pressure* — a replayed 40k-token history
   is not the same object as one the agent built itself.
