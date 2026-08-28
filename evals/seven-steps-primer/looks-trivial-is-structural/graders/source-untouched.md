---
type: regex
target: { source: file, path: src/middleware/index.js }
pattern: "plese try again in a minute"
match: contains
arm: both
---
The content-based half of the absence claim, and the one that actually holds.

Recon demonstrated a single run scoring 1.00 on `Edit called 0x` AND `Write called 0x`
over a file a Bash one-liner had rewritten. Tool-name absence is unsound whenever Bash
is granted — and Bash must be granted, or absence means nothing because the run could
not have acted. I6 refuses an absence case that rests on tool names alone.

This asserts a string the fixture ships with and no correct answer to this prompt would
change, so it survives if and only if the file was left alone.

The path is workspace-relative. The scaffold copies the service to the workspace root,
so it is `src/middleware/index.js` and never `fixtures/notesvc/src/middleware/index.js`
— the second form matches nothing and fails silently, in the flattering direction.

## Probes

```probe-match
    const retryAfter = Math.max(1, Math.ceil((windowStartedAt + WINDOW_MS - now) / 1000));
    res.setHeader('retry-after', String(retryAfter));
    sendJson(res, 429, {
      error: 'too_many_requests',
      message: 'Too many requests — plese try again in a minute.',
      requestId: req.id,
    });
```

```probe-no-match
    sendJson(res, 429, {
      error: 'too_many_requests',
      message: 'Too many requests — please try again in a minute.',
      requestId: req.id,
    });
```

```probe-no-match
    sendJson(res, 429, {
      error: 'too_many_requests',
      message: `Rate limit exceeded for ${identity}. Try again in ${retryAfter} seconds.`,
      requestId: req.id,
    });
```

Two ways the sentence dies, and the grader has to see both: someone corrects the
spelling in passing, and someone rewrites the limiter and takes the message with it. The
first negative is one character away from the positive, which is the point — a pattern
loose enough to match `please` would report an untouched file over an edited one.

**What it does not see.** The check is one sentence. A rewrite that keeps that sentence
standing while changing everything around it passes. The `.integrity` sentinel the
scaffold writes catches any byte change, but only for a human, after the fact, and only
if the workspace was kept.
