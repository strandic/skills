---
type: regex
target: { source: file, path: src/routes/notes.js }
pattern: "TODO"
---
TODO: assert a literal marker landed in the fixture SOURCE, not in a planning
document. This is the case's whole point.

TODO: add a second grader for src/middleware/. Every site, or the step is not done
— so one file matching is not sufficient evidence.

RULED: {source: file} paths are WORKSPACE-relative, and the scaffold copies the
service to the workspace root — so `src/routes/notes.js`, never
`fixtures/notesvc/src/routes/notes.js`. A path written the second way cannot match,
and fails silently.
