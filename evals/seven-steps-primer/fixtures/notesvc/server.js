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
const CHAIN = [withRequestId, withRateLimit, withIdentity, withJsonBody];

/**
 * @returns {import('node:http').Server} an unbound server — the caller listens
 */
function createServer() {
  return http.createServer((req, res) => {
    runChain(CHAIN, req, res, () => handleNotes(req, res));
  });
}

const PORT = Number(process.env.PORT ?? 3000);

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`notesvc listening on http://localhost:${PORT}`);
  });
}

module.exports = { CHAIN, createServer };
