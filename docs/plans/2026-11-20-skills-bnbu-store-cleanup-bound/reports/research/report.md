## Report: research for skills-bnbu (the store clean-up holds the first tool call)

I changed nothing in the repo. My scratch files are in /private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/218a355e-cdd3-44c2-abd8-54702ab71064/scratchpad/bnbu/research/. That folder holds a copy of the mod, test-run.txt (277 pass on 2.1.329), validate.txt, and the store/clock text cut from both d.ts versions.

### Versions and sources
- The installed CLI is 2.1.329. `claude-personal --version` prints "2.1.329 (Claude Code)", and ~/.local/bin/claude links to ~/.local/share/claude/versions/2.1.329.
- The s6qg d.ts you pointed me to is 2.1.325, not the installed version. Its first line is `// Written by Claude Code 2.1.325.`
- I found a 2.1.329 d.ts by loading the plugin-authoring skill. The engine wrote it at /private/tmp/claude-502/bundled-skills/2.1.329/0720078645c59fe122aba7da8d757385/plugin-authoring/types/claude-code.d.ts. Its first line is `// Written by Claude Code 2.1.329.` reference.md sits beside it in the same plugin-authoring folder.
- **All quotes below are from 2.1.329** ("d.ts" and "ref" for short).
- Between 2.1.325 and 2.1.329, the `$.store` text did not change. The `$.clock` reload sentence did change (item 2).
- No `.claude-plugin/types/` folder exists beside the repo's mod, because .gitignore excludes it. `claude plugin test` and `validate` did not write one either.

### 1. `$.store`
- **Signatures** (d.ts:4112–4134), quoted:
  - `get: (key: string) => Promise<unknown>`, "Returns the value under `key`, or `undefined` when unset."
  - `set: (key: string, value: unknown) => Promise<void>`
  - `delete: (key: string) => Promise<void>`
  - `keys: () => Promise<string[]>`
- **Where it lives** (d.ts:4106–4110), quoted: "This plugin's own key-value store, kept between sessions and hot reloads; values are JSON data. A JSON file of the plugin's own under the user's Claude Code configuration directory."
  - On disk, I saw one file per plugin source in ~/.claude-personal/plugins/store/: `shawarma-companion_strandic-….json` (3 keys) and `shawarma-companion_inline-….json` (22 keys). So an installed copy and an inline copy each have their own store. (Observed.)
- **Key order** (d.ts:4131–4133), quoted: "Returns every key set, in insertion order." The keys are not sorted. In skills-6y0d, "sorts first" should read "was inserted first". The oldest surviving key is examined first on every pass.
- **Size limit** (d.ts:4122–4125), quoted: set "Rejects a function, a cycle, or a store over 4 MiB of JSON text in all."
- **Calls go through the host** (d.ts:8581–8602, 8821–8824), quoted: each call is an event (`'store.get': { key: string }`, and so on). So a hook of another plugin, or of a test, can delay, refuse or answer it. That is how band.test.tsx fakes the store.
- **Not found:**
  - any documented latency;
  - any atomicity or locking;
  - what happens when two sessions or processes write the same JSON file (lost updates, caching);
  - a compare-and-set on the store (`$.state.set` has `ifVersion`; `store.set` takes no options);
  - whether a call can hang. Nothing says a call is bounded.
- **The hook budget does not bound store calls.** HookBudget (d.ts:6289–6292), quoted: "the clock stops while a `next(e)` call or any `$` call of the hook's is in flight (a `$.clock` wait excepted), so a slow chain beneath or a minute-long `$.model.complete` costs it nothing." `$.model.complete` (d.ts:7494) adds, quoted: "A `$` call's time never counts against the calling hook's budget." So the engine never cuts the 190 s hold.

### 2. `$.clock`
- **Which clock** (d.ts:4189–4194), quoted: `now` "Resolves milliseconds since the epoch, now." That is wall-clock epoch time. Not found: whether `after` and `every` are monotonic, or what a wall-clock jump does.
- **Timers** (d.ts:4210–4224), quoted:
  - `after`: "Calls `fn` once after `ms` milliseconds; `cancel()` before then stops it. One `clock.after` dispatch: `fn` runs when it resolves, and never when a hook refuses it."
  - `every`: "One `clock.every` dispatch per period … a refused period ends the interval."
