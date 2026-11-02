# Wave 1 implementer lane (D11, D12) — saved from the lane's final message (summary of its report; its full diff is commit `<this commit>`)

- Tests before: `154 pass` / `8 fail` / `Ran 162 tests across 1 file. [3.61s]` (the 8 in describe `v2tm amendments (D11, D12)`). After: `162 pass` / `0 fail` / `Ran 162 tests across 1 file. [3.70s]`.
- Validate: `✔ Validation passed`.
- tsc: tsconfig `<scratch>/run-v2tm/tsc/tsconfig.json` (the mod's compiler options; include = the engine types `plugin-authoring/types/claude-code.d.ts@2.1.316` from the bundled skills folder, the mod's `hooks`, `types`, `tests`); `npx --offline -y -p typescript@5 tsc -p <it>` → exit 0, no output, before and after.
- D11: `parseMarker` returns `planDir: resolvePath(treeRoot, first)`; new `isInside(root, path)` in model.ts (also used by `ownTree`); `rowOf` returns the `plan dir outside its tree` problem row with `planDir: ''` before listing anything.
- D12: new `timeIn(entries, name)` (kind `file`, not a link) for the band's two plan-dir lookups; `readOr` replaced by `planFiles` (one listing, reads only names `timeIn` accepts; a dir that does not list and does not exist reads both missing, else throws).
- Interpretations: (1) a helper `isInside` rather than a new Marker kind — a pinned test keeps `parseMarker('/abs\nplan 1\n', ROOT).planDir === '/abs'`, and only `rowOf` knows the tree; (2) "the band's plan-dir listings also skip links" read as the two `timeOf` lookups; the `.shawarma` listing already requires kind `file`; (3) README: one paragraph for D11, two sentences for D12.
- Blockers: none. No index operation.
