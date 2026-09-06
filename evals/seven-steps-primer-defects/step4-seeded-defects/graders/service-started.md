---
type: tool_used
tool: Bash
min: 1
arm: both
input_match: 'TODO'
---
The manipulation-check guard: the run started the service. Anchored to a `node …
server.js` command in the Bash input, never anywhere inside it, so `node --test` and a
`grep` that mentions the file do not count.

Excluded from every registered group, scored by the harness in both arms. Its per-cell
count is the split the plan uses to read a read-visible gain: concentrated in runs that
started the service, it is the run effect leaking; present in runs that did not, it is a
style gain.

<!-- TODO: input_match anchored on the command position — e.g. '"command"\s*:\s*"(?:[^"]*[;&|]\s*)?(?:PORT=\d+\s+)?node\b[^"]*\bserver\.js' — with a probe-match for `node server.js` and `PORT=0 node server.js &`, and probe-no-match for `node --test`, `grep "node server.js" README.md` and `cat server.js`. -->

## Probes

```probe-match
{"command":"node server.js"}
```

```probe-no-match
{"command":"node --test"}
```