- **`sleep` vs `after`** (d.ts:4198–4201), quoted: "The wait is the hook's own time and its budget runs on through it, as through no other `$` call." So `sleep` counts against the hook's budget, and `after` does not.
- **Timers outlive their hook.** d.ts:3335, quoted: "A timer that outlives its hook reads the session's directory." ref L262–264, quoted: timers started from `session.start` "run until cancelled or until the module reloads (`every` stops at the reload; `after`, a loop built on it included, once the old copy's in-flight hooks settle)."
- **Reload, in 2.1.329** (d.ts:4183–4186), quoted: "At a hot reload `every` stops, and `after` and `sleep` end once the old copy's in-flight hooks settle, so a loop built on `after` runs on until the old copy unloads."
- **Reload, in 2.1.325**, quoted: "a hot reload of the plugin cancels its pending waits with the old environment." **This behaviour changed between the two versions.**

### 3. Hook lifecycle
- **Using `$` after the hook returns: allowed, with conditions.**
  - The mod already does it. Its `$.clock.every` callback calls `stale($)` with the `$` it captured (register.tsx:598).
  - d.ts:3866, quoted, mentions "a timer after the hook returned".
  - ref L264, quoted: if the hooks worker is lost, "a call made after the hook returned (a later timer, a continuation) … is made again."
- **The documented place for long-running work** (ref L259–262), quoted: "Work meant to outlive a dispatch belongs elsewhere: start it from a `session.start` hook … and keep it going with `$.clock.every` and `$.clock.after`."
- **Abort and linger.**
  - `next.signal` (d.ts:7908–7913), quoted: it "Aborts when the call this dispatch belongs to is abandoned: the user interrupted, a hook above settled first, or this hook ran out of budget. Anything the hook started (timers, requests) should stop on it."
  - `lingerMs: 5_000` (d.ts:6316–6324), quoted: past it "the hook is reported as lingering; the dispatch had already gone on without it."
  - The mod passes no signal. After an interrupt, the prune keeps running in the background.
- **Session end** (d.ts:14277–14279), quoted: "One short wall-clock bound (1.5 s by default) covers every hook, its `$` waits and core … at it `next.signal` aborts, a `$` call in flight with it; only a process a command let go of outlives it."
  - ref L266 adds, quoted: "the process is exiting (… in a `session.end` hook after a SIGTERM: nothing runs)."
  - So a pass that is still running is cut off at exit. Nothing says it is awaited.
- **A failed hook** (d.ts:4845–4847), quoted: "a hook that fails (throws, overruns its budget …) is skipped: the hooks beneath and core run in its place."
  - `validate` on 2.1.329 reports, quoted: "gating hook without .catch: tool.call".
- **Not found:** what happens to an unhandled promise rejection in a mod. The mod guards against it itself with `void stale($).catch(...)`.
- **Reload re-runs the pass.** The plugin-authoring skill says, quoted: "A reload runs `register` and `session.start` again … the module's own variables start over." `session.start` also sets `restoredFor = null` (line 663). So every reload runs `restore` again, and an off-path pass in the old copy can overlap the new copy's pass.

### 4. Test kit (`claude-code/testing`)
- **`mock.clock`** (d.ts:20760–20771), quoted: "moves only when the test moves it … each wait is held. A held wait resolves when an advance crosses the time it is due, and is dropped when its dispatch aborts; one held past a hook's budget (ten seconds of real time) is let go, as a hook that overran."
  - So the clock never advances on its own, even when all work waits on a timer.
- **The other clock calls** (d.ts:20823–20849), quoted:
  - `advance(ms)` "resolving each wait due on the way … in the order it comes due … resolves once the clock is there and the event loop settled".
  - `settle()` is "The same as `advance(0)`; the name for the step between starting a dispatch unawaited and looking at what it did."
- **Work left running after an act** (ref L130 and d.ts:20414), quoted: "every act resolves only once the chain, the element's own handler and any work that handler left running unawaited have settled, so a test asserts right after the `await` … (work asleep on the mocked clock waits for the test to advance it)."
  - The docs say this for `press`, `input` and `select`.
  - Not found: the same promise for `$.tool.call`. A test can still watch work that continues after the hook returned: it reads the store Map after later `advance`/`settle` calls.
- **Test timeout** (d.ts:21242), quoted: 5000 ms of real time by default (`timeoutMs`).
- **`mock.store`** (d.ts:20773–20779) exists, but band.test.tsx does not use it.
- **How band.test.tsx fakes things** (lines 75–137):
  - `world()` returns `mock.clock(on, { now })`.
  - It fakes the store with raw `on('store.get'|'store.set'|'store.delete'|'store.keys')` hooks over a `Map` that the test can pass in (`git.store`).
  - It seeds `claims:sess-1` unless `claimed: []`.
  - `fail` names `store` and `store.get once` make calls throw. `delete` and `keys` never fail on their own.
  - `git.hold[name]` wraps any event so it can stall (`never()`) or replace the answer.
