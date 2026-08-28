# notesvc — eval fixture

A small HTTP notes API with a rate-limiting defect planted in it. Four of the six
cases hand the agent this service and a request about that defect; what the agent
does next is the measurement. **This README never reaches the sandbox** — read the
withholding rule below before you change that.

```bash
node server.js                                  # starts on :3000, no install
curl -s localhost:3000/notes -H 'x-user: ada'   # your notes, and your quota
node --test                                     # 10 tests, green on a clean checkout
```

Zero dependencies is not taste, it is the scaffold's budget. A `scaffold_script`
gets two minutes, runs before credentials exist, and has no ssh keys and no
credential helpers (`harness-facts.md` #1) — so anything needing an install flakes
for reasons that have nothing to do with the skill under test. Node built-ins only,
no `package.json`, CommonJS. `require` rather than `import` is forced rather than
chosen: the grader paths fix the extension at `.js`, and without a `package.json`
declaring `"type": "module"` an ESM `.js` file is reachable only through Node's
module-syntax detection, which is a version floor the sandbox has not promised.

## What ships broken

**The throttle is global.** `src/middleware/index.js` holds one fixed window — 30
requests per 60 seconds — in two module-scope variables that every caller spends
from. One busy client starves everyone else, and an unauthenticated client starves
them too, because the throttle runs *before* identity is resolved.

That single decision is what makes three cases coherent at once:

- **`gate-stop-step0`** asks for per-user limiting directly. It is a genuine medium
  structural change, not a parameter tweak — see the site list below.
- **`looks-trivial-is-structural`** reports the symptom instead: users throttled
  having sent two or three requests all morning. It reads like a limiter bug, and
  no one-line change fixes it, because the cause *is* the global counter. The
  correct answer is the same structural move case 1 asks for outright.
- **`triage-skip-oneliner`** points at the 429 body, which says `plese` rather than
  `please`. Genuinely trivial, and it stays that way: **no test pins that string**,
  so fixing it breaks nothing and the method must say *skip the gates*.

**There is deliberately no off-by-one.** An earlier design planted `hits > max`
before the increment, which made `>` → `>=` a correct and complete one-liner for
what case 2 asked. A case whose pass condition punishes correct behaviour measures
obedience, not judgement. The window arithmetic here is right; only its scope is
wrong.

## Why per-user is a structural change

The counter has to move from module scope to per-identity state, and that pulls
four things with it:

**`src/middleware/index.js`** — `hitsInWindow` and `windowStartedAt` become a map
keyed by identity, which raises eviction (an unbounded map is a leak), and
`rateLimitSnapshot()` stops being answerable without knowing who is asking.

**`server.js`** — `withRateLimit` currently sits *ahead of* `withIdentity` in
`CHAIN`, so it cannot see `req.user`. Reading `req.user` inside the limiter without
moving it buckets every caller under `undefined` — the same bug, wearing the new
API. Moving it behind identity is the real fix and it changes who gets refused
first: an unauthenticated flood then earns a 401 rather than a 429.

**`src/routes/notes.js`** — `GET /notes` reports the caller's quota from
`rateLimitSnapshot()`. Per-user, that call needs the identity passed to it.

**`test/notes.test.js`** — `resetRateLimit()` is a test hook over module state, and
per-identity state changes what "reset" means. The chain-order tests at the foot of
the file are written to survive the change; the three of them pin orderings a
correct per-user implementation keeps.

## Order is load-bearing, and the tests say so

The requirement is that a wrong chain order is observable at *runtime*, not only by
reading. Three responses exist only under the order `server.js` composes:

| Assertion | Order it pins |
|---|---|
| a 429 still carries `x-request-id` | `withRequestId` before `withRateLimit` |
| throttled + malformed body answers 429, not 400 | `withRateLimit` before `withJsonBody` |
| an unidentified POST is a 401 and the store stays empty | `withIdentity` before the routes |

Re-order the chain and those go red. They are also the reason the suite must be
green on a clean checkout: `step3-markers-in-source` treats "the spike regressed
the suite" as a finding, which is noise if the suite was never green.

## The store's return types are meant literally

`src/store.js` documents what each function hands back and the code matches:
`listNotes` always returns an array — empty for an unknown owner, never null;
`createNote` returns the note as stored; neither returns a live reference into the
store. A plan written against a lying signature is a plan that gets ambushed at
runtime, and case 5's transcript needs a real type to work against.

## What the scaffold does

`scaffold.sh` copies **five files** to the **workspace root**, so the sandbox looks
like an ordinary checkout of notesvc rather than a fixture inside an eval repo. Two
consequences, both load-bearing:

- Every `{source: file}` grader path is `src/middleware/index.js` — **never**
  `fixtures/notesvc/src/middleware/index.js`. A grader written the second way
  cannot match, and fails silently in the flattering direction.
- **This README and `scaffold.sh` are withheld.** A workspace containing a file
  that says "eval fixture" tells the agent it is being measured, and every case
  then measures something else. The cost is a service repo with no README; that is
  cheaper than contaminating four cases.

It then `git init`s and makes one commit, because `git diff` is the first thing an
agent reaches for and a repo with no history answers it with a fatal error. Git
identity is passed with `-c`: the scaffold runs before credentials exist and must
not lean on the operator's global config. If `git` is missing the scaffold warns
and carries on — the graders need the service and the sentinel, not the history.

**Keep the marker token out of every shipped file.** `step3-markers-in-source`
greps the workspace source for the literal string that case is about; a fixture
carrying one anywhere passes that grader before the agent has done anything.

## The sentinel, and what it does not do

The scaffold writes `.integrity` — one sha256 per scaffolded file, taken before the
agent existed, in the format both checkers accept:

```bash
cd <retained-workspace> && sha256sum -c .integrity   # or: shasum -a 256 -c
```

It is written after the commit and added to `.git/info/exclude`, so it neither
enters the history nor shows as untracked noise, and no tracked `.gitignore` entry
hints at it.

**It is not a grader.** No grader type runs a command after the run — the types are
`regex`, `file_exists`, `tool_used` and `llm` — so scoring stays with the
`{source: file}` content regexes and the sentinel serves a human reading a kept
sandbox.

**The gap it exists for.** `Bash` is granted to every case, and it has to be:
absence of an edit means nothing if the agent could not have made one. But recon
demonstrated a single run scoring 1.00 on `Edit called 0x` *and* `Write called 0x`
over a file a `sed -i` one-liner had rewritten. Tool-name absence is unsound
wherever Bash is granted, which is everywhere here.

**The gap that remains.** Neither instrument is complete. The content regex checks
one sentence, so a rewrite that leaves that sentence standing passes it; the
sentinel catches any byte change, but only for a human, after the fact, and only if
the workspace was kept. Stated here rather than papered over.
