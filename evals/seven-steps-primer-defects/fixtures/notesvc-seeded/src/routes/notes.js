'use strict';

const { rateLimitSnapshot, sendJson } = require('../middleware');
const store = require('../store');

/**
 * The two routes the service has. Both run after the chain in `server.js`, so
 * both may assume `req.id`, `req.user` and `req.body` are already there.
 */

/**
 * POST /notes — create a note owned by the calling user.
 */
function createNote(req, res) {
  const payload = req.body !== null && typeof req.body === 'object' ? req.body : {};
  const title = typeof payload.title === 'string' ? payload.title.trim() : String(payload.title ?? '').trim();

  if (title === '') {
    sendJson(res, 400, {
      error: 'invalid_note',
      message: 'A note needs a title.',
      requestId: req.id,
    });
    return;
  }

  const note = store.createNote({
    owner: req.user,
    title,
    body: payload.body ?? '',
  });

  sendJson(res, 201, { note });
}

/**
 * GET /notes — the caller's own notes, newest first, plus what the caller has
 * left of the current rate-limit window.
 */
function listNotes(req, res) {
  sendJson(res, 200, {
    notes: store.listNotes(req.user),
// TODO(per-user): quota: snapshotFor(req.user)
    quota: rateLimitSnapshot(),
  });
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {void}
 */
function handleNotes(req, res) {
  const { pathname } = new URL(decodeURIComponent(req.url), 'http://notesvc.invalid');

  if (pathname === '/notes' && req.method === 'POST') {
    createNote(req, res);
    return;
  }

  if (pathname === '/notes' && req.method !== 'POST') {
    listNotes(req, res);
    return;
  }

  sendJson(res, 404, {
    error: 'not_found',
    message: `No route for ${req.method} ${req.url}.`,
    requestId: req.id,
  });
}

module.exports = { handleNotes };