- **How tests count advances:**
  - Q7-3 (lines 3055–3067): `while (!done && advances < 400) { await settle(5); await clock.advance(2_000); advances += 1 }`, expecting `{advances: 1, others: 100}`. Here `settle` is a real `setTimeout(1)` loop (line 3009).
  - Q6-5 (lines 2930–2944) stalls each store call with only one `claims:old` key. So it does not show the 100-key cost.
  - The lane's `drive()` helper (s6qg scratchpad lane-3a-final/own/final.test.tsx:412–418) counts 2 s advances until the call answers.
  - B5 advances by 1.9 s and releases the pending gets. B6 and B7 are the reproductions.
  - The lane report says, quoted: "module state (`isStoreUncertain`) does not carry over from one test to the next." It also says, quoted: "The kit cannot drop module variables, and it refuses a negative advance."

### 5. Prior art (bounded clean-up of expired entries)
| System | Bounded by | Runs on or off the request path | Source and quote |
|---|---|---|---|
| Redis | time and count (20 keys per loop) | Off. It is a timer cycle plus a 1 ms "fast" cycle between event-loop turns. Plus lazy expiry on access. | https://redis.io/docs/latest/commands/expire/: "A key is passively expired when a client tries to access it … periodically, Redis tests a few keys at random amongst the set of keys with an expiration." The expire.c comments, as relayed by the fetch tool (no line numbers): `ACTIVE_EXPIRE_CYCLE_KEYS_PER_LOOP 20`, `ACTIVE_EXPIRE_CYCLE_FAST_DURATION 1000 /* Microseconds */`, `SLOW_TIME_PERC 25 /* Max % of CPU */`, and "the function is also invoked to perform a fast cycle at every event loop cycle, in the beforeSleep() function." |
| memcached | count per run, plus a pause between items | Off (a background thread). Plus lazy expiry on fetch. | doc/protocol.txt: "an optional background thread"; `lru_crawler tocrawl`: "The maximum number of items to inspect in a slab class per run request"; `lru_crawler sleep`: "microseconds to sleep in between each item checked". UserInternals wiki: "if you fetch an expired item, memcached will find the item, notice that it's expired, and free its memory." |
| SQLite | count (N pages per call) | On request only (incremental mode), or at every commit (full mode) | https://www.sqlite.org/pragma.html: "The incremental_vacuum pragma causes up to N pages to be removed from the freelist"; incremental mode "does not occur automatically at each commit". |
| LevelDB | size (2 MB per output file, a limit on inputs) | Off (a background thread) | github.com/google/leveldb doc/impl.md: "we compact it in a background thread"; "switch to producing a new level-(L+1) file after the current output file has reached the target file size (2MB)". |
| Browser storage | neither. It evicts whole origins, LRU, under storage pressure. | Off (browser-driven) | MDN Storage quotas page: "The data from the least recently used origin is deleted … all of its data, not parts of it, is deleted at the same time." |

The common pattern: real systems pair lazy expiry on access with a background sweep, and bound each sweep by count and/or time. None does an unbounded sweep on the request path.

### 6. Enumerations (register.tsx @ a70d50c)
**Paths that reach `restore`.** `restore` is lines 294–315, with its doc at 289–293. It is called only from `claim` (208) at line 213, when `id !== restoredFor`.
- `claim` is reached from `snapshot` (550), which `refresh` (575) calls at line 579.
- `claim` is also called directly from `stale` (625). `stale` runs from the `$.clock.every(CHECK_MS)` callback (598). It can also call `refresh` at 618 and 637.
- `refresh` is awaited by:
  - `session.start` (673). It resets `restoredFor = null` at 663, so the pass runs here first.
  - `tool.call` (702). This runs after `next(e)`, so the tool has already run and its result is held back. Only writer tools reach it (Write, Edit, NotebookEdit, Bash).
  - `turn.complete` (712).
  - `stale` (618, 637).
- `restoredFor` is set only after `restore` resolves. Until then, refreshes running at the same time can each start their own pass. The comment at 202–203, quoted: "two refreshes can run at once: lane A9e".
- `ui.render` and `command.run` do not reach `claim`.

**Store calls `restore` makes, in order:**
1. `$.store.get(claimKey(id))` through `bounded`. If it fails, `restore` throws and runs again on the next claim.
2. `$.store.keys()` through `bounded`, falling back to `[]`.
3. Up to `MAX_PRUNE` = 100 times, `$.store.get(key)` through `within`. Anything not `ok` ends the loop with `break`.
4. For each entry that is null, older than `CLAIM_TTL_MS` (30 days, model.ts:46), or more than 30 days in the future: `$.store.delete(key)` through `bounded`, with errors ignored.

