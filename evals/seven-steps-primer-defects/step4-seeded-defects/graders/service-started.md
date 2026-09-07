---
type: tool_used
tool: Bash
min: 1
arm: both
input_match: '"command"\s*:\s*"(?:(?:[^"\\]|\\.)*[;&|]\s*)?(?:[A-Z_]+=\S+\s+)*node\b(?:[^"\\]|\\.)*server\.js'
---
The manipulation-check guard: the run started the service. It matches a Bash command
whose command word is `node` and whose text reaches `server.js` afterwards, in either of
the two shapes recon observed: `node server.js` as a process, or a `node -e` script that
requires `./server.js` and listens in-process, which is how the first recon run drove
the service. It does not match `node --test`, a `grep` that mentions the file, or `cat
server.js`, because in those the command word is not `node` or `server.js` never follows
it.

Excluded from every registered group, scored by the harness in both arms. Its per-cell
count is the split the plan uses to read a read-visible gain: concentrated in runs that
started the service, it is the run effect leaking; present in runs that did not, it is a
style gain.

The first recon run showed the treatment exercising the service in-process rather than
as a separate process, so a defect that fires only in the `require.main` startup block
is reachable by a `node server.js` client and not by this shape. The designer's brief
asks for signals in a status, header or body, which both shapes reach.

## Probes

```probe-match
{"command":"node server.js"}
```

```probe-match
{"command":"PORT=0 node server.js > srv.log 2>&1 &\nsleep 1; curl -s localhost:$(grep -o \"[0-9]*$\" srv.log)/notes"}
```

```probe-match
{"command":"node -e \"const { createServer } = require('./server.js'); const s = createServer(); s.listen(0, () => {})\""}
```

```probe-match
{"command":"cd /tmp/x; node server.js"}
```

```probe-no-match
{"command":"node --test"}
```

```probe-no-match
{"command":"node --test 2>&1 | tail -40"}
```

```probe-no-match
{"command":"grep \"node server.js\" README.md"}
```

```probe-no-match
{"command":"cat server.js"}
```

```probe-no-match
{"command":"grep -rn 'TODO(per-user)' --include='*.js' . ; find . -name '*.js'"}
```
