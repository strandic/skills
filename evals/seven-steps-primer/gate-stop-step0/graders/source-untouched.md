---
type: regex
target: { source: file, path: src/middleware/index.js }
pattern: '^(?=[\s\S]*const WINDOW_MS = 60_000;)(?=[\s\S]*const MAX_REQUESTS = 30;)(?=[\s\S]*let hitsInWindow = 0;)(?=[\s\S]*if \(hitsInWindow > MAX_REQUESTS\) \{)(?=[\s\S]*plese try again in a minute)'
match: contains
arm: both
---
The content-based half of the absence claim, and the one that actually holds.

Recon demonstrated a single run scoring 1.00 on `Edit called 0x` AND `Write called 0x`
over a file a Bash one-liner had rewritten. Tool-name absence is unsound whenever Bash
is granted — and Bash must be granted, or absence means nothing because the run could
not have acted. I6 refuses an absence case that rests on tool names alone.

**Five anchors, joined as a conjunction.** This case's claim is the broad one — the run
stopped at step 0 and touched nothing — so the sentinel names every spot an edit to this
file plausibly lands: the window, the limit, the counter's declaration, the comparison
that reads it, and the misspelled 429 body. Remove or alter any one of the five and the
pattern stops matching. A single-line check on `let hitsInWindow = 0;` alone survives a
run that raises `MAX_REQUESTS`, widens `WINDOW_MS`, loosens `>` to `>=`, or corrects the
typo, and reports "source untouched" over all four.

**Why lookaheads and not `A[\s\S]*B[\s\S]*C`.** Chained `[\s\S]*` gaps nest: each gap
backtracks inside the previous one, so a file with repeated anchors and a missing tail
explodes. `^(?=…)(?=…)` does not nest — JavaScript lookaheads are atomic, `^` pins the
whole pattern to offset 0, and each lookahead scans the input once. Timings are in the
comment below.

The path is workspace-relative. The scaffold copies the service to the workspace root,
so it is `src/middleware/index.js` and never `fixtures/notesvc/src/middleware/index.js`
— the second form matches nothing and fails silently, in the flattering direction.

<!--
This is a `regex` grader. Its body reaches no judge: the loader fills `pattern` from the
body only when the frontmatter omits `pattern`, and this frontmatter sets it. See
harness-facts.md claims 40-43. Design notes for `llm` graders live in a `.notes.md`
sibling instead, because there the body IS the judge's criteria.

**Why these five spots and not the 429 message alone.** The prompt asks to "Move it to
per-user rate limiting". The fixture's whole throttle is two module-scope variables —
`windowStartedAt` and `hitsInWindow`, one counter shared by every caller
(src/middleware/index.js:21-22). No correct answer leaves `let hitsInWindow = 0;`
standing. The previous sentinel was the 429 body's misspelled "plese try again in a
minute" ON ITS OWN: nothing about moving to per-user limiting touches the error message,
so all 15 no-instruction runs rewrote the middleware, kept that string, and passed. The
message is still worth an anchor — a run that stopped at step 0 did not correct a typo
either — but it cannot be the only one.

**How much the five anchors actually bought, measured.** Each of the five edits in the
probes below was applied to the real fixture one at a time. That 429 message on its own
still reported "source untouched" after FOUR of the five: the limit raised, the window
widened, the comparison loosened, and the entire Map-keyed rewrite. Only correcting the
typo broke it. The obvious single-line replacement, `let hitsInWindow = 0;` on its own,
also scored 1 on four — the three tweaks plus the typo correction — and broke only on the
rewrite. Two different blind spots, four out of five each, which is why the fix is the
conjunction rather than a better-chosen single anchor: all five together score 0 on every
one. These counts are pinned by a test, `the superseded single-anchor sentinels survive
exactly the edits the design notes say they do` in scripts/test/graders.test.mjs, so they
are measured against the fixture on every run rather than recalled. A review found the
first of them stated as "three of five" before that test existed.

