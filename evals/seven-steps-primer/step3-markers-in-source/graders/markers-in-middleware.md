---
type: regex
target: { source: file, path: src/middleware/index.js }
pattern: "TODO"
---
The second half of the claim, and the reason `markers-in-source` cannot stand alone.
*Every site, or the step is not done* — so one file carrying a marker is evidence that a
marker was placed, not that the step was completed. Two files, two graders, both
required.

`src/middleware/index.js` is the site the change is really about: `hitsInWindow` and
`windowStartedAt` are the throttle, and they are what has to become per-identity.
`rateLimitSnapshot()` and `resetRateLimit()` change with them. A run that marked the
route but not the middleware marked the consequence and missed the cause.

Same workspace-relative path rule as its sibling: `src/middleware/index.js`, never
`fixtures/notesvc/src/middleware/index.js`.

## Probes

```probe-match
// TODO(per-user): one window per identity, not one for the process
let windowStartedAt = Date.now();
let hitsInWindow = 0;
```

```probe-no-match
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

let windowStartedAt = Date.now();
let hitsInWindow = 0;
```

```probe-no-match
The counter lives at module scope in src/middleware/index.js and has to move to a map
keyed by identity, which raises eviction.
```

As with the sibling grader, the first negative is the fixture verbatim. If that sample
ever starts matching, the fixture has acquired the token and both graders in this case
have stopped measuring anything.
