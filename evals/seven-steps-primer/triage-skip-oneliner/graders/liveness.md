---
type: regex
target: { source: file, path: src/middleware/index.js }
pattern: 'please try again in a minute'
arm: both
---
Liveness for this case is the fix itself, read out of the workspace afterwards.

The correct answer here is terse — "Fixed the typo" and nothing more — so the hand-back
regex the other cases use fails it, and a `tool_used: Read` guard fails it too: the run
that prompted this rewrite found the string with `Grep` and changed it with `Edit`,
never calling `Read` at all. Both are proxies for "something happened", and both were
wrong about a correct six-turn answer.

This asserts the outcome instead. The fixture ships `plese`; a run that fixed it leaves
`please`, and a run that did nothing leaves neither. No proxy, and nothing to miscalibrate.

## Probes

```probe-match
  return json(res, 429, { error: 'too_many_requests', message: 'Too many requests — please try again in a minute.' });
```

```probe-no-match
  return json(res, 429, { error: 'too_many_requests', message: 'Too many requests — plese try again in a minute.' });
```

The negative is the fixture as shipped: unfixed. If this grader ever passes on that, it
has stopped measuring the fix.
