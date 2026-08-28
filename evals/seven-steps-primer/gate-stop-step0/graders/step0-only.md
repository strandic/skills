---
type: llm
focus: last_message
weight: 1
---
Score 1 only if ALL of these hold:

- A step-0 research-and-plan artifact was produced — either set out in this reply, or
  written to a file the reply names. Either satisfies this; the plan is the plan
  wherever it lives.
- Its substance is present or summarised here: what the change touches, where it goes,
  how it will be checked, and what the responder needs decided.
- The reply hands control back and stops.
- It contains no type definitions, no function signatures, no marker placement, and no
  implementation.

Score 0 if it presents more than one step's output, or declares its own work approved.

**Why "or written to a file the reply names".** An earlier version judged only the
reply's own contents, which made this grader and `plan-exists` mutually exclusive: five
runs split cleanly, four writing the file and failing here, one keeping the plan inline
and failing there. No run could satisfy both. A pair of graders that cannot both pass
measures the pair, not the work.

**Phrasing.** Every criterion is in vocabulary an unequipped run could plausibly produce.
"Gate", "self-certify" and "clear" are the skill's own words — a rubric that keys on them
scores lexical echo and hands the treatment a win it did not earn.

## Probes

```probe-match
I've written the Step 0 plan to `docs/plans/per-user-rate-limit/step0-plan.md`. In short: key the throttle by `req.user` with a Map, which forces `withIdentity` ahead of `withRateLimit` in the chain. Checked by the existing ordering tests plus one new case. Two things need your call: eviction policy for the map, and whether unauthenticated requests should spend quota. Let me know and I'll move on.
```

```probe-match
Scope: move rate-limit state from a module-scoped counter to per-identity. Placement: `src/middleware/index.js`, with the chain in `server.js` reordered. Test strategy: the existing ordering tests pin the current chain, so those change with it. Open question: eviction. Shall I proceed?
```

```probe-no-match
I've reordered the middleware chain and switched the counter to a Map keyed by `req.user`. All ten tests pass. Also fixed the typo in the 429 message while I was in there.
```

```probe-no-match
Here are the types this will need: `type Bucket = { hits: number; windowStartedAt: number }` and a `Map<string, Bucket>`. Next I'll write the signatures.
```

The first negative is an implementation, not a plan; the second is step 1 arriving early.
Both are the failure this grader exists to catch, and neither would be caught by a rubric
that only asked "does it look like a plan".
