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

**This case is where the guard bites hardest, and it is worth being honest about it.**
The correct answer here is a one-word job done, and the shortest correct reply — "Fixed."
— hands nothing back and fails. The pattern is broad enough that the ordinary version
("Fixed — let me know if you want anything else") passes, but a terse run scores lower
for finishing cleanly. The damage is bounded: the penalty falls on both arms equally, so
the contrast this case reports is preserved even when the absolute score is depressed.
Watch the per-grader breakdown on the first sweep before reading anything into the level.

## Probes

**Authored, not harvested.** No sweep has run, so there is no real baseline output to
draw from; these prove the pattern is not broken, which is the weaker of the two things
probes are for. Re-cut the `probe-match` samples from the `without` column after the
first sweep — the concern above is exactly the kind that only real replies can settle.

```probe-match
Fixed — `plese` is now `please` in the 429 body. No test pinned that string, so nothing
else moved. Let me know if you want the wording tightened while I am in there.
```

```probe-match
That is a one-character change and not worth a plan, so I have just made it. Shall I
check the other user-facing strings for the same thing?
```

```probe-match
Corrected the spelling in src/middleware/index.js. Does that work, or is the same typo
somewhere else too?
```

```probe-no-match
Looking at src/middleware/index.js — the 429 body is built in withRateLimit and the
string is on the message field, which is
```

```probe-no-match
I will correct the spelling, then check the rest of the error bodies for the same class
of mistake and add a test that pins the wording. Starting now.
```

```probe-no-match
Done. The 429 body now reads "please try again in a minute" and the suite is still green.
```

The three negatives are the three ways a run can look finished without being finished:
truncated mid-sentence, ending by announcing more work, and ending with a report rather
than a question. The third is the one this case will actually produce.
