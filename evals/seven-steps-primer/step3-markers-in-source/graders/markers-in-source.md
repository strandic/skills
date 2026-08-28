---
type: regex
target: { source: file, path: src/routes/notes.js }
pattern: "TODO"
---
A literal marker has to be sitting in the service's own source when the run ends. Not a
list in a planning document naming the same site in prose — the marker, in the file, at
the place the code changes. That is the whole case: the artifact for this step lives in
the code, and its absence is grep-able.

`src/routes/notes.js` is one of the sites because `listNotes` reports the caller's quota
from `rateLimitSnapshot()`, and a per-identity snapshot cannot answer without being told
whose window it is. The transcript this case replays names that site explicitly, so a run
that placed markers anywhere placed one here.

RULED: `{source: file}` paths are WORKSPACE-relative, and the scaffold copies the service
to the workspace root — so `src/routes/notes.js`, never
`fixtures/notesvc/src/routes/notes.js`. A path written the second way cannot match, and
fails silently.

One file matching is not sufficient evidence — *every site, or the step is not done* —
so `markers-in-middleware` carries the second half of the claim. Two graders, both
required, and neither is satisfiable by the other.

## Probes

```probe-match
function listNotes(req, res) {
  // TODO(per-user): rateLimitSnapshot() needs the caller's identity passed in
  sendJson(res, 200, {
    notes: store.listNotes(req.user),
    quota: rateLimitSnapshot(),
  });
}
```

```probe-no-match
function listNotes(req, res) {
  sendJson(res, 200, {
    notes: store.listNotes(req.user),
    quota: rateLimitSnapshot(),
  });
}
```

```probe-no-match
Sites to change: src/routes/notes.js — listNotes has to hand the identity to
rateLimitSnapshot(); src/middleware/index.js — the counter becomes a map.
```

**A note on the marker grep.** This grader and its sibling carry the literal token in
their pattern and in their probes, unavoidably — a positive sample for `TODO` has to
contain `TODO`. So the bare `grep -rn 'TODO' evals` in the marker convention returns
these two files, and neither is an implementation site. Narrow it: a site always writes
the token with a trailing colon, and nothing in this case does. A check that reports a
site which is not a site is the same defect as a grader that matches everything — it
just fails in the flattering direction rather than the alarming one.

The first negative is the file exactly as the fixture ships it, and it is the probe that
matters most: the fixture must not carry this token anywhere, or the grader passes before
the agent has done anything. The second is the failure this case exists to catch — the
sites enumerated in prose, correctly, with the source left untouched.
