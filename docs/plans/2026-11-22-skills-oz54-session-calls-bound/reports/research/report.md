Research report: bounding `$.session.*` calls in shawarma-companion (bean skills-oz54, "a session.cwd call that never answers")

**Versions.** I loaded `plugin-authoring` and got the 2.1.330 types file. I diffed it against the 2.1.329 copy. The two differ only in unrelated places: Button `onPress` async, a `vcs` noun, `focus` open, `session.repo`, and machine info. The `$.session` docs, `HookBudget`, `$.clock`, `Timer` and the test kit are word for word the same in both. I give 2.1.329 line numbers for the key rows as a cross-check.

Path aliases used in the rows below:
- d.ts = /private/tmp/claude-502/bundled-skills/2.1.330/7e6893196cbe463bcf44781442c66d8a/plugin-authoring/types/claude-code.d.ts
- d.ts(329) = /private/tmp/claude-502/bundled-skills/2.1.329/0720078645c59fe122aba7da8d757385/plugin-authoring/types/claude-code.d.ts
- ref.md = /private/tmp/claude-502/bundled-skills/2.1.330/7e6893196cbe463bcf44781442c66d8a/plugin-authoring/reference.md
- reg = /Users/jonathan/Documents/strandic-skills/mods/shawarma-companion/hooks/register.tsx
- test = /Users/jonathan/Documents/strandic-skills/mods/shawarma-companion/tests/band.test.tsx

**Correction to the brief.** The claim is in `mods/shawarma-companion/README.md:40`, not the root `README.md:40`.

## 1. `$.session.cwd`, `.root`, `.usage`, `.id`

| Sentence it supports | path:line@version | Verbatim quote |
|---|---|---|
| `cwd` returns a plain Promise<string>; its doc does not say it can reject or hang, and gives no time limit | d.ts:3339-3344@2.1.330 (d.ts(329):3338) | "Returns the directory the session runs in, absolute. … A timer that outlives its hook reads the session's directory; keep the value read inside the hook if you need the hook's (a subagent's own)." / `cwd: () => Promise<string>;` |
| `root` is the same: Promise<string>, no rejection or time limit documented | d.ts:3346-3352@2.1.330 (d.ts(329):3346) | "Returns the session's project root, absolute: where it started, or where `/cd`, a host's directory change or a worktree move took it." / `root: () => Promise<string>;` |
| `id` is the same | d.ts:3363-3365@2.1.330 | "Returns the session's id (the transcript file's name)." / `id: () => Promise<string>;` |
| `usage` with no argument "costs nothing"; with a breakdown it calls the token-count API, so that form is slow | d.ts:3402-3419@2.1.330 (d.ts(329):3411) | "The plain call costs nothing; `\"full\"` counts each category with the token-count API as /context does" / `usage: (args?: SessionUsageArgs) => Promise<SessionUsage>;` |
| Only `surfaces()` is documented as never rejecting, so the docs promise that for none of the four | d.ts:3382@2.1.330 | "Empty in a plain -p run; never rejects." |
| The engine stops a hook's own budget clock while a `$` call is in flight | d.ts:6725-6727@2.1.330 (d.ts(329):6292 area) | "Each bounds the hook's OWN time: the clock stops while a `next(e)` call or any `$` call of the hook's is in flight (a `$.clock` wait excepted)" |
| The engine's only time limits on `$` calls: 30 s on `ui.render` and `tool.list`, 20 minutes on `tool.call` | d.ts:6728-6734@2.1.330 (d.ts(329):6292) | "On `tool.list` and `ui.render` a hook's `$` calls hold it for 30 seconds in all, then fail it; on `plugin.register` for 10 seconds … On `tool.call`, `tool.check`, `tool.judge`, `tool.run` and `classic.PreToolUse` for 20 minutes" |
| A hook's own budget is 10 s, but `$` time does not count toward it | d.ts:6741-6748@2.1.330 | "A hook's budget per dispatch, from its call to its return; past it the hook is absent … `readonly ms: 10_000;`" |
| A hook that fails is skipped and the chain goes on; for a guard that means it fails open | d.ts:4960-4962@2.1.330 | "a hook that fails (throws, overruns its budget: HookBudget, answers a wrong shape) is skipped: the hooks beneath and core run in its place, or its last `next` result stands" |
| Only `session.end` has a wall-clock cut that includes `$` waits | d.ts:8428-8430@2.1.330 | "Except under a cut of the whole dispatch (`session.end`): the cut's clock never stops, `$` waits included" |
| The bean's own probe: a hanging `session.cwd` held a Bash call past 10 s of engine clock | /Users/jonathan/Documents/strandic-skills/.beans/skills-oz54--shawarma-companion-a-sessioncwd-call-that-never-an.md:13 | "With session.cwd never answering, the first Bash call was still pending after 10 s of engine clock (PROBE-F sessionCwdHang done=false); the hang at line 705 comes before next(e), so the tool call never runs." |

