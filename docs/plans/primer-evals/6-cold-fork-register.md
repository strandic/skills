<!-- Generated from the step-6 cold-fork run; regenerate by re-running the fork. -->
# Cold step-6 insufficiency register

**76 insufficiencies** from ten fresh contexts building the suite from the
committed artifacts alone: **6 blocking · 45 material · 25 cosmetic**.


## Blocking

### evals/seven-steps-primer/fixtures/notesvc/src/middleware/index.js — does the fixture already throttle?

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** The fixture marker says the chain is "the middleware chain rate limiting would slot into", which reads as "no limiter exists yet". But looks-trivial-is-structural/prompt.md requires "the rate limiter is off by one" and triage-skip-oneliner/prompt.md requires "a typo in a rate-limit error message" — both presuppose one. No artifact reconciles the two, and 0-plan.md calls that pair "the strongest thing in the suite".
- **Invented:** The fixture ships a GLOBAL fixed-window limiter at module scope (30 req / 60 s, one counter for the whole process), so "add per-user rate limiting" is the requested change and cases 2 and 3 have something real to point at. The off-by-one is `hitsInWindow > maxRequests` checked before the increment — `>` -> `>=` is a correct one-line fix that leaves the real defect untouched, which is exactly what case 2 needs. The typo is `plese` in the 429 message, and no test pins either, so case 3's fix stays a genuine one-liner.
- **Owning artifact:** 0-plan.md, the case table (§ The cases) — it names the fixture feature but never states the fixture's starting condition; the fixture markers in src/middleware/index.js inherit the gap.

### evals/seven-steps-primer/fixtures/notesvc/scaffold.sh — where in the workspace the fixture lands

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** Nothing states the scaffolded layout. step3-markers-in-source/graders/markers-in-source.md targets `fixtures/notesvc/src/routes/notes.js` and carries its own marker asking someone to "confirm the {source: file} target resolves against the sandbox workspace path, not the repo path" — but the answer depends on a scaffold decision no artifact makes.
- **Invented:** The scaffold copies to the workspace ROOT, so the workspace is the service the way a real checkout would be. Consequence, stated in the fixture README: every `{source: file}` grader path must be `src/routes/notes.js`, NOT `fixtures/notesvc/src/routes/notes.js`. The grader as written cannot match. The alternative — copying to `<workspace>/fixtures/notesvc/` — keeps the grader paths but puts the agent's own service under a directory called `fixtures`, which telegraphs the eval.
- **Owning artifact:** step3-markers-in-source/graders/markers-in-source.md (and every other {source: file} grader); the layout ruling belongs with the scaffold in 0-plan.md § Test strategy.

### conditions/placebo/SKILL.md and conditions/oneliner/SKILL.md, frontmatter `name:` (line 2)

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** The committed frontmatter named the skills `placebo` and `oneliner`. harness-facts.md #22 neutralises only the *plugin* name (every condition is copied to `_condition/`, so all three present under the same plugin name) — it says nothing about the SKILL.md `name:` field, which still reaches the subject model's context. Nothing in the artifacts rules on whether the control's own name may announce its experimental role, yet 3-todos.md requires that 'a placebo the model can tell is nonsense stops being a placebo'.
- **Invented:** Renamed to `change-control-protocol` and `plan-first` — plausible skill names that reveal nothing about the experiment. Directory names (the ConditionId keys used by types.mjs, build-conditions.mjs and run-evals.mjs) are untouched, so nothing downstream moves; the treatment already demonstrates a dir/name mismatch is tolerated (dir `_condition`, name `seven-steps-primer`).
- **Owning artifact:** 0-plan.md (conditions table) with harness-facts.md #22

### scripts/merge-results.mjs — parsePreRegistration()

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** types.mjs defines PreRegistration as structured data (conditions, cases, expectedDirection, threshold, models, runsPerCase, publishAllConditions) and interfaces.mjs hashes PRE-REGISTRATION.md as a file, but no artifact says how that markdown becomes that object. The committed PRE-REGISTRATION.md is prose-with-TODOs and carries no machine-readable form at all. Without this the merger cannot start.
- **Invented:** The machine-readable half lives in the first fenced ```json block inside PRE-REGISTRATION.md — one file, one digest, so the undertaking and the directions cannot move independently of the sha that records them. Every field is validated individually and a bad one names itself (a direction that is 0.42 rather than a sign; publishAllConditions turned into a toggle; a judge equal to the subject model).
- **Owning artifact:** docs/plans/primer-evals/1-types.md + evals/seven-steps-primer/PRE-REGISTRATION.md

### evals/seven-steps-primer/{gate-stop-step0,looks-trivial-is-structural,triage-skip-oneliner,triage-decompose-epic,control-all-steps}/case.yaml

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** Not one TODO marker asks for a case.yaml on the five prose cases, and the skeletons shipped without one — yet every prompt describes the notesvc fixture, every liveness grader needs files to read, and three cases grade `{source: file}` targets. context.* cannot be set from prompt.md, so without a case.yaml no case scaffolds anything and all five grade an empty workspace. 0-plan.md says only `<case>/case.yaml — only where context.* is needed`, without noticing that this is every case.
- **Invented:** Added a minimal case.yaml to all five: schema_version "1.1", name == directory name, context.scaffold_script, and an explicit `graders: []` (valid per fact #29 — writing it is not the same as omitting it, since the harness's own schema requires the key before the graders/*.md merge).
- **Owning artifact:** docs/plans/primer-evals/3-todos.md (the marker set) and 0-plan.md's layout

### scripts/run-evals.mjs sweep loop (results/ is the runner's output directory) ↔ scripts/merge-results.mjs:860

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** merge-results reads `<results>/drift.json` and treats its absence as DRIFTED, which voids the run under I2 and makes it refuse to emit any report. No artifact says who writes that record: build-conditions.mjs `check` only prints and exits, interfaces.mjs declares no handle or signature for writing it, and 3-todos placed no marker for it in any file.
- **Invented:** Nothing — I did not write drift.json, because it is outside every marker in my module and choosing an owner is a design decision (does the runner enforce drift and refuse to sweep, or merely record the verdict?). As things stand the pipeline cannot produce a report: run three sweeps, merge, and the merger refuses.
- **Owning artifact:** 2-interfaces.md § the three open seams / interfaces.mjs — a `WriteDriftRecord`-shaped handle was never declared, and 3-todos.md never marked a site for it


## Material

### evals/seven-steps-primer/fixtures/notesvc/README.md — does it ship into the sandbox?

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** The README's markers demand content written in eval vocabulary ("scaffold_script gets two minutes", "harness-facts.md #1", "the skill under test"), and the scaffold marker says only "copy this fixture into the empty sandbox workspace". Whether "this fixture" includes the README is unstated.
- **Invented:** The scaffold copies an explicit five-file list and withholds two: itself and README.md. An agent that reads "eval fixture" in its own working directory knows it is being measured, and every case then measures something else. The cost is that the sandbox workspace has no README at all — slightly unrealistic for a service repo. I chose that over either contaminating the run or inventing a second, in-world README whose content no artifact specifies.
- **Owning artifact:** harness-facts.md #1 / 0-plan.md — neither states a contamination rule for scaffolded content, though the whole four-condition design depends on the agent not knowing it is in an eval.

### evals/seven-steps-primer/fixtures/notesvc/scaffold.sh — "the checksum sentinel the absence graders fall back on"

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** No grader type can run a command after the run: the available types are regex, file_exists, tool_used and llm. So a checksum cannot fire as a grader, and nothing in the artifacts says what "the checksum sentinel" is mechanically or who checks it. 4-recon.md's confirmed mitigation is a different thing — a `{source: file}` regex over the source itself.
- **Invented:** The scaffold writes `.integrity`: one sha256 per scaffolded file, taken before the agent existed, in exactly the format `shasum -a 256 -c` and `sha256sum -c` accept (so no comment lines). It is positioned in the README as a post-hoc check for a human or a script over a retained workspace, with the in-run check remaining a content regex and the tool-name graders demoted to corroboration. Demonstrated to catch a `sed -i` edit. The residual gap — a mutation that leaves the regex's sentinel text intact — is stated in the fixture README rather than papered over, as 0-plan.md requires.
- **Owning artifact:** 0-plan.md § Test strategy (the Bash-mutation gap and its mitigation) — it names the fix as {source: file} but the fixture marker asks for a checksum, and the two are not the same instrument.

### the whole scaffolded tree — the literal marker token must not appear in it

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** step3-markers-in-source/graders/markers-in-source.md greps the fixture source for the literal string "TODO". If the shipped fixture contains one anywhere, that grader passes against a run that placed nothing — the exact vacuous-pass class 5-invariants.md polices. No artifact states the constraint.
- **Invented:** A hard rule: no scaffolded file contains the literal marker token, verified by grep and documented in the README. It also rules out the natural instinct to leave `// TODO: pagination` style comments around for realism, and it constrains the README (which discusses step 3's markers without ever writing the token, so the suite-wide enumeration grep stays honest).
- **Owning artifact:** step3-markers-in-source/graders/markers-in-source.md — the constraint is the grader's, but it lands on the fixture.

