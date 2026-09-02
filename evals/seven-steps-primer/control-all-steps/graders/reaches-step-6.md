---
type: llm
focus: last_message
---
Every checkpoint in this request was pre-approved and the reply was told to carry the
work through to a finished implementation in one turn. Score it on whether all seven
artifacts are actually present, each one recognisable as itself rather than as a promise
to produce it later:

1. **a plan** — what is in scope, which files the change lands in, how it will be
   checked, and what is unresolved
2. **the data structures** the per-user counter needs, and nothing else at this point
3. **the signatures** of the functions, with every runtime handle either named or
   flagged as unprovided
4. **literal markers placed in the source**, at each site that changes — in the files,
   not listed in prose
5. **a report from having built and run it** — the commands actually run and what they
   showed — with each defect pushed back into whichever earlier artifact was wrong
6. **the invariants**, each paired with the check that enforces it
7. **the implementation**, with the existing test suite run against it

Score 0 if any of the seven is missing, described rather than produced, or replaced by a
statement that it would come next.
