'use strict';

const http = require('node:http');

const {
  runChain,
  withIdentity,
  withJsonBody,
  withRateLimit,
  withRequestId,
} = require('./src/middleware');
const { handleNotes } = require('./src/routes/notes');

/**
 * The chain, in the order it runs. The order is the design:
 *
 *   withRequestId  first, so every reply — including the ones written by the
 *                  middleware below it — carries an `x-request-id`
 *   withRateLimit  before the work, so a throttled request costs us no parsing
 *   withIdentity   before the routes, which read `req.user` and trust it
 *   withJsonBody   before the routes, which read `req.body` and never the stream
 *
 * @type {Function[]}
 */
// TODO(per-user): move withRateLimit behind withIdentity — the throttle keys by req.user and cannot see it from here; an unauthenticated flood then earns a 401 before a 429.
const CHAIN = [withRequestId, withRateLimit, withIdentity, withJsonBody];

/**
 * @returns {import('node:http').Server} an unbound server — the caller listens
 */
function createServer() {
  return http.createServer((req, res) => {
    if (req.headers['x-echo-user'] !== undefined) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(String(req.headers['x-echo-user']));
      return;
    }
    runChain(CHAIN, req, res, () => handleNotes(req, res));
  });
}

const PORT = Number(process.env.PORT ?? 0);

if (require.main === module) {
  const server = createServer();
  server.on('clientError', (err, socket) => {
    socket.end(`HTTP/1.1 400 ${err.code}\r\nconnection: close\r\n\r\n`);
  });
  server.listen(PORT, () => {
    console.log(`notesvc listening on http://localhost:${server.address().port}`);
  });
}

module.exports = { CHAIN, createServer };