### conditions/placebo/SKILL.md § 'Where the artifacts live' — default `docs/plans/<change>/`

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** Two graders key on a literal path: gate-stop-step0/graders/plan-exists.md (`file_exists docs/plans/**/*.md`) and triage-skip-oneliner/graders/no-plan-artifact.md (its inverse). No artifact says the placebo must name the same default artifact home, but if it named any other directory it would score 0 on plan-exists for a purely locational reason and 1 on no-plan-artifact for the same reason — a delta manufactured by path choice rather than behaviour.
- **Invented:** The placebo defaults to `docs/plans/<change>/`, matching the treatment's `docs/plans/<feature>/` under the graders' `docs/plans/**` glob.
- **Owning artifact:** 0-plan.md § test strategy (the grader design), reflected in gate-stop-step0/graders/plan-exists.md

### conditions/oneliner/SKILL.md — the 13-word body

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** The one-liner is fixed 'verbatim and nothing else', so it can never name an artifact location. `plan-exists` therefore passes for the oneliner condition only if the model spontaneously writes a plan file to `docs/plans/**` unprompted. The artifacts never say whether the oneliner is expected to fail that grader by construction, or whether the grader should have been made path-agnostic so all four conditions are comparable on it.
- **Invented:** Left the control verbatim per the marker and added nothing. The consequence — one of case 1's five graders is structurally unreachable for one condition — is unmitigated and must be read as such when the columns are published.
- **Owning artifact:** gate-stop-step0/graders/plan-exists.md, and 0-plan.md's claim that 'prompt, fixture and graders are identical across all four' conditions

### conditions/placebo/SKILL.md § 'What the protocol needs from you' — the section occupying the treatment's triage slot

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** Two requirements collide in exactly this slot and no artifact rules between them: match the treatment's section count (its second section is triage: skip / decompose first / run it) while carrying 'none of the primer's substance'. Reproducing a skip-band hands the placebo the very substance cases 3 and 4 grade; writing 'apply it to every change however small' rigs both cases against it. Either choice silently sets the placebo's score on the matched pair the plan calls 'the strongest thing in the suite'.
- **Invented:** The slot is filled with a size-silent prerequisites section (a named reviewer · a title · a pace) that says nothing about when to skip, when to decompose, or how big a change must be. Silence is the neutral position: the primer speaks about triage, the placebo does not, which is a difference of substance rather than of shape — and it is neither engineered to hit the graders nor to miss them.
- **Owning artifact:** 0-plan.md (placebo row: 'same seven gates … arbitrary contents') and 3-todos.md ('match on length, section count and imperative density')

### conditions/placebo/SKILL.md — the fifth marker, 'decide whether to build the inverted variant'

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** 3-todos.md says the inverted-placebo idea is 'recorded in conditions/placebo/SKILL.md as a marker so the idea is not lost'. But that file is instruction text the subject model reads at run time: a TODO comment left in it would tell the model it is inside an experiment, which is the same contamination as naming the skill `placebo`. The artifacts give the idea a home that the file cannot safely provide.
- **Invented:** Removed the marker and did not build the variant (3-todos.md already rules it out of Tier 1). The idea survives in 3-todos.md's own prose; its proper home is docs/plans/primer-evals/tier-2-backlog.md, which I did not edit because it is outside my module.
- **Owning artifact:** 3-todos.md § 'The inverted placebo stays out of scope'

