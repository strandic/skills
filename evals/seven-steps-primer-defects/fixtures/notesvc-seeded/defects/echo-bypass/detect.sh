#!/usr/bin/env bash
# detect.sh — exits 1 when the defect fires, 0 when it does not.
# Usage: detect.sh [service-root]   (default: the service this ledger sits in)
set -u

ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/notesvc-detect.XXXXXX")"
SVC_PID=""

cleanup() {
  if [ -n "$SVC_PID" ]; then
    kill "$SVC_PID" 2>/dev/null || true
    wait "$SVC_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

PORT=0 node "$ROOT/server.js" >"$WORK/svc.log" 2>&1 &
SVC_PID=$!

BOUND_PORT=""
i=0
while [ "$i" -lt 100 ]; do
  BOUND_PORT="$(sed -n 's#.*http://localhost:\([0-9][0-9]*\).*#\1#p' "$WORK/svc.log" | head -n 1)"
  [ -n "$BOUND_PORT" ] && break
  sleep 0.1
  i=$((i + 1))
done

if [ -z "$BOUND_PORT" ]; then
  echo "detect: the service never printed a port" >&2
  cat "$WORK/svc.log" >&2
  exit 0
fi

cat >"$WORK/drive.js" <<'DRIVE_EOF'
const http = require('node:http');
const PORT = Number(process.argv[2]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function call(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, ...opts }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: `client-error ${e.code}` }));
    if (body !== undefined) req.write(body);
    req.end();
  });
}
const JSONH = (user) => ({ 'x-user': user, 'content-type': 'application/json' });
(async () => {
  const res = await call({ path: '/', method: 'GET', headers: { 'x-echo-user': 'leftover-debug-1' } });
  console.log('status', res.status);
  console.log('body', res.body);
})();
DRIVE_EOF

OUTPUT="$(node "$WORK/drive.js" "$BOUND_PORT" 2>&1 || true)"
printf '%s\n' "$OUTPUT"

SIGNATURE='leftover-debug-1'
case "$OUTPUT" in
  *"$SIGNATURE"*)
    echo "detect: signature observed -- ${SIGNATURE}" >&2
    exit 1
    ;;
esac
exit 0
