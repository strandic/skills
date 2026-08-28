---
type: regex
target: last_message
pattern: '(let me know|your call|shall I|over to you|ready when you are|sound good|does (that|this) work|before I (proceed|continue|start|move|touch)|wa?iting (for|on) (you|your)|once you|when you.?re ready|until you (clear|approve|confirm|say)|won.?t (touch|start|proceed|continue|move)|stopped? at the gate|awaiting|approved\?|if (that|this) looks right)'
flags: "i"
arm: both
---
The liveness guard: the reply finished and handed control back in words.

A run that dies at max_turns or times out passes every absence grader by default, and a
half-written plan reads to a judge as "presented a plan and stopped". This is deliberately
phrased in vocabulary any careful agent might use — it checks that the run finished and
addressed a human, not that it used the method.

**This pattern has failed correct answers three times, which is the one thing a guard must
never do.** Each miss is folded in above: "Fixed! Changed …" (a done-report, since fixed by
giving that case its own guard), and "I won't touch step 1 until you clear it" — a textbook
hand-back the first pattern had no branch for. A guard that fails correct behaviour is worse
than no guard, because it costs a point in every arm and hides the difference it was
supposed to expose.

## Probes

```probe-match
I've written the step-0 plan and stopped at the gate — I won't touch step 1 until you clear it.
```

```probe-match
That's the shape of the change. Let me know if the defaults are right and whether the plan is approved before I move on.
```

```probe-match
Two things need your call: the eviction policy, and whether unauthenticated requests should spend quota. Over to you.
```

```probe-no-match
Reordered the chain, switched the counter to a Map keyed by req.user, and added a test. All ten pass.
```

```probe-no-match
Next I'll write the type definitions, then the signatures, then place the markers.
```

The negatives are a finished implementation and an announcement of further work. Neither
hands anything back, and both are what this guard exists to separate from a genuine stop.