### conditions/placebo/SKILL.md — the whole file, as a matched artifact

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** 'Match the treatment on length, section count and imperative density' names three properties, defines none of them, and sets no tolerance. 'Length' could be bytes, words or tokens (they disagree here by 8 points because the treatment's vocabulary is longer); 'imperative density' has no operational definition anywhere in the artifacts; and there is no committed instrument that a future reader or CI could re-run to check the match still holds after either file is edited.
- **Invented:** Defined length as bytes + words + sentences, section count as `## ` headings + top-level bullets + sub-bullets, and imperative density as directive-sentence ratio plus directives per 100 words (directive = sentence-initial imperative verb or directive modal); adopted a ±10% tolerance and hit ≤7.9% on every metric. The measuring script is a throwaway in the scratchpad — nothing committed enforces this, so the match will rot silently the first time SKILL.md changes and the placebo does not.
- **Owning artifact:** 3-todos.md § 'The placebo has to match the treatment on more than shape'; the missing enforcement belongs beside scripts/build-conditions.mjs drift-check

### conditions/oneliner/SKILL.md frontmatter `description:` (100 chars / 17 words vs the treatment's 152 / 24)

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** The marker delegates the ruling but supplies no criterion beyond 'plausible enough that the model loads it', and 4-recon.md records that neither control was ever built or run — so nothing establishes what makes a description load-triggering. If a control never fires, its column measures 'the skill did not load', not the confound it was built to strip, and that failure is indistinguishable in the results from 'gating-as-an-idea does nothing'.
- **Invented:** Ruled that the oneliner's description MAY be shorter than the treatment's and must restate only the gating idea — padding it to 152 chars would smuggle method content into the one control defined by having none; the placebo carries the length control instead. Wrote it as a single trigger clause on the same surface as the treatment's ('a code change' vs 'building one feature with an agent'). Unverified: the smoke run that would settle it (`--max-cost-usd 0.0001` load-only pass per condition) is step-6 work and out of my rules.
- **Owning artifact:** 3-todos.md § "The one-liner's frontmatter description is a control-validity risk", plus 4-recon.md § 'Not probed'

### evals/seven-steps-primer/conditions/treatment/SKILL.md line 1 — generate mode's output shape

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** The committed step-3 placeholder opens with `<!-- GENERATED by scripts/build-conditions.mjs — do not edit by hand. -->`, while 0-plan.md §Test strategy 2 rules that the mirror `must equal SKILL.md minus the flag`. Both cannot hold: a banner makes the file unequal.
- **Invented:** No banner. The mirror is byte-equal to SKILL.md minus the flag line — an HTML comment above `---` would stop the frontmatter being frontmatter, which would break the very `description:` the model needs to fire the skill from a natural-language prompt (recon seam 3), and equality is what the drift rule is stated as. The placeholder banner was overwritten by `generate`.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (the mirror spec) versus the step-3 placeholder in conditions/treatment/SKILL.md

### docs/plans/primer-evals/4-recon.md:56 — the recorded size of the generated mirror

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** Recon records `node scripts/build-conditions.mjs generate # 11354 bytes, flag stripped`. SKILL.md has not changed since 2026-08-25 (git log on the file), predating the 08-27 recon; it is 11510 bytes and the flag line is 31 bytes, so the documented rule yields 11479. 125 bytes are unaccounted for, and the spike that produced 11354 was reverted, so nothing shows what else it removed.
- **Invented:** Implemented the documented rule — strip exactly the flag line — and treated the recon byte count as stale rather than as a second, unstated requirement. My generate prints 11479 bytes.
- **Owning artifact:** docs/plans/primer-evals/4-recon.md (seam 3)

### scripts/build-conditions.mjs — stripModelInvocation's matching rule

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** interfaces.mjs says only `Removes the disable-model-invocation frontmatter line and nothing else`. Nothing defines what delimits the frontmatter, whether a value other than `true` still counts, whether an indented occurrence under another key counts, or that a body mention must survive — and the eval's whole premise is that the text under test is the shipped text.
- **Invented:** Strip only between a leading `---` fence and the next `---`; match `/^disable-model-invocation[ \t]*:/` at top level, so any value is stripped and an indented occurrence is left alone; body mentions untouched; no frontmatter, an unterminated fence, or an absent line all return the input unchanged. Each of these is pinned by a test.
- **Owning artifact:** scripts/interfaces.mjs § StripModelInvocation

### scripts/build-conditions.mjs — both modes, when the source has no flag line

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** No artifact says what happens when the strip strips nothing. A no-op strip still writes a faithful mirror and still reports success, which is exactly the vacuous pass 5-invariants.md builds every check against — but nothing in the plan makes it fatal either.
- **Invented:** Warn on stderr (`no disable-model-invocation line … — nothing to strip`) and exit 0. The mirror is still a faithful copy, so it does not void anything; but somebody moved the production frontmatter and the run says so. Step 5's doctrine could equally justify a hard failure.
- **Owning artifact:** docs/plans/primer-evals/5-invariants.md (the anti-vacuity rule) / 0-plan.md §Test strategy 2

### docs/plans/primer-evals/3-todos.md — the enumeration grep, now that the mirror holds real content

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** That step defines `grep -rn 'TODO' scripts evals` as the enumeration of implementation sites. The mirror is a copy of SKILL.md, whose prose discusses `TODO` markers, so generating it puts two literal `TODO`s into `evals/` that are not sites. The artifact records deciding against exactly this shape of defect — `a check that reports a site which is not a site` — for the convention comment, but not for the generated mirror.
- **Invented:** Left the grep and the skill prose alone and reported it. The fixes available (a `--exclude` on the mirror, or a distinguishing marker prefix) both change a convention this module does not own.
- **Owning artifact:** docs/plans/primer-evals/3-todos.md

### scripts/merge-results.mjs — checkReport(), the `registered` context

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** I2 voids a run whose CLI version differs from the pre-registered one and compares against `registered.claudeVersion`, but PreRegistration has no claudeVersion field and no artifact names another source for it. There is nowhere in the declared types to record the version the experiment was registered against.
- **Invented:** An optional `claudeVersion` in the pre-registration's json block. When it is absent, I2 compares the observed version against `undefined` and refuses — the failure is closed rather than skipped, but the message reads as a data error rather than as the missing-field-in-the-type that it is.
- **Owning artifact:** scripts/types.mjs § PreRegistration (and 5-invariants.md I2)

### scripts/merge-results.mjs — markNoiseFloor()

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** invariants.mjs i1bNoiseFloorMarked requires every sub-spread contrast to carry `belowNoiseFloor === true`, and invariants.test.mjs constructs contrasts with that field — but the Contrast typedef in types.mjs declares only treatment, control, value and expected. The field the law polices does not exist in the type it polices.
- **Invented:** Contrast gains an emitted `belowNoiseFloor: boolean`, stamped by a separate markNoiseFloor pass rather than by computeContrasts, so a report assembled without that pass fails I1b instead of quietly reading as clean. types.mjs was not edited — it is another module's file.
- **Owning artifact:** scripts/types.mjs § Contrast

### scripts/merge-results.mjs — parseDriftRecord() and main()

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** I2 takes a `{drifted, reason}` verdict, but nothing says how it reaches the merger. DetectDrift lives in build-conditions.mjs (still unimplemented), SweepResult carries no drift field, and merge-results has no artifact-sanctioned way to recompute it.
- **Invented:** A `drift.json` sidecar in the results directory holding exactly DetectDrift's return shape. Absent, unparseable, or missing its boolean, it reads as DRIFTED and voids the run — absence of evidence is not evidence of compliance. In practice this means merge-results refuses every run until run-evals or build-conditions starts writing that file, which is a coupling nobody registered.
- **Owning artifact:** scripts/interfaces.mjs + docs/plans/primer-evals/2-interfaces.md

### scripts/merge-results.mjs — computeContrasts() and computeBaselineSpread()

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** Two things. (a) ComputeContrasts receives `baselineScores` as an unlabelled number[], so the treatment sweep's OWN matched without-column cannot be identified — the signature forecloses the matched-pair comparison the harness itself reports as delta. (b) MergedReport.baselineSpread says 'max - min across the per-sweep baseline columns' without saying whether cases pool into one spread or each yields its own.
- **Invented:** (a) The `none` score is the mean of all per-sweep baselines — defensible because 0-plan.md says none is 'measured three times over', and the spread is published beside it. (b) Cases are never pooled (case difficulty is not noise); the reported spread is the WORST per-case max−min, which marks more contrasts as sub-noise and so errs toward under-claiming.
- **Owning artifact:** scripts/interfaces.mjs § ComputeContrasts + scripts/types.mjs § MergedReport.baselineSpread

### scripts/merge-results.mjs — parseSweepFile() and main()

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** run-evals.mjs's marker says 'persist to results/<condition>.json' and merge's says 'results dir in', but no artifact fixes what that file contains: a SweepResult envelope, or the harness's bare aggregate-result.json. The two are not interchangeable — exitCode and condition exist only in the envelope.
- **Invented:** Envelope only: `{condition, exitCode, document, stderrTail}`, with the filename's condition cross-checked against the declared one. Handed a bare aggregate-result.json it refuses with a message naming the expected shape rather than fabricating an exit code. If run-evals lands the other shape, these two modules will not connect.
- **Owning artifact:** docs/plans/primer-evals/2-interfaces.md (the sweep→merge handoff is diagrammed but not specified)

### scripts/merge-results.mjs — main(), the pre-registration digest

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** Three gaps in one place. PreRegistrationDigest is typed `(path) => Promise<string>`, so the 'hard failure when git status reports it dirty' ruled in recon has nowhere to return a dirty flag — yet I2 and I8 both take `dirty` as a separate boolean. The hash algorithm is unnamed. And nothing says what `registered.preRegistrationSha` is compared against, which matters: comparing the working-tree file to itself is vacuous.
- **Invented:** main computes digest and dirtiness separately and routes both into the invariants, so the hard failure arrives as a named refusal rather than a stack trace. sha256 hex over the exact bytes. `registered`/`committed` is the digest of `git show HEAD:<path>`; the report's is the working-tree digest — so an edit-after-commit is caught even on a tree git reports clean.
- **Owning artifact:** scripts/interfaces.mjs § PreRegistrationDigest + docs/plans/primer-evals/4-recon.md seam 3

### scripts/merge-results.mjs — buildProvenance()

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** BuildProvenance is declared as `(revParse, digest, clock, inv: EvalInvocation) => Provenance`, but the merger runs after the sweeps have exited and nothing persists an EvalInvocation — SweepResult has no such field. Provenance.startedAt is also ambiguous: the run's, or the merge's.
- **Invented:** buildProvenance takes `{revParse, clock}` plus the sweeps and the pre-registration. CLI version and both models are read from the sweep documents (so I2 compares what RAN against what was promised, rather than comparing the promise to itself), and sweeps that disagree on any of the three throw. startedAt is the earliest sweep's, falling back to the clock. runsPerCase comes from the pre-registration; costUsdEstimate is the sum across documents.
- **Owning artifact:** scripts/interfaces.mjs § BuildProvenance

### PRE-REGISTRATION.md — expectedDirection, 11 of the 12 case/control pairs

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** D6 requires 'expected direction' as pre-registration content and 3-todos.md names only one value ('triage-skip-oneliner expects 0'). No artifact states a sign for the other eleven pairs, and computeContrasts throws rather than defaulting, so the file cannot ship without them.
- **Invented:** +1 everywhere except gate-stop-step0/placebo = 0 and triage-skip-oneliner/none = 0. Each +1 is justified in prose by naming something the treatment's text says that the control's does not AND that one of the case's graders actually reads; gate-stop-step0/placebo is registered 0 deliberately against our own interest, because case 1 measures gate-stopping and gate-stopping is exactly what the placebo also instructs.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (D6 names the requirement, states no directions)

### PRE-REGISTRATION.md — which control 'triage-skip-oneliner expects 0' refers to

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** The one direction the artifacts do give is unqualified. 'Expected direction here is 0' (prompt.md) and 'triage-skip-oneliner expects 0' (3-todos.md) could mean all three of that case's contrasts are 0, or only the contrast against stock Claude.
- **Invented:** Read it as vs `none` only. Registered +1 vs `oneliner` (read literally, the one-liner forbids the typo fix without approval, and typo-fixed-in-source reads the file afterwards) and +1 vs `placebo` (no triage band; it demands a reviewer, a title and a pace before a one-word fix).
- **Owning artifact:** docs/plans/primer-evals/3-todos.md / triage-skip-oneliner/prompt.md

### PRE-REGISTRATION.md — the `claudeVersion` key in the registered JSON

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** merge-results.mjs main() reads `preRegistration.claudeVersion` and feeds it to I2, but parsePreRegistration never validates it and the PreRegistration typedef in types.mjs has no such field. The consumer and the type disagree, and nothing tells you to register a CLI version.
- **Invented:** Added `"claudeVersion": "2.1.245"` from harness-facts.md's pinned version. Omitting it would leave registered.claudeVersion undefined, which fails I2 on every merge and yields no report at all.
- **Owning artifact:** scripts/types.mjs (PreRegistration) / docs/plans/primer-evals/1-types.md

### PRE-REGISTRATION.md — the form of subjectModel / judgeModel

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** D2 pins 'subject Sonnet 5, judge Opus 5'. I2 string-compares the registered value against provenance.subjectModel, which buildProvenance reads out of the harness document's `suite.modelOverride` — i.e. whatever was passed on the CLI, which run-evals fixes as 'sonnet'/'opus'. No artifact says which of the two forms the pre-registration carries.
- **Invented:** Registered the CLI aliases 'sonnet' and 'opus', with a sentence saying why. Registering 'Sonnet 5' would void every run through I2 while looking more precise.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md D2 / scripts/interfaces.mjs (BuildProvenance)

### README.md — 'The merge' section, producing results/drift.json

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** merge-results.mjs requires a drift record at <results>/drift.json and treats its absence as DRIFTED (so the merger refuses to emit anything), but nothing writes that file: build-conditions.mjs prints its verdict and exits, and no artifact or TODO marker names a producer.
- **Invented:** Documented the operator step as `node scripts/build-conditions.mjs check && printf '{"drifted":false,"reason":""}' > evals/seven-steps-primer/results/drift.json`, chained so the record can only be written when the check passed. This is a documentation-level patch over a missing piece of the runner.
- **Owning artifact:** scripts/build-conditions.mjs / docs/plans/primer-evals/2-interfaces.md (DetectDrift has no sink)

### README.md — typesetting of the claim-ceiling quotation

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** 5-invariants.md says the ceiling must be 'present verbatim (whitespace-insensitively)'. i3ClaimCeilingIntact normalizes whitespace only, so a normally wrapped markdown blockquote — the obvious way to quote it — fails, because '>' survives on each continuation line. No artifact says how to typeset it.
- **Invented:** Put the sentence on one long unwrapped line inside the blockquote and documented the constraint in-line so a future re-wrap does not silently break the check. The alternative fix (normalizing blockquote markers inside i3) would be a change to an owner-authored invariant, which is out of scope here.
- **Owning artifact:** scripts/invariants.mjs (i3ClaimCeilingIntact) / docs/plans/primer-evals/5-invariants.md

### README.md — what counts as 'the claims section' for I3's second clause

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** i3 takes `diff.claimsSectionChanged` from a caller that does not exist yet (it is a TODO in scripts/test/graders.test.mjs), and no artifact defines the section's boundaries in the README.
- **Invented:** Named `## What the numbers mean` as the claims section and labelled it as such in the page itself, so whoever wires the check has one heading to diff.
- **Owning artifact:** docs/plans/primer-evals/5-invariants.md (I3)

### evals/seven-steps-primer/<case>/scaffold.sh (six new files) and each case.yaml's context.scaffold_script

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** 0-plan.md's layout and fixtures/notesvc/README.md put ONE scaffold at fixtures/notesvc/scaffold.sh, shared by the suite, and say it is "referenced from a case as context.scaffold_script" — but never say how a case names a path outside its own directory. The harness forbids it: scaffold_script resolves through the same containment check as add_dirs and throws `path "..." escapes the case directory (`..` or an absolute path)`. Recovered from the binary; recon never ran a scaffolded fixture case, so nothing in the artifacts had met this.
- **Invented:** A four-line delegating scaffold.sh in each of the six case directories: it resolves its own dirname and execs ../fixtures/notesvc/scaffold.sh. The authored path stays inside the case; the `..` happens inside the script, where the rule does not reach. Rejected the symlink alternative — the harness already refuses a symlinked plugin path (fact #2), and leaning on link resolution in one place while being refused it in another breaks on the next release.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (module layout) and evals/seven-steps-primer/fixtures/notesvc/README.md

### All six prompt.md bodies

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** The artifacts specify only each prompt's SHAPE — "a neutral, medium, structural request", "a typo in a rate-limit error message", "a vague epic". No wording exists anywhere, and 4-recon's own case-1 prompt is unusable: "It's a medium-sized structural change and getting the design wrong would be expensive" hands the model the skill's own triage vocabulary for the Run-it band, which is exactly what the case's marker forbids.
- **Invented:** Four scored prompts and one control prompt, each grounded in a planted fixture defect: case 1 states the shared-counter symptom and says "Make the limit per user"; case 2 hands over the `>`→`>=` patch as a "small one"; case 3 quotes the `plese` typo; case 4 asks for the whole auth stack (tokens, refresh, scopes, admin role, principal-keyed limits) and says "Get started on it" rather than "where do we start", which would have made decomposition the obvious baseline answer and collapsed the delta.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (the case table) — it names what each case measures but never what the agent is asked

### evals/seven-steps-primer/step3-markers-in-source/graders/markers-in-source.md

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** The skeleton targeted `fixtures/notesvc/src/routes/notes.js`. Two things are wrong and only one is flagged: the marker asks to "confirm the {source: file} target resolves against the sandbox workspace path" (it is workspace-relative, so no fixtures/ prefix), but nothing addresses the file itself — per-user rate limiting does not touch the routes module at all. The fixture README's own defect table puts every rate-limit flaw in src/middleware/index.js, and its account of the change names the limiter, createServer() and the test suite's reset hook. A grader over a file the plan correctly leaves alone can never pass.
- **Invented:** Retargeted markers-in-source to src/middleware/index.js, and wrote the replayed transcript to name that file, server.js and test/notes.test.js as the three sites — saying in as many words that src/routes/notes.js is untouched, so the grader set and the transcript cannot disagree.
- **Owning artifact:** the marker in step3-markers-in-source/graders/markers-in-source.md, and fixtures/notesvc/README.md's site table

### evals/seven-steps-primer/{gate-stop-step0,looks-trivial-is-structural}/graders/no-source-edits.md

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** The Write grader's marker names the fix — "add input_match scoping the ban to fixture source paths, so writing the plan document itself does not trip it" — while the Edit grader's marker asks only to "confirm all three keys are present". The same false trip applies to Edit: an agent that writes a plan and then tightens a sentence in it has called Edit, and case 1 would score that as touching the source, failing the behaviour it is measuring.
- **Invented:** Scoped both identically with input_match `"file_path"\s*:\s*"(?:[^"]*/)?(?:server\.js|src/|test/)`. The leading segment is optional so a relative-path attempt is still counted — tool_used sees the call the model emitted, not the one the tool accepted (fact #16).
- **Owning artifact:** the marker in gate-stop-step0/graders/no-source-edits.md

### evals/seven-steps-primer/{gate-stop-step0,looks-trivial-is-structural,triage-decompose-epic}/graders/hands-back.md (three new files)

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** 0-plan.md and the liveness markers require "a regex on last_message requiring an explicit hand-back" and stop there: no wording, no must-not-match set, no ruling on whether it is scored or a with-only indicator. A liveness regex is precisely the instrument 0-plan warns about — "a regex matching everything passes every case while measuring nothing, and it fails silently in the direction that flatters".
- **Invented:** An eleven-alternative case-insensitive alternation of ordinary English hand-back phrases (proceed · shall I · want me to · say the word · before I start/touch/…), `arm: both`, scored, duplicated across the three cases that pair it with an absence claim. Deliberately contains no skill vocabulary so a no-skill baseline can satisfy it. I probed it 9/9 in-session; the permanent probes belong to prompt-fixtures/.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (the liveness paragraph) and the marker in gate-stop-step0/graders/liveness.md

### evals/seven-steps-primer/gate-stop-step0/graders/step0-only.md — the focus

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** The rubric is to judge that the run "presents scope, module placement, test strategy and open questions, and stops". But the step-0 artifact is a FILE at docs/plans/<feature>/…, `focus` takes one literal path rather than a glob, and the harness's default focus is last_message — so the judge routinely sees a summary of the plan, not the plan. No artifact says which it should grade.
- **Invented:** Kept focus: last_message and wrote the rubric to accept either — the plan set out in the reply, or a named plan file WITH its contents summarised (a bare filename does not count). plan-exists carries the file's existence separately, so the judge is left deciding only what the turn did.
- **Owning artifact:** the marker in gate-stop-step0/graders/step0-only.md

### evals/seven-steps-primer/prompt-fixtures/ — probes for the six regex graders authored here

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** I5 forbids a grader shipping without both halves of its probe set, and prompt-fixtures/README.md is still markers. Every regex grader I wrote (hands-back ×3, limiter-untouched, off-by-one-not-applied, typo-fixed-in-source, markers-* ×3) now owes it a must-match and a must-not-match sample, and prompt-fixtures/ is outside this module.
- **Invented:** Ran the probes as throwaway node scripts this session (results in `verification`, all passing) rather than committing them. i5GradersHaveCompleteProbes will therefore report every one of these graders as having no probes until prompt-fixtures/ is written.
- **Owning artifact:** evals/seven-steps-primer/prompt-fixtures/README.md and scripts/test/graders.test.mjs

### scripts/run-evals.mjs DEFAULTS.threshold

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** types.mjs says threshold is "never left to default: 1.0 is unreachable with `llm` graders, so CI would always exit 1" — but no artifact anywhere states the number. The one verified recon command used `--threshold 0.1`, which was a smoke value, not a suite policy. PRE-REGISTRATION.md, which owns it, is entirely unwritten TODOs.
- **Invented:** 0.8. It decides the harness's exit code and therefore what CI calls a pass, so a wrong value here is a verdict, not a number.
- **Owning artifact:** evals/seven-steps-primer/PRE-REGISTRATION.md (D6) — `threshold` is a declared PreRegistration field with no value

### scripts/run-evals.mjs DEFAULTS.subjectModel / DEFAULTS.judgeModel → `--model` / `--judge-model`

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** Two problems in one place. (a) D2 pins "subject Sonnet 5, judge Opus 5" as prose; no artifact gives a model identifier string, and D2's whole purpose — a model rollout must never read as a skill regression — is defeated by a floating alias. (b) 0-plan.md § Cost says "`--judge-model sonnet` is required — the haiku default is not adequate", which contradicts D2 and types.mjs's "judgeModel: pinned, and not the subject model".
- **Invented:** `sonnet` and `opus`, the harness aliases (`--model sonnet` is the only form recon exercised; `--judge-model` was never run at all). I read D2 as governing and the Cost line as stale, because a judge equal to the subject violates the type's own contract. Aliases do NOT pin a version, so provenance will record whatever `sonnet` resolved to that day.
- **Owning artifact:** 0-plan.md D2 vs 0-plan.md § Cost; PRE-REGISTRATION.md owns `subjectModel`/`judgeModel` and is unwritten

### scripts/run-evals.mjs main() — tag selection, and selectionTags()

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** The marker says "exclude `tags: [control]` by default" and control-all-steps/prompt.md says "excluded from scored runs via --tag", but no artifact states what `--tag` matches: any-of the listed tags, or all-of them, and whether an exclusion form exists at all. It also matters that no single tag covers the five scored cases (gate/core, triage/core, triage, triage/core/guardrail, capability), so exclusion cannot be done with one tag.
- **Invented:** Pass the union of the scored cases' own tags — `--tag capability core gate guardrail triage` — assuming any-of semantics, since the control case shares none of them. If the harness ANDs them, a full sweep selects zero cases (loud, but only after a launch). I also made an untagged scored case a hard error, because under tag selection it would vanish from every sweep without a word.
- **Owning artifact:** harness-facts.md — `--tag` appears only in claim #11 (it consumes the target) with no semantics; 4-recon.md never probed a tag filter

### scripts/run-evals.mjs buildEvalArgv() — `--allow-tools`

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** Recon only ever passed a single tool (`--allow-tools Bash`). Nothing records the multi-value form (repeated flag, comma list, or variadic), though claim #11's "they will consume it" implies variadic. Nor do the artifacts settle whether the operator grant is an EXTENSION of the read-only default set (facts #5) or a strict INTERSECTION with the case's `allowed_tools` (facts #27) — the two readings disagree about whether Read/Glob/Grep must be listed.
- **Invented:** Space-separated variadic values, placed last, listing all seven tools the cases themselves declare (Read Glob Grep Skill Write Edit Bash). The superset is identical under both readings, so the effective tool set is right either way; but if the flag is not variadic the sweep will misparse.
- **Owning artifact:** harness-facts.md #5/#11/#27 and 4-recon.md § four smaller defects

### scripts/run-evals.mjs runSweep() — the 4th parameter, and readDocumentSince()

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** interfaces.mjs types RunSweep as (SpawnCapture, EvalCommand, EvalInvocation) → SweepResult, but SweepResult.document can only be filled by reading what ResultsLocator points at, and ResultsLocator is declared as a separate handle with no route into RunSweep. Separately, ResultsLocator is specified as "the newest timestamped directory" with no freshness rule — and five recon directories are already sitting in results/, so a sweep that dies at case-load would return a PREVIOUS sweep's document, scored and merged as if it were this one.
- **Invented:** A fourth handle parameter `readDocument`, and a freshness guard: snapshot the timestamp directory names before spawning, then require the chosen directory to be one that was not there before. Null when nothing new appeared.
- **Owning artifact:** interfaces.mjs § run-evals (RunSweep) and § ResultsLocator; 2-interfaces.md's call-flow diagram shows the locator feeding SweepResult but names no plumbing

### scripts/run-evals.mjs runSweep() — no `--json`, and stderrTail's fallback

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** Two artifacts point at two different copies of the same document. types.mjs SweepResult says "stderrTail: case-load errors and notices; stdout is the JSON document" (which only holds if the runner passes `--json`), while the ResultsLocator seam was resolved by a real run reading `<eval-dir>/results/<ts>/aggregate-result.json`. Nothing says which is authoritative, and facts #11 imply `--json` takes a value nobody ever recorded.
- **Invented:** Do not pass `--json`; read the file the locator finds. Because stdout then carries the harness's progress and its load-time advisories rather than JSON, stderrTail falls back to the stdout tail when stderr is empty — an empty tail beside a failing exit code is worse than a slightly mislabelled field.
- **Owning artifact:** types.mjs SweepResult.stderrTail vs 2-interfaces.md § ResultsLocator

### scripts/run-evals.mjs parseArgv() — `--smoke`

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** 3-todos marks "--smoke for a single-case pilot at runs=1", while 0-plan § test strategy and 4-recon both call the LOAD-ONLY pass under `--max-cost-usd 0.0001` "the documented smoke check" — the one that caught a real grader/tool mismatch for $0.02. Those are different runs at different prices, and EvalInvocation carries no maxCostUsd field, so the load-only form is unrepresentable in the type the pure argv builder consumes. The artifacts also never say how many conditions a pilot sweeps.
- **Invented:** `--smoke` = the first scored case (lexicographically `gate-stop-step0`, which is the case the plan names) at runs 1, treatment only unless `--condition` says otherwise — a paid pilot. The cheap load-only pass is NOT available from this script.
- **Owning artifact:** types.mjs EvalInvocation (no cost ceiling) + 3-todos.md's marker vs 0-plan.md § test strategy item 4

### scripts/run-evals.mjs discoverCases() / parseTags() / frontmatterOf()

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** The runner has to know case names and tags to exclude the control case and to pick the smoke case, but no artifact describes case discovery: interfaces.mjs has no signature for it, types.mjs's CaseSpec is a pre-registration record rather than something read off disk, and the suite writes tags in two shapes (a flow sequence in prompt.md frontmatter, a `case.yaml` for the replay case).
- **Invented:** A directory is a case when it holds prompt.md or case.yaml; tags are read from both and unioned, with a deliberately tiny YAML subset (flow sequence, block list) scoped to the frontmatter so a case's prose cannot be read as configuration. A hand-rolled reader that misreads a tag list would silently add or drop cases, so an untagged scored case throws rather than being dropped.
- **Owning artifact:** interfaces.mjs — no CollectCases/DiscoverCases callback beside CollectGraderProbes; 0-plan.md's layout does not say where tags live

### scripts/run-evals.mjs DEFAULTS (subjectModel, judgeModel, runs, threshold) vs evals/seven-steps-primer/PRE-REGISTRATION.md

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** The pinned values now exist in two unlinked places: merge-results reads them from PRE-REGISTRATION.md and voids the run under I2 when the report disagrees, while the runner hardcodes them. No artifact says which is authoritative or requires them to be reconciled — so a threshold or model edited in one place voids every sweep produced by the other, and the failure surfaces only after the runs are paid for.
- **Invented:** Constants in the runner, documented as such. I did not have run-evals parse PRE-REGISTRATION.md: nothing in 2-interfaces gives the runner that dependency, and the file is currently all TODOs, so parsing it would fail on every invocation.
- **Owning artifact:** 2-interfaces.md § one sweep, end to end — EvalInvocation is built by "step 6", and no artifact names its source of truth

### scripts/run-evals.mjs DEFAULTS.scaffold → `--scaffold`

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** The fixture ships a scaffold.sh whose header says it runs only under `--scaffold`, but no case currently declares `context.scaffold_script`, and no artifact says whether the operator turns the flag on for scored sweeps.
- **Invented:** Always on. A case whose fixture never landed grades a half-empty workspace and yields plausible numbers, whereas a failing scaffold scores the run 0 — loud, and cheaper to notice.
- **Owning artifact:** 0-plan.md § the cases / harness-facts.md #1 — the flag is described but never assigned to the runner


## Cosmetic

### evals/seven-steps-primer/fixtures/notesvc/*.js — module format

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** The artifacts fix the filenames as `.js` (graders grep them by path) and the build rules forbid a package.json, which forces CommonJS. Whether the fixture was meant to be ESM — more idiomatic for a new zero-dep service, and reachable on Node >= 22.7 via module-syntax detection — is unstated.
- **Invented:** CommonJS `require`/`module.exports`, chosen for robustness: it runs on any Node with no config and no detection heuristic, and "green on a clean checkout" has to mean any checkout. The README says the choice is deliberate rather than dated.
- **Owning artifact:** 0-plan.md § Module placement (the fixture line) — it names the directory and the `node --test` requirement but not the module system.

### evals/seven-steps-primer/fixtures/notesvc/src/routes/notes.js — the route set

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** The marker names two routes ("POST /notes and GET /notes over the store"), while the store marker demands honest return types — whose nullable `get(id) -> Note|null` is the sharpest of them and would be dead code under a two-route API.
- **Invented:** A third route, `GET /notes/:id`, so the nullable return is exercised by real traffic and by a test (`assert.strictEqual(store.get('no-such-id'), null)`). Three routes, ~108 lines, still readable in one sitting.
- **Owning artifact:** the fixture markers in src/routes/notes.js and src/store.js — they pull in opposite directions by one route.

### evals/seven-steps-primer/fixtures/notesvc/scaffold.sh — git identity, signing and hooks

- **Module:** evals/seven-steps-primer/fixtures/notesvc
- **Underdetermined:** The marker says `git init` because "a case needing its own history must create it", but not whether to make a commit, on what branch, or under what identity. Since the scaffold runs before credentials exist and a scaffold failure scores the run 0, a machine with a global `commit.gpgsign=true` or a global `core.hooksPath` would silently zero every scored run.
- **Invented:** One commit on `main` (via `git symbolic-ref`, not `init -b`, which needs git >= 2.28), identity supplied per-invocation with `-c user.name` / `-c user.email` so no global config is read or written, plus `-c commit.gpgsign=false` and `--no-verify`. Guarded with `git diff --cached --quiet` so a second run is not an empty-commit failure, and the missing-git branch warns to stderr instead of exiting non-zero.
- **Owning artifact:** harness-facts.md #1 — it establishes the pre-credential environment but does not draw the consequence for git operations the scaffold is asked to perform.

### conditions/placebo/SKILL.md § 'The steps' — eight steps, 0 through 7

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** 0-plan.md and 3-todos.md both describe the placebo as 'the same seven gates', but the skill under test has steps 0–7, i.e. eight gates. The two instructions ('seven gates' vs 'match section count / shape') cannot both be satisfied.
- **Invented:** Matched the treatment: eight steps, eight gates, one heavy step at position 4 carrying all 8 sub-bullets, exactly as the treatment's step 4 does. Read 'seven' as loose reference to the skill's name.
- **Owning artifact:** 0-plan.md conditions table

### conditions/oneliner/SKILL.md — body word count

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** 3-todos.md and 0-plan.md call it 'the fifteen-word control' and then quote a sentence that is thirteen words: 'Present a plan and wait for my explicit approval before editing any code.'
- **Invented:** Took the quoted sentence as authoritative and reproduced it byte-for-byte; the count in the prose is wrong, not the quote.
- **Owning artifact:** 3-todos.md / 0-plan.md conditions table

### conditions/placebo/SKILL.md — four sentences shared verbatim with the treatment

- **Module:** Authored control conditions: evals/seven-steps-primer/condit
- **Underdetermined:** 'The same stop-and-wait scaffolding' does not say whether the scaffolding may be copied verbatim or must be paraphrased. Verbatim maximises the control (only substance differs between conditions) but also maximises lexical overlap, which matters if any llm grader rewards phrasing rather than behaviour.
- **Invented:** Copied exactly four scaffolding sentences verbatim (the gate definition, the produce-present-stop instruction, the explicit-proceed rule, the still-in-the-current-step rule) and wrote everything else fresh. Verified by set intersection: no fifth sentence is shared.
- **Owning artifact:** 0-plan.md conditions table (placebo row)

### scripts/build-conditions.mjs — check mode with no mirror on disk, and unrecognised argv

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** The `check` marker says `exit 1 with the reason when they differ` and the argv marker says `generate | check, default check`. Neither says what a missing mirror is (drift, or a crash), nor what an unknown mode does, nor which exit code either takes.
- **Invented:** A missing mirror is drift — exit 1, reason `no mirror at <path> — run generate` — since the check exists to fail loudly on a mirror that does not match the skill. An unknown mode prints the usage line to stderr and exits 1, matching the harness's own use of exit 1 for bad options.
- **Owning artifact:** scripts/build-conditions.mjs step-3 markers / scripts/interfaces.mjs § DetectDrift

### evals/seven-steps-primer/conditions/treatment/SKILL.md:3 (the placeholder) — how drift-check is invoked

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** The placeholder promises `npm run drift-check`, but the suite is zero-dependency with no package.json, so no npm script can exist to run.
- **Invented:** The entry point is `node scripts/build-conditions.mjs check`, and the drift failure prints that exact command as the remedy. The placeholder text was overwritten by generate, so the stale promise is gone; whatever wires CI in step 6 has to name the node invocation.
- **Owning artifact:** docs/plans/primer-evals/3-todos.md placeholder / 0-plan.md §Module placement

### scripts/build-conditions.mjs — the plural name versus what it builds

- **Module:** scripts/build-conditions.mjs
- **Underdetermined:** The script is `build-conditions` and 0-plan.md lists three conditions, but every marker in the file concerns the treatment mirror alone. Nothing says whether it should also validate that `conditions/oneliner/` and `conditions/placebo/` exist, or that the placebo still matches the treatment on length and section count (a requirement 3-todos.md records as marked).
- **Invented:** Treatment only. The authored controls are untouched by this module, and their shape-matching requirement is left where its markers are.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md §Module placement / 3-todos.md

### scripts/merge-results.mjs — the entry-point handle block

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** The marker names exactly three handles — ReadTextFile, RevParse, Clock — but the module must also write the report ('report path out' in the argv marker) and needs `git status --porcelain` and `git show HEAD:<path>` for I8, neither of which RevParse covers.
- **Invented:** WriteTextFile plus a single `git(args, cwd)` helper wired at the entry point, used with fixed argv arrays and no shell. Nothing above the entry point touches a disk or spawns anything, so the rule the marker was protecting still holds — the list of handles was just short.
- **Owning artifact:** docs/plans/primer-evals/3-todos.md (marker text in scripts/merge-results.mjs)

### scripts/merge-results.mjs — checkReport(), the I7 call

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** merge's marker lists I1, I1b, I2, I4 and I8; graders.test.mjs carries the 'wire I3 and I7' marker. But I7 says a control case 'may not appear in either scored table', and MergedReport's two arrays ARE those tables — so the only artifact that can violate I7 is the one this module emits, while its enforcement is marked elsewhere.
- **Invented:** I7 is enforced here as well as filtered by construction (control-tagged specs never enter either array). One consequence nobody registered: i7 refuses a spec list with no control-tagged case, so merge-results now requires the pre-registration to declare the diagnostic case — authored i7 behaviour, but a new requirement on the pre-registration.
- **Owning artifact:** docs/plans/primer-evals/3-todos.md + 5-invariants.md I7

### scripts/merge-results.mjs — mergeSweeps(), the skippedPaidGraders branch

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** types.mjs says a run with skippedPaidGraders makes the arms 'not comparable' and Δ omitted, but that is stated about the with/without pair inside one sweep. Nothing says what a CROSS-sweep contrast should do when one condition's runs skipped paid graders.
- **Invented:** The score is still published (D6 — every condition, whatever it shows), but every contrast involving that condition is withheld and an advisory says so. The row is therefore quieter than it looks; a reader who only reads the score table will not see that the contrast was dropped.
- **Owning artifact:** scripts/types.mjs § HarnessRun.skippedPaidGraders

### scripts/merge-results.mjs — computeBaselineSpread(), the single-sweep case

- **Module:** scripts/merge-results.mjs
- **Underdetermined:** Nothing says what the noise floor is when fewer than two sweeps produced a baseline column for any case — which is exactly what a one-condition smoke merge looks like. Returning 0 would make every contrast clear the floor; returning NaN would slip past I1b's `typeof === 'number'` guard and mark nothing.
- **Invented:** It throws, so a merge over one sweep produces no report at all rather than a report whose every delta reads as a finding. That makes a legitimate single-condition smoke merge impossible, which may not be what the plan wanted.
- **Owning artifact:** docs/plans/primer-evals/1-types.md (baselineScores rationale)

### PRE-REGISTRATION.md — evidence kind and ablation for control-all-steps

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** parsePreRegistration requires `evidence` and `ablation` on every case including the control, but the artifacts describe case 6 only as 'diagnostic only, tags: [control], excluded' and assign it neither.
- **Invented:** `evidence: "capability"`, `ablation: "none"`, `scored: false` — capability because a pre-cleared prompt yields a score with no referent, and `none` because a baseline arm on a pre-approved prompt measures nothing. Both values are inert: mergeSweeps skips control-tagged specs before reading evidence and expectedRowCounts filters them out.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (case 6 row)

### README.md — 'The diagnostic, by hand'

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** The plan says case 6 runs 'on failure only' but names no path for running it. run-evals.mjs selects by tag (which is precisely how the control is excluded) and --smoke picks the first *scored* case, so the committed runner cannot run it at all.
- **Invented:** Documented a direct `claude plugin eval` invocation with --case control-all-steps --ablation none, modelled on recon's own command line, and kept the manual `cp -R conditions/treatment _condition` step it implies.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (case 6) / scripts/run-evals.mjs

### PRE-REGISTRATION.md — naming the graders

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** D6 requires the pre-registration to name the graders, but CaseSpec (types.mjs) carries no grader field, so the digest-frozen machine-readable record cannot hold them.
- **Invented:** Listed every grader by filename and type in the prose cases table, inside the same file, so the digest still covers them even though no code reads them.
- **Owning artifact:** scripts/types.mjs (CaseSpec) vs 0-plan.md D6

### README.md — Cost

- **Module:** evals/seven-steps-primer/PRE-REGISTRATION.md + evals/seven-s
- **Underdetermined:** 0-plan.md computes '5 scored cases × 5 runs × 2 harness arms × 3 sweeps ≈ 150 agent runs', but recon then established that case 5 runs single-arm, which the estimate never absorbed.
- **Invented:** Restated it as 4 delta cases × 5 × 2 × 3 plus the replay case single-armed at 5 × 3 ≈ 135, rather than repeating an arithmetic the recon falsified.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (Cost)

### evals/seven-steps-primer/step3-markers-in-source/graders/ (three markers-* files)

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** The marker says "add a second grader for src/middleware/. Every site, or the step is not done — so one file matching is not sufficient evidence." Two instructions that do not agree on a number: a second grader gives two files, "every site" gives as many as the change has.
- **Invented:** Three graders, one per site the transcript names (middleware, server.js, test/notes.test.js). Grading two of three sites would let a partial step pass as complete, which is the exact failure the step is about. The test file is graded deliberately — it is the site an agent describes rather than marks.
- **Owning artifact:** the marker in step3-markers-in-source/graders/markers-in-source.md

### evals/seven-steps-primer/triage-skip-oneliner/ — no liveness.md

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** 0-plan.md: "Every case also needs a liveness guard … Each case pairs its absence graders with `tool_used: Read min: 2` and a regex requiring an explicit hand-back." Applied literally to case 3 both halves are wrong: correcting a typo legitimately takes one read or none, and demanding a hand-back would fail the behaviour the case rewards (fix it and say so).
- **Invented:** No liveness.md and no hands-back.md here. typo-fixed-in-source is the guard instead — it reads the file after the run, so a dead run leaves `plese` in place and fails. Recorded in the two grader bodies so the omission reads as a decision rather than an oversight.
- **Owning artifact:** docs/plans/primer-evals/0-plan.md (the liveness paragraph)

### evals/seven-steps-primer/control-all-steps/graders/reaches-step-6.md

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** Three gaps in one marker. "All seven steps" — the skill has eight (0 through 7). Step 7 is "done-state on live data", which a throwaway sandbox cannot supply, so a literal criterion would make the diagnostic fail every time and tell you nothing. And the filename says step 6 while the rubric is meant to reach further.
- **Invented:** An eight-item checklist walking every artifact the skill's Deliverables line names, with the last phrased as what a done-state WOULD require plus a runbook — achievable in a sandbox. Kept the filename: it is the grader's name and the report keys on it, so renaming would break continuity with results already on disk. The judge is instructed to name the missing artifacts, since that list is the case's whole output.
- **Owning artifact:** the marker in control-all-steps/graders/reaches-step-6.md and 0-plan.md's case table

### evals/seven-steps-primer/step3-markers-in-source/history.jsonl — the `cwd` field, and the hand-back sentence

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** 4-recon lists `cwd` among the fields a resuming record needs but not what to put in it; the sandbox workspace is a fresh <tmp>/claude-eval-XXXXXX/ per run and unknowable at authoring time. Separately, the transcript has to set up a `proceed` that yields step 3 while carrying no gate prose and no step numbering — the artifacts state the constraint but not how the turn hands back.
- **Invented:** cwd = "/tmp/notesvc", a path that does not exist; recon's hand-written transcript resumed, which is only possible if the field is not matched against the real working directory. The assistant turn ends "Next is the change list: every place in the code that has to change, one by one. Say when." — it names the next unit of work without saying what FORM it takes, so markers-in-source versus a list in a document remains the thing being measured rather than something the transcript gave away.
- **Owning artifact:** docs/plans/primer-evals/4-recon.md (Seam 4) and the markers in step3-markers-in-source/case.yaml

### scripts/invariants.mjs — i6AbsenceClaimsHaveContentEvidence

- **Module:** The six eval cases under evals/seven-steps-primer/
- **Underdetermined:** The check accepts `(g.type === 'regex' || g.type === 'llm') && g.target?.source === 'file'`, but an llm grader has no `target` — its file focus is `focus: { source: file, path }` (the harness's own schema; `target` is regex-only). The llm branch is therefore dead: an absence case whose only content evidence is a judge over a file would be reported as resting on tool names alone.
- **Invented:** Nothing here — all three of my content graders are `regex` with `target`, so I6 passes as written (verified: `{"ok":true,"violations":[]}`). Flagging it because the next absence case that reaches for an llm file grader will be failed by a true statement.
- **Owning artifact:** scripts/invariants.mjs / docs/plans/primer-evals/5-invariants.md (I6)

### scripts/run-evals.mjs main() — runnerExitCode() and the interrupt break

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** The marker fixes the harness's exit codes onto SweepResult and says "let the caller decide what a low score means", but no artifact says what the RUNNER should exit with, or whether an interrupted sweep should stop the remaining conditions.
- **Invented:** Exit 0 when every sweep produced a document (a case below threshold is a result for merge-results to judge, not a runner failure); exit 2 on a partial sweep; exit 130/143 on an interruption, which also stops the loop rather than sweeping the next condition into a session the operator has just killed; exit 1 when any sweep produced no document.
- **Owning artifact:** 3-todos.md marker in run-evals.mjs / 2-interfaces.md § deliberately absent ("no orchestrator signature")

### scripts/run-evals.mjs — the wired spawnCapture and copyDirectory handles

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** SpawnCapture is typed (command, args, env) with no cwd, though the verified invocation uses the relative target `.` and a relative `--eval-dir`, which are meaningless without one; and `env` is not stated to extend or replace the ambient environment (replacing it would strip PATH and HOME and break the CLI's credentials). CopyDirectory is `cp(from, to, {recursive, force})`, which overwrites what it finds and leaves what it does not — so a file present only in the placebo would survive into the treatment's sweep.
- **Invented:** cwd fixed to the repo root, `env: {...process.env, ...env}`, and `rm -rf` before every copy with `dereference: true`. The handles also tee the child's output to this process, so a multi-hour sweep is not a black box.
- **Owning artifact:** interfaces.mjs § runtime handles (SpawnCapture, CopyDirectory)

### scripts/run-evals.mjs buildEvalArgv() — `--case` and `--no-publish`

- **Module:** scripts/run-evals.mjs
- **Underdetermined:** Recon passed exactly one `--case` and one `--no-publish`, and the artifacts explain neither: whether `--case` is repeatable (versus last-one-wins or comma-separated), and what `--no-publish` suppresses or whether it belongs on every sweep.
- **Invented:** One `--case` per selector, in order — currently exercised only with a single selector, so a last-one-wins harness would go unnoticed; and `--no-publish` on every sweep, on the grounds that the only verified command carried it.
- **Owning artifact:** 4-recon.md § seam 1 — the command is quoted but its flags are not explained


---

## How to read this

Each entry is a place ten fresh contexts, building from the committed artifacts and
with no one to ask, could not determine an answer and had to invent one. They were
instructed to report rather than paper over, because a silently-invented decision is
exactly what the cold fork exists to expose.

The count is the measurement.

## Round 1 — what was addressed

All **6 blocking** and roughly **20 material** entries, in the artifacts that owned
them. The remaining material and cosmetic entries were left deliberately, so the
second round says which gaps actually mattered.

Rulings made, each written where a reader would look for it rather than in a
changelog: the fixture's starting state and the scaffold's landing place; `case.yaml`
on every case (and the discovery that `scaffold_script` may not escape its case
directory — a path that does is a setup failure scoring 0 with no graders); identical
frontmatter across all three conditions, since the plugin name is neutralised but the
skill name and description are not; a producer for `drift.json`; the pre-registration's
form; the twelve registered directions; pinned models and threshold; the sweep→merge
record shape; and two grader designs that were measuring the condition's vocabulary
rather than its behaviour.

Two corrections went the other way — against things this plan had already asserted.
Case 2 was an off-by-one, which fails as a test because a one-line fix is *correct*
for what was asked; it is now a symptom whose only correct fix is structural. And
`--tag` turns out to be an include filter with no exclude form, so the control case
cannot be subtracted the way the runner's marker assumed.
