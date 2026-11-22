# Review lane, fix round 1 (skills-cm2l): the 15 s check survives a failed pass

**Scope:** `git diff cea5da2..59bec42 -- mods/`. This covers the C11 test in `3e049e0` and the prose changes in `59bec42`: two doc comments and one inline comment in `hooks/register.tsx`, a README paragraph and a sentence in it, and the doc for `Snapshot.problem` in `types/index.d.ts`.

**Verdict:** The fix answers findings 1 to 5. The code is unchanged. Two sentences are still incomplete: one in the types doc and one in the `refresh` doc comment. Both are prose-only and low severity (F1 and F2 below).

All runs used copies in `/private/tmp/claude-502/-Users-jonathan-Documents-strandic-skills/c1e1be1d-815d-4a37-964f-d9c10f46049f/scratchpad/lane-fix/`:
- `head/` is a copy of the worktree mod. It is identical to the worktree (`diff -r` printed nothing).
- `mut/` is head with the isStale mutant.
- `pre/mod/` is the mod at `cea5da2` plus the head `band.test.tsx`.
- `probe/` is head plus probe tests.

## (a) C11 on head and on the mutant

The mutant changes `register.tsx` line 577, in the `problem: UNREAD` push, from `isStale: isStaleAt(one.at, now),` to `isStale: false,`. That is the only line `diff -r` reports.

- **Head:** `(pass) cm2l: the 15 s check survives a failed pass > C11 a stale unreadable row keeps its stale label, which wins over earlier session (review 3b F1) [23.67ms]`. The suite gives 292 pass, 0 fail, exit 0.
- **Mutant:** C11 fails. The suite gives 291 pass, 1 fail, exit 1. The raw output:
  ```
  (fail) cm2l: the 15 s check survives a failed pass > C11 a stale unreadable row keeps its stale label, which wins over earlier session (review 3b F1) [39.03ms]
    Expected: ["stale: shawarma: skills-s: could not be read"]
    Received: ["earlier session: shawarma: skills-s: could not be read"]
  ```

So C11 catches the mutant from finding 1. The received value matches the reproduction in that finding.

## (b) Each changed sentence checked against a run

| Sentence | Run | Result |
|---|---|---|
| `stale` inline comment: "an exists that rejects starts the refresh, which draws the row again from what it reads now" (finding 2) | P3. The row is not-found, and in one pass `exists` rejects. | That pass calls `stat DIR resolve` then `exists DIR`, with no list. The band stays `… plan dir not found: …`. True. |
| `stale` doc comment: "A row that could not be read, or whose plan dir is not readable, starts the refresh every pass; the refresh asks the plan dir's real path before it lists it" | P4 (not-readable row, two passes). C2 for the could-not-be-read row. | Each pass calls `stat DIR resolve`, `list DIR`, `exists DIR`. C2 sees one read per 15 s. True. |
| `stale` doc comment: a not-found dir "is not listed, only asked whether it exists, and a change in that (found now), or a failed ask, starts the refresh" (findings 4, 5) | P3 | A quiet pass calls only `exists DIR`. A failed-ask pass then runs a refresh (`stat DIR resolve`, `exists DIR`). It never lists. True. |
| README: "…or the plan folder does not list and the mod cannot ask whether it exists" gives `could not be read` (finding 3) | P2. A tool call where `list DIR` fails and `exists DIR` rejects. | The calls are `stat … resolve`, `list …`. The band reads `shawarma: skills-x: could not be read`. True. |
| (same sentence, variant) | P2b. The real-path stat rejects, so the folder is never listed, and `exists` rejects. | Only `stat … resolve` is called. The band reads `could not be read`. "Does not list" covers this case if read loosely. Not a finding. |
| README: "an update runs when that changes or when the ask fails" (finding 4) | P3 | True, as above. |
| `refresh` doc comment: "a failed discovery draws nothing" | P6. `session.cwd` rejects at a tool call. | The band is `undefined` and the marker is never read. True. |
| `refresh` doc comment: "a row whose files fail to read is drawn as `could not be read`, never with a value read earlier" | C1, C6, and P1 | True. |
| types doc: `could not be read` "(a file of the row failed to read; every other field but the labels is empty)" | P1. The marker read fails. | Band: `shawarma: skills-x: could not be read`. Pane: `shawarma: skills-x: could not be read (/repo/.shawarma/active-skills-x)`. Partly false; see F1. |

### F1 (low, types doc): the types doc on `could not be read` overstates two things

- **"Every other field but the labels is empty" is false.** The UNREAD row still carries `ticket`, `marker`, `tree` and `since`. They come from the push in `snapshot`, `register.tsx` lines 576 to 578. In P1 the band shows the ticket and the pane shows the marker path. C11 shows that `since` drives the stale label.
- **"A file of the row failed to read" leaves out one cause.** The row also gets this label when the folder does not list and the `exists` ask fails, as P2 and P2b show. No file read fails there.
- **Suggested wording:** "(the marker, plan.md or decisions.md failed to read, or the plan dir did not list and could not be asked whether it exists; only the ticket, marker, tree, since and labels are set)".

### F2 (low, `refresh` doc comment): one failure case is missing

The comment says a failed discovery draws nothing. A failure after discovery that is not inside any single row also draws nothing, and the comment does not say so.

- **Repro, P5:** the band shows `skills-x — the thing · run W1 · since 14:01 · 0 decisions`. Then the marker is rewritten, `session.usage` fails, and a tool call runs. The band is now `undefined`. C5 sees the same thing inside the check.
- The comment before the fix ("a failed discovery or read draws nothing") had a similar gap.
- **Suggested wording:** "a failed discovery or pass draws nothing".

## (c) Call sites

No code symbol changed, so there are no call sites to list. The proof:

- Comment lines of `register.tsx` at `cea5da2` and at `59bec42` were stripped with `grep -vE '^\s*(\*|/\*\*|\*/|//)'`. `diff` then prints nothing (`REGISTER-CODE-LINES-IDENTICAL`).
- `bun build --no-bundle --minify-whitespace` of both versions gives 22948 bytes each, with the same sha1 `2ed1fb3d50923e298e3246ff1810e2b680e163f5`.
- `types/index.d.ts` with comments stripped has the same sha1 at both commits: `a97079b94b26777477ec5abb1f977ee9f388080c`.
- Across the whole diff, the only changed lines that are not comments are the two README lines and the added C11 test. `git diff --stat cea5da2..59bec42 -- . ':!mods'` is empty.

## (d) No behaviour change

- **Head:** 292 pass, 0 fail, exit 0.
- **`cea5da2`'s mod plus only the new test:** 292 pass, 0 fail, exit 0, and C11 passes. Between `cea5da2` and head, the test diff is only the 11 added C11 lines.
- **Probe copy:** 299 pass, 0 fail. These are the 292 tests plus 7 probes (P1, P2, P2b, P3, P4, P5, P6).

## Repo state

`git -C /Users/jonathan/Documents/strandic-skills/.worktrees/cm2l status --short` printed nothing. The worktree is clean, and this lane made no edits, commits or stashes.
