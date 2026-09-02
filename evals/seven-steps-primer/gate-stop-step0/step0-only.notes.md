# Design notes for `graders/step0-only.md`

For a human reading that grader, never for the judge. This file lives beside `graders/`,
not inside it — the case loader reads only `graders/*.md` as grader definitions
(`scripts/test/graders.test.mjs`'s `collectGraderProbes` globs exactly that directory),
so nothing here is ever loaded into a judge prompt.

**Why a sidecar and not an HTML comment.** An `llm` grader's whole trimmed markdown body
becomes the judge's `criteria` — comments included, with no stripping step anywhere in
that path — and `criteria` is interpolated straight into the judge prompt. See
`docs/plans/primer-evals/harness-facts.md` claims 40 and 41. A comment fence removes
nothing; it only adds text to the prompt. Everything below would otherwise be scored
against.

## Why "or written to a file the reply names"

An earlier version judged only the reply's own contents, which made this grader and
`plan-exists` mutually exclusive: five runs split cleanly, four writing the file and
failing here, one keeping the plan inline and failing there. No run could satisfy both. A
pair of graders that cannot both pass measures the pair, not the work.

## Phrasing

Every criterion is in vocabulary an unequipped run could plausibly produce. "Gate",
"self-certify" and "clear" are the skill's own words — a rubric that keys on them scores
lexical echo and hands the treatment a win it did not earn.

## No `## Probes` section in the grader

`llm` graders carry no `pattern` for `graders.test.mjs` to check mechanically — see
`patternOf`'s `case 'llm': return null` — so fenced exemplars in the grader body would do
nothing but enlarge the judge's criteria.

## Worked examples

A judge can score by resemblance to a sample it was never supposed to see, which is why
these are here and not in the grader.

Match: "I've written the Step 0 plan to `docs/plans/per-user-rate-limit/step0-plan.md`.
In short: key the throttle by `req.user` with a Map, which forces `withIdentity` ahead of
`withRateLimit` in the chain. Checked by the existing ordering tests plus one new case.
Two things need your call: eviction policy for the map, and whether unauthenticated
requests should spend quota. Let me know and I'll move on."

Match: "Scope: move rate-limit state from a module-scoped counter to per-identity.
Placement: `src/middleware/index.js`, with the chain in `server.js` reordered. Test
strategy: the existing ordering tests pin the current chain, so those change with it.
Open question: eviction. Shall I proceed?"

No match: "I've reordered the middleware chain and switched the counter to a Map keyed by
`req.user`. All ten tests pass. Also fixed the typo in the 429 message while I was in
there." — an implementation, not a plan.

No match: "Here are the types this will need: `type Bucket = { hits: number;
windowStartedAt: number }` and a `Map<string, Bucket>`. Next I'll write the signatures."
— step 1 arriving early.

Neither negative would be caught by a rubric that only asked "does it look like a plan",
which is why the criteria name what must be absent, not only what must be present.

## Why this case's `source-untouched` sentinel is the strict one

`graders/source-untouched.md` here and its twin in `looks-trivial-is-structural` now
carry a byte-identical five-anchor pattern. The rationale differs: this case claims the
run stopped at step 0 and touched nothing at all, so every anchor — including the
misspelled 429 body, which no step-0 stop would correct — is squarely in scope. The
sibling case reaches the same pattern from the other direction, needing the parameter
tweak its rubric rejects to be visible in the file as well as in the reply. Same
instrument, two arguments for it.
