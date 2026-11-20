# Q4 variant (not in sketch.patch until ruled)

In `stale()`, on top of sketch.patch, the UNREAD branch also takes a `plan dir not readable` row:

```ts
    // cm2l Q2: a row that could not be read is read again each pass, for as long as it fails; so is a plan dir that did
    // not list (Q4): the refresh asks its real path first, as at any update, then lists it.
    if (row.problem === UNREAD || row.problem?.startsWith('plan dir not readable') === true) {
```

EXECUTED (inputs: one failed `list` of the plan dir in a check pass, then cleared; the same failure kept for 60 s). Readings: during `skills-x · 202… · run W1 · since 14:01 · 0 decisions · plan dir not readable: /repo/docs/plans/2026-10-16-skills-x-thing`; one pass later `skills-x — the thing · run W1 · since 14:01 · 2 decisions`; kept failing, 5.75 fs calls per pass, each pass `stat <dir> resolve` before `list <dir>`. Suite: 284 pass / 1 fail — N11 ("a not-readable row: the 15 s check asks whether it exists and starts no refresh (no read)") goes red; N22 (link out) stays green.