The docs give no limit for `$` calls in `session.start` or `turn.complete` hooks.

Current unbounded sites, from my grep of reg:
- **cwd**: lines 219, 396, 649, 706, 719, 737.
- **root**: lines 396 and 417. Line 396 falls back to an unbounded `$.session.cwd()` when root fails.
- **usage**: lines 585 and 765.
- **Already bounded**: lines 210 (`id`) and 220 (`root`).

## 2. `$.clock`

| Sentence it supports | path:line@version | Verbatim quote |
|---|---|---|
| Each clock call is a dispatch through the host | d.ts:4190-4191@2.1.330 | "The time and timers, each an event through the host: `clock.now` reads the time; `clock.sleep`, `after` and `every` wait until it has passed." |
| `now` resolves the epoch ms | d.ts:4200-4205@2.1.330 | "Resolves milliseconds since the epoch, now." / `now: () => Promise<number>;` |
| `after` runs `fn` once; `cancel` stops it | d.ts:4221@2.1.330 | "Calls `fn` once after `ms` milliseconds; `cancel()` before then stops it." |
| **If a hook refuses the `clock.after` dispatch, `fn` never runs. The race then has no bound, and the work is waited for as long as it takes.** | d.ts:4223-4224@2.1.330 (d.ts(329):4213) | "One `clock.after` dispatch: `fn` runs when it resolves, and never when a hook refuses it." |
| The README already discloses this risk for the store | mods/shawarma-companion/README.md:40 | "All three limits rely on the engine's timer; if the engine never fires it, a store call that never answers holds the update." |
| `cancel()` is final | d.ts:17689-17692@2.1.330 | "Stops it; a stopped timer never fires again." |
| `TimerCall` returns its Timer synchronously | d.ts:17699@2.1.330 | `export type TimerCall = (ms: number, fn: () => void) => Timer;` |
| A hot reload ends pending `after` waits only once the old copy's in-flight hooks settle | d.ts:4194-4196@2.1.330 | "At a hot reload `every` stops, and `after` and `sleep` end once the old copy's in-flight hooks settle" |
| `sleep` counts against the hook's budget; `after` does not block the hook | d.ts:4209-4210@2.1.330 | "The wait is the hook's own time and its budget runs on through it, as through no other `$` call" |

## 3. Test kit

| Sentence it supports | path:line@version | Verbatim quote |
|---|---|---|
| `mock.clock` holds every wait until the test advances it | d.ts:21581-21586@2.1.330 | "Answers `$.clock` from a clock in memory that moves only when the test moves it … A held wait resolves when an advance crosses the time it is due, and is dropped when its dispatch aborts; one held past a hook's budget (ten seconds of real time) is let go, as a hook that overran." |
| `advance` resolves the due waits in order, then settles the event loop | d.ts:21644-21653@2.1.330 | "Moves the clock on, resolving each wait due on the way (`$.clock.sleep`, `after`, `every`, this clock's `sleep`) in the order it comes due." / `advance: (ms: number) => Promise<void>;` |
| `settle` is `advance(0)` | d.ts:21662-21670@2.1.330 | "The same as `advance(0)`; the name for the step between starting a dispatch unawaited and looking at what it did." |
| `clock.sleep(ms)` is the kit's way to make a test hook answer late | d.ts:21672-21678@2.1.330 | "Resolves once the clock has moved this far past now: how a hook of the test's answers late." |
| The kit has no mock for `session.cwd`, `root` or `usage`; a test hooks them with `on` | d.ts:21623-21624@2.1.330 | "The world beneath the plugins, mocked noun by noun: `mock.clock`, `mock.store`, `mock.env` and `mock.session`." |
| `mock.session` only records appends | d.ts:21692-21702@2.1.330 | "appended: () => readonly SessionAppendInput[];" |
| The test's `on` hooks sit beneath the plugin and stand for the engine | ref.md:130@2.1.330 | "a test holds the engine's `$` and an `on` whose hooks sit beneath the plugin … they stand for the engine, so what one answers reaches the plugin as given" |
| `world()` in band.test.tsx can replace or stall any named event through `hold` | test:62-63 | "/** Run review (Q6): replace or stall the engine's answer to the named call; undefined passes it on. */ hold?: Record<string, (e: any) => Promise<unknown> \| undefined>" |
| How `hold` is wired in | test:78-79 | "if (git.hold?.[name] !== undefined) { args[args.length - 1] = async (...a: any[]) => { const r = await git.hold![name]!(a[1]); return r !== undefined ? r : h(...a) }" |
| The `never()` helper | test:2841 (also 3015, 3081) | "const never = () => new Promise<never>(() => undefined)" |
| Session handlers fail on request through the `fail` set ('cwd', 'root', 'id', 'usage') | test:124, 126, 127, 154 | "on('session.cwd', () => (failing('cwd'), { value: git.cwdNow?.() ?? cwd }))" |
| The existing hang test covers `session.id` and `session.root`, not `session.cwd` or `session.usage` | test:2935-2947 | "for (const name of ['session.id', 'session.root', 'store.get', 'store.keys', 'store.set', 'store.delete']) { test(`Q6-5 ${name} never answers: the Bash call still answers within 2 s of engine clock` … hold: { [name]: () => never() } … await clock.advance(2_000)" |
| Pattern for a late answer driven by the clock | test:3101-3110 | "hold: { 'store.get': () => new Promise<undefined>(r => { asked++; pending.push({ due: t + ms, go: () => r(undefined) }) }) }" |
| Pattern for a one-shot gate | test:2903 | "hold: { 'session.root': () => (first ? (first = false, gate.then(() => undefined)) : undefined) }" |
| Exact-boundary test (1,999 ms pending, 2,000 ms answered) | test:1266-1273 | "await clock.advance(1_999) … expect(out).toBe('pending') … await clock.advance(1)" |

