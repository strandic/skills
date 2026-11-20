# skills-cm2l — research (plan step 1)

Read-only lane, 2026-11-20. No types file for the installed 2.1.329 could be found, so every quote is from the 2.1.325 mod types (`claude-code.d.ts`, "F") and `reference.md` ("R") bundled with the plugin-authoring skill. The 2.1.326–2.1.329 changelog has no entry on `clock`, `fs` or `state`.

## Outside things the change calls

Listed by `grep -on '\$\.[a-z]*\.[a-zA-Z]*' mods/shawarma-companion/hooks/register.tsx` on the lines the fix touches (`watch`, `stale`, `refresh`, `snapshot`): `$.clock.every`, `$.clock.now`, `$.fs.list`, `$.fs.read`, `$.fs.exists`, `$.session.cwd`, `read`/`update` of atoms.

## 1. `$.clock`

| question | answer | source |
|---|---|---|
| does a throw or rejection stop `every`? | not stated; `fn` is `() => void`, a returned promise is ignored; only a refused period ends it | F:14598 `export type TimerCall = (ms: number, fn: () => void) => Timer;` · F:3710 "One `clock.every` dispatch per period: `fn` runs when it resolves and the next period is asked; a refused period ends the interval." |
| can ticks overlap? | not stated; the next period is asked when the dispatch resolves, not when `fn` ends (inferred) | F:7731 "dispatched once per period: `fn` runs each time a dispatch resolves, and the next period is asked." |
| `cancel()` while `fn` runs | "never fires again"; a running call is not said to stop | F:14589 "Stops it; a stopped timer never fires again." |
| `$.clock.after` | runs `fn` once | F:3701-3704 "Calls `fn` once after `ms` milliseconds; `cancel()` before then stops it." |

## 2. `$.fs`

| call | rejects | source |
|---|---|---|
| `read` | missing, or over 4 MiB | F:3480 "Rejects when missing, or over 4 MiB" |
| `list` | no rule stated | F:3502-3515 |
| `exists` | only a network location | F:3517 "Returns whether the path exists; rejects only a network location, which the implementation beneath the hooks never touches." |
| `stat` | missing (`ENOENT`) | F:3521 "Rejects when missing." |

EACCES is named for none: `grep -n EACCES F` finds nothing.

## 3. Atoms

No rejection rule for `atom`, `read`, `update`. `$.state.set` rejects "while a `ui.render` hook draws … and for another plugin's value" (F:3657), so `update` inside `ui.render` fails.

## 4. Timers

A hot reload cancels the plugin's timers (F:3674; R:121). Timers run until cancelled or reloaded (R:259-261). Minimum period 1 ms (F:3708). No cost guidance found.

## 5. Prior art (from the lane's memory, not re-read)

| library | on one failed poll | gives up |
|---|---|---|
| TanStack Query (tanstack.com/query/latest/docs/framework/react/guides/query-retries) | keeps the last data, sets `error`, retries with backoff, keeps polling | 3 retries by default; polling goes on |
| SWR (swr.vercel.app/docs/error-handling) | keeps the stale data beside `error`, retries with backoff from 5 s | never by default |
| client-go reflector (github.com/kubernetes/client-go/blob/master/tools/cache/reflector.go) | keeps the cache, re-lists with backoff to a 30 s cap | never |

All three keep the last good value and keep polling.