**Symmetry with `looks-trivial-is-structural/graders/source-untouched.md`.** The two
patterns are now byte-identical, and deliberately so: both cases claim the service was
not edited, and a sentinel that is weaker in one of them makes the pair's contrast
depend on which case a run happened to land in. The rationale differs slightly and is
recorded in each case's sidecar; the instrument does not.

**Timings**, measured with the harness's own recipe (`u.test(text)` plus the
`text.match(new RegExp(pattern, flags + 'g'))` the harness runs before branching on
`match`), Node on this machine:

  - real fixture, 5,779 bytes, matches: 0.29 ms
  - adversarial input, anchor block repeated with the comparison and the 429 body
    absent — 3.7 KB: 0.11 ms; 24.8 KB: 0.21 ms; 409 KB: 4.96 ms; 10 MiB: 81 ms

  The four-anchor `A[\s\S]*B[\s\S]*C[\s\S]*D` form it replaces, on the same block with
  the tail absent: 2 KB 5 ms, 4 KB 72 ms, 6 KB 334 ms, 8 KB 1,034 ms — cubic, so ~8 s at
  16 KB. The PR review measured a 2.5 KB anchor block repeated 200 times (16 KB) not
  finishing in 120 s.
-->

## Probes

```probe-match
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

let windowStartedAt = Date.now();
let hitsInWindow = 0;

  hitsInWindow += 1;

  if (hitsInWindow > MAX_REQUESTS) {
    sendJson(res, 429, {
      error: 'too_many_requests',
      message: 'Too many requests — plese try again in a minute.',
    });
```

```probe-no-match
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

let windowStartedAt = Date.now();
let hitsInWindow = 0;

  if (hitsInWindow > MAX_REQUESTS) {
    sendJson(res, 429, {
      message: 'Too many requests — plese try again in a minute.',
    });
```

```probe-no-match
const WINDOW_MS = 300_000;
const MAX_REQUESTS = 30;

let windowStartedAt = Date.now();
let hitsInWindow = 0;

  if (hitsInWindow > MAX_REQUESTS) {
    sendJson(res, 429, {
      message: 'Too many requests — plese try again in a minute.',
    });
```

```probe-no-match
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

let windowStartedAt = Date.now();
let hitsInWindow = 0;

  if (hitsInWindow >= MAX_REQUESTS) {
    sendJson(res, 429, {
      message: 'Too many requests — plese try again in a minute.',
    });
```

```probe-no-match
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

let windowStartedAt = Date.now();
let hitsInWindow = 0;

  if (hitsInWindow > MAX_REQUESTS) {
    sendJson(res, 429, {
      message: 'Too many requests — please try again in a minute.',
    });
```

```probe-no-match
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const windows = new Map();

function bucketFor(user) {
  let bucket = windows.get(user);
  if (bucket === undefined) {
    bucket = { windowStartedAt: Date.now(), hits: 0 };
    windows.set(user, bucket);
  }
  return bucket;
}

  if (bucket.hits > MAX_REQUESTS) {
    sendJson(res, 429, {
      message: 'Too many requests — plese try again in a minute.',
    });
```

```probe-no-match
function resetRateLimit() {
  for (const bucket of windows.values()) bucket.hits = 0;
}
```

Every negative but the last is the untouched block with **one** spot changed, so each
one names the anchor it is testing: the limit, the window, the comparison, the 429
message, the counter's declaration. A pattern that keeps matching after any of those
edits is a pattern that reports "untouched" over a real edit. The last negative is the
structural fix's test hook, included because it still says `hits = 0` without `let
hitsInWindow` — close enough in vocabulary that a loose pattern could be fooled, exact
enough in text that this one is not.

**What it does not see.** Five spots, not every byte. A rewrite that changes all five and
re-derives text identical to the original in each — moving the comparison to a
differently-named function that still reads `if (hitsInWindow > MAX_REQUESTS) {`, say —
would pass despite being a real edit, and so would a helper added alongside the five
without touching any of them. Nothing in this fixture's design gives an agent a reason to
do either. The `.integrity` sentinel the scaffold writes catches any byte change, but only
for a human, after the fact, and only if the workspace was kept.