How a test can make each call misbehave:
- **Reject:** add `'cwd'`, `'root'` or `'usage'` to the `fail` set.
- **Hang:** `hold: { 'session.cwd': () => never() }`.
- **Answer late:** `hold: { 'session.usage': () => clock.sleep(1_900).then(() => undefined) }`, or the pending-queue pattern at test:3103. With `undefined`, the call then gets the normal answer.

## 4. `ui.render` and `tool.call`

| Sentence it supports | path:line@version | Verbatim quote |
|---|---|---|
| A render hook whose `$` calls hold it past 30 s is skipped | d.ts:5061@2.1.330 (d.ts(329):4946) | "A hook its `$` calls hold past 30 seconds in all is skipped." |
| Same rule, in ref.md | ref.md:256@2.1.330 | "a `next` or `$` call in flight does not count, though a `ui.render` hook held 30 s in all by its `$` calls is skipped" |
| While a render hook waits, a new terminal row is blank | d.ts:5060@2.1.330 | "On the terminal a new row is blank until its first answer, and `/export` waits." |
| Repaints reuse the last answer | d.ts:5054@2.1.330 | "A repaint reuses the answer; a clock invalidates." |
| A render that never answers is a reported fault | d.ts:19249-19250@2.1.330 | "`render`: a throw while drawing, a tree the surface cannot draw, a render that never answered." |
| `tool.call`: the tool runs only inside `next(e)`, so the call is held while the hook awaits before `next` | d.ts:4969-4974@2.1.330 | "Each `next(e)` runs the hooks beneath, then core (the permission prompt, the tool itself). … returning with `next` pending aborts what runs beneath." |
| `tool.call` allows `$` waits for up to 20 minutes | d.ts:6730-6731@2.1.330 | "On `tool.call`, `tool.check`, `tool.judge`, `tool.run` and `classic.PreToolUse` for 20 minutes" |
| If the turn is aborted while a hook holds the call, the call does not run | d.ts:5035-5036@2.1.330 | "a turn aborted while a hook holds the call does not run it, and the call reads as interrupted." |
| `session.start`: the first one is awaited before the first prompt | d.ts:5792@2.1.330 | "Observe. The first is awaited: a `$.tool.register` is listed by turn one." |

What this means for the change:
- **Band (reg:765):** `usage` is unbounded. A hang leaves a new band row blank for up to 30 s, then the hook is skipped. With the 2 s race, the band row is drawn or dropped (`next(e)`) within 2 s.
- **Tool call (reg:706):** the hang happens before `next(e)`, so the tool call waits up to 20 minutes.
- **First `session.start`:** a hang in its `refresh` can hold the first prompt. No limit is documented there.

## 5. Hazards of a race-against-timer wrapper

