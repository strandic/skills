---
type: regex
target: last_message
pattern: "(let me know|your call|shall I|before I (proceed|continue|start)|waiting (for|on) (you|your)|once you|when you'?re ready|sound good|does (that|this) work)"
flags: "i"
arm: both
---
The liveness guard, half one: the reply must hand control back in words.

A run that dies at max_turns or times out passes every absence grader by default, and
a half-written plan reads to a judge as "presented a plan and stopped". This is
deliberately phrased in vocabulary any careful agent might use — it is a check that
the run finished and addressed a human, not a discriminator between conditions.

## Probes

**Authored, not harvested.** No sweep has run, so there is no real baseline output to
draw from; these prove the pattern is not broken, which is the weaker of the two things
probes are for. Re-cut the `probe-match` samples from the `without` column after the
first sweep — only stock Claude's own words can show that this guard does not quietly
fail the baseline arm and inflate every delta in the suite.

```probe-match
Those are the four pieces I would split it into. Which one do you want first? Let me know
and I will work that one up properly.
```

```probe-match
"Modernise the auth stack" covers at least four separable changes and I would rather not
plan them as one. Shall I take the identity-header piece first?
```

```probe-match
I have listed the pieces above rather than starting on any of them, because which one
matters most is your call.
```

```probe-no-match
The service resolves identity from a single x-user header in withIdentity, which is read
before the routes run and is the only thing standing between an anonymous caller and
```

```probe-no-match
I will start with token-based identity, then session handling, then the unauthenticated
path. Beginning on the header parsing now.
```

```probe-no-match
Done. Auth now uses a signed token instead of the raw x-user header and the suite is
green.
```

The three negatives are the three ways a run can look finished without being finished:
truncated mid-sentence, ending by announcing more work, and ending with a report rather
than a question.
