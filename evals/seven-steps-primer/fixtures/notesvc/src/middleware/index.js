'use strict';

const { randomUUID } = require('node:crypto');

/**
 * The middleware chain. `server.js` composes these in one array and the order
 * it picks is load-bearing, not cosmetic — three of the four steps below read
 * something an earlier step put on the request, and the throttle deliberately
 * runs before the expensive work so a rejected request costs nothing.
 *
 * Every middleware has the same shape: `(req, res, next)`. Call `next()` to
 * pass the request along, or write a response and return without calling it.
 */

// ── rate limiting ──────────────────────────────────────────────────────────
// One fixed window for the whole process. These two variables are the entire
// throttle: every caller, authenticated or not, spends from the same counter.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

let windowStartedAt = Date.now();
let hitsInWindow = 0;

const MAX_BODY_BYTES = 64 * 1024;

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} payload
 * @returns {void}
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * What the caller has left of the window. Reported on `GET /notes` so a client
 * can pace itself instead of discovering the limit by hitting it.
 *
 * @returns {{ limit: number, remaining: number, resetsAt: string }}
 */
function rateLimitSnapshot() {
  const now = Date.now();
  const windowIsCurrent = now - windowStartedAt < WINDOW_MS;
  const spent = windowIsCurrent ? hitsInWindow : 0;
  const startsAt = windowIsCurrent ? windowStartedAt : now;
  return {
    limit: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - spent),
    resetsAt: new Date(startsAt + WINDOW_MS).toISOString(),
  };
}

/**
 * Test hook: opens a fresh window with the counter at zero. The counter lives
 * at module scope, so without this every test in a file inherits the previous
 * test's traffic.
 * @returns {void}
 */
function resetRateLimit() {
  windowStartedAt = Date.now();
  hitsInWindow = 0;
}

/**
 * Stamps the request with an id and echoes it on the response. Runs first, so
 * every reply carries one — including the replies later middleware writes.
 */
function withRequestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

/**
 * The throttle. Runs before identity and before the body is read: a request
 * over the limit is refused without parsing anything.
 */
function withRateLimit(req, res, next) {
  const now = Date.now();
  if (now - windowStartedAt >= WINDOW_MS) {
    windowStartedAt = now;
    hitsInWindow = 0;
  }

  hitsInWindow += 1;

  if (hitsInWindow > MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((windowStartedAt + WINDOW_MS - now) / 1000));
    res.setHeader('retry-after', String(retryAfter));
    sendJson(res, 429, {
      error: 'too_many_requests',
      message: 'Too many requests — plese try again in a minute.',
      requestId: req.id,
    });
    return;
  }

  next();
}

/**
 * Resolves who is calling. Everything downstream reads `req.user`, so a
 * request that gets past here is one the routes may trust.
 */
function withIdentity(req, res, next) {
  const header = req.headers['x-user'];
  const user = typeof header === 'string' ? header.trim() : '';

  if (user === '') {
    sendJson(res, 401, {
      error: 'missing_user',
      message: 'Send your user id in the x-user header.',
      requestId: req.id,
    });
    return;
  }

  req.user = user;
  next();
}

/**
 * Buffers and parses a JSON body for the methods that carry one, and sets
 * `req.body` to null for the methods that do not. Routes read `req.body` and
 * never touch the stream.
 */
function withJsonBody(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    req.body = null;
    next();
    return;
  }

  /** @type {Buffer[]} */
  const chunks = [];
  let size = 0;
  let answered = false;

  req.on('data', (chunk) => {
    if (answered) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      answered = true;
      sendJson(res, 413, {
        error: 'payload_too_large',
        message: `A note body may not exceed ${MAX_BODY_BYTES} bytes.`,
        requestId: req.id,
      });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (answered) return;
    const raw = Buffer.concat(chunks).toString('utf8');

    if (raw.trim() === '') {
      req.body = {};
      next();
      return;
    }

    try {
      req.body = JSON.parse(raw);
    } catch {
      sendJson(res, 400, {
        error: 'invalid_json',
        message: 'The request body is not valid JSON.',
        requestId: req.id,
      });
      return;
    }

    next();
  });
}

/**
 * Walks the chain in order and calls `done` once every middleware has passed
 * the request along. A middleware that writes a response and returns without
 * calling `next()` ends the request there.
 *
 * @param {Function[]} middlewares
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {() => void} done
 * @returns {void}
 */
function runChain(middlewares, req, res, done) {
  let index = 0;

  function next() {
    const middleware = middlewares[index];
    index += 1;
    if (middleware === undefined) {
      done();
      return;
    }
    middleware(req, res, next);
  }

  next();
}

module.exports = {
  MAX_REQUESTS,
  WINDOW_MS,
  rateLimitSnapshot,
  resetRateLimit,
  runChain,
  sendJson,
  withIdentity,
  withJsonBody,
  withRateLimit,
  withRequestId,
};