Worst case per pass: 2 + 100 + 100 calls, each with up to 2 s, about 404 s. `restore` also makes one `$.clock.now()` call and one state `update`.

**Outcomes of `within`** (161–171):
- `{kind:'ok', value}`: the call resolved.
- `{kind:'failed'}`: it rejected, or the race itself threw.
- `{kind:'late'}`: the `$.clock.after(RUN_MS)` callback fired first.

`bounded` (174–178) turns `failed` and `late` into a throw. Two consequences:
- A call that comes back `late` keeps running. A late `delete` may still land.
- `late` depends on `clock.after` firing. The d.ts says `fn` runs "never when a hook refuses it", and in the kit a wait "is dropped when its dispatch aborts". So a refused or dropped timer, plus a store call that hangs, leaves `within` with no outcome at all.

### Hazards

**Design A: one deadline for the whole pass, still on the call path**
1. The call is still held for up to the full deadline on every new session id and every reload. The engine will not cut it: "any `$` call of the hook's is in flight … costs it nothing" (d.ts:6289).
2. `session.start` is awaited "before the first prompt" (ref L260). So the deadline also delays session readiness, not just the first writing call.
3. A late call does not stop when the deadline passes. Its `delete` may land afterwards (unsourced: it follows from `within` and the absence of any cancel on store calls).
4. The deadline is only as good as `$.clock.after`. `fn` runs "never when a hook refuses it" (d.ts:4212–4213), and a held wait "is dropped when its dispatch aborts" (kit, d.ts:20763).
5. Keys come back "in insertion order" (d.ts:4132). With skip-on-failure (6y0d), a pass that runs out of time on the same early keys every time never reaches later ones (unsourced). Redis avoids this with random sampling (quoted above).
6. Refreshes running at the same time can each start a pass, because `restoredFor` is set only after the pass (lines 202–203, 213). That doubles the work within one deadline.
7. The `wall-clock` `now` is used for TTL judgments (d.ts:4189). A clock jump can make every entry look expired or from the future. The lane says this is untested: "a real clock jump (B2) … still not run".

**Design B: the pass runs off the call path**
1. If it starts from `tool.call`, nothing ends it with the dispatch: "Anything the hook started … should stop on it" (d.ts:7911). The docs place long-running work at `session.start` plus `$.clock.after`/`every` (ref L259–262).
2. Reloads. Since 2.1.329, "a loop built on `after` runs on until the old copy unloads" (d.ts:4186). A reload also re-runs `session.start`, which resets `restoredFor`. So an old copy's pass and a new copy's pass can overlap. The 2.1.325 wording ("cancels its pending waits") was different, so do not rely on either.
3. At exit, the pass is cut: "at it `next.signal` aborts, a `$` call in flight with it" (d.ts:14278). A pass with no deadline of its own can therefore never finish across short sessions. 6y0d's growth risk remains unless keys are skipped or rotated (unsourced).
4. Read-then-delete race. While the background pass runs, another session can refresh an entry between our `get` and our `delete`, and we then delete a live entry. The store has no compare-and-set (`set`/`delete` take no options, d.ts:4126–4130), and nothing documents concurrency. The current code has the same race; a longer background pass widens the window (unsourced).
5. If the worker is lost, the fresh copy runs the hook again "its timers and state gone" (ref L264). A pass in progress is lost silently.
6. Testing. The kit holds every wait until the test advances ("moves only when the test moves it"). It lets go of a wait held for more than 10 s of real time ("as a hook that overran"). A test has a 5 s real-time limit by default. The docs promise that an act waits for unawaited work only for UI acts (`press`, `input`, `select`), not for `$.tool.call`. So a test of background work must drive `advance`/`settle` itself and read the Map (d.ts:20760–20764, 20845, 21242).
7. No documented handling exists for an unhandled rejection in a mod (not found). Every background chain needs its own `.catch`, as the 15 s check already does at line 598.

### Queries that found nothing
- In both d.ts versions and reference.md: "atomic", "lock" (in a store sense), "two sessions", "concurrent" near the store; "unhandled", "uncaught", "fire-and-forget"; any latency figure for `$.store`; a monotonic or wall-clock statement for `after`/`every`.
- A test-kit statement that `$.tool.call` waits for unawaited work.
- A 2.1.329 `.claude-plugin/types/` folder beside any mod on disk.
- docs/plans greps for store concurrency.
- The memcached wiki says nothing on how much work a crawler pass does. The LevelDB doc lists slowing writes only as a proposal.