| Sentence it supports | path:line@version | Verbatim quote |
|---|---|---|
| **Timer leak when the work wins:** `within` cancels the timer after the race, whichever side won | reg:166-167 | "]).catch((): Raced<T> => ({ kind: 'failed' })) ;(timer as Timer \| null)?.cancel()" |
| **Unhandled rejection of the losing promise:** the work's rejection is caught by `.then`'s second handler, so it never goes unhandled, even after a timeout | reg:163-164 | "work.then((value): Raced<T> => ({ kind: 'ok', value }), (): Raced<T> => ({ kind: 'failed' }))," |
| **Late resolution after the race:** the late value goes to a race that already settled, and is dropped. The `$` call itself is not cancelled. A call that never answers keeps a small closure alive. | reg:160-169 | "async function within<T>($: EngineInterface, work: Promise<T>): Promise<Raced<T>> {" |
| **Refused timer:** if a hook refuses the `clock.after` dispatch, there is no bound | d.ts:4223-4224@2.1.330 | "and never when a hook refuses it." |
| **A fallback that is itself unbounded:** reg:396 falls back from `root` to an unbounded `cwd`, and from a hang that fallback is never reached | reg:396 | "await $.session.root().catch(() => $.session.cwd())" |
| A timer can outlive its hook. Only the race's resolve runs in its callback, so this does not matter here | d.ts:3341-3342@2.1.330 | "A timer that outlives its hook reads the session's directory" |

More points on these hazards:
- **Each `within` adds one engine dispatch.** That is one extra `clock.after` per bounded call. On the `tool.call` path, cwd is read twice (706 and 719) and refresh adds more.
- **Late resolution keeps no stale state, provided callers do not write state from the losing branch.** Today they do not.
- **Abort.** No `$.session.*` call takes a `signal`. `next.signal` cannot cancel the call.
- **Unhandled rejections.** The engine docs say nothing about unhandled rejections in a hook. Searches for "unhandled" and "uncaught" in d.ts and ref.md found nothing. The only nearby rule is that a hook that throws is skipped (d.ts:4960-4962).

## 6. Prior art

None of these were fetched this session. They are from memory and should be checked before anyone cites them.
- **Node.js** `AbortSignal.timeout(ms)` (nodejs.org/api/globals.html): bounds a call that takes a signal. `$.session.*` takes none, so it does not apply here directly.
- **sindresorhus/p-timeout README:** clears its timer when the promise settles, and states that the original promise is not cancelled. These are the same choices `within` makes.
- **Go `context.WithTimeout`** (pkg.go.dev/context): the docs say to call `cancel` as soon as the work is done, to free the timer. `go vet`'s lostcancel check enforces this. This is the timer-leak hazard.
- **Kubernetes admission webhooks:** `timeoutSeconds` (default 10, range 1-30), with `failurePolicy` choosing between failing open and closed on timeout. The host bounds the call, not the plugin.
- **Claude Code settings hooks:** a per-command `timeout`, default 60 s. Again the host bounds it.
- **In this engine:** `$.process.run` has its own `timeoutMs` (d.ts:4301-4302@2.1.330: "timeout 30 s by default, ten minutes at most"). The session calls have none, so the mod must bound them itself.

**The alternative: fix the README instead.** The sentence at mods/shawarma-companion/README.md:40 could be narrowed to "Each call to the store, and the session's id and root at claim time, gives up after 2 seconds". That makes the docs true, but the hang stays: a `session.cwd` that never answers still holds a writing tool call for up to 20 minutes. That is the bean's own finding. The W4-1 ruling filed it as a separate fix, not a docs fix: /Users/jonathan/Documents/strandic-skills/docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/decisions.md:11.

## Searches that found nothing (d.ts and ref.md, 2.1.330)

- "unhandled", "uncaught": nothing.
- "never resolv", "watchdog", "gives up": nothing.
- "time limit": one hit only, about `$.agent` (d.ts:3132), not session calls.
- "deadline": only WebAssembly (d.ts:4584-4600) and tool schemas.
- "hangs", "in flight" and "too long": no hit about `$.session` calls.
- Render text saying "until the hook answers", "while the hook awaits", "last tree stands" or "keeps its last": nothing. The only hit is d.ts:5060, "blank until its first answer".
- Wording on how a hook refuses a `$` dispatch ("a call on `$` is", "each `$` call", "refuses … clock"): nothing beyond d.ts:4223-4224.
- A per-call timeout, `signal` or `timeoutMs` option on any `$.session.*` method: none exists.
- A `$` time limit for `session.start` or `turn.complete` hooks: none stated.
- `AbortSignal.timeout`, `p-timeout`, `Promise.race` elsewhere in the repo: I did not get a valid result. The grep was malformed (a zsh glob error), so this is not a real "found nothing".

I wrote no scratch files.
