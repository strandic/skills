'use strict';

const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');

const { createServer } = require('../server.js');
const { MAX_REQUESTS, resetRateLimit } = require('../src/middleware');
const store = require('../src/store');

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

// The store is module state and so is the throttle's counter. Without both
// resets, every test inherits whatever the previous one spent.
beforeEach(() => {
  store.reset();
  resetRateLimit();
});

/**
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
const call = (path, options = {}) => fetch(`${base}${path}`, options);

/** Spends the whole window, so the next request is the one that gets refused. */
async function spendTheWindow(user) {
  for (let i = 0; i < MAX_REQUESTS; i += 1) {
    const res = await call('/notes', { headers: { 'x-user': user } });
    assert.equal(res.status, 200, `request ${i + 1} should still be inside the window`);
  }
}

test('POST /notes stores a note owned by the calling user', async () => {
  const res = await call('/notes', {
    method: 'POST',
    headers: { 'x-user': 'ada', 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Analytical engine', body: 'Note G.' }),
  });

  assert.equal(res.status, 201);
  const { note } = await res.json();
  assert.equal(note.owner, 'ada');
  assert.equal(note.title, 'Analytical engine');
  assert.equal(note.body, 'Note G.');
  assert.match(note.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(store.count(), 1);
});

test('POST /notes without a title is refused', async () => {
  const res = await call('/notes', {
    method: 'POST',
    headers: { 'x-user': 'ada', 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'no title' }),
  });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_note');
  assert.equal(store.count(), 0);
});

test('GET /notes returns only the caller own notes, newest first', async () => {
  for (const title of ['first', 'second']) {
    await call('/notes', {
      method: 'POST',
      headers: { 'x-user': 'ada', 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  }
  await call('/notes', {
    method: 'POST',
    headers: { 'x-user': 'grace', 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'compiler' }),
  });

  const mine = await (await call('/notes', { headers: { 'x-user': 'ada' } })).json();
  assert.deepEqual(mine.notes.map((n) => n.title), ['second', 'first']);

  const theirs = await (await call('/notes', { headers: { 'x-user': 'grace' } })).json();
  assert.deepEqual(theirs.notes.map((n) => n.title), ['compiler']);
});

test('GET /notes reports what is left of the window', async () => {
  const { quota } = await (await call('/notes', { headers: { 'x-user': 'ada' } })).json();

  assert.equal(quota.limit, MAX_REQUESTS);
  assert.ok(quota.remaining >= 0 && quota.remaining < quota.limit);
  assert.match(quota.resetsAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('a malformed JSON body is refused', async () => {
  const res = await call('/notes', {
    method: 'POST',
    headers: { 'x-user': 'ada', 'content-type': 'application/json' },
    body: '{ this is not json',
  });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_json');
});

test('an unknown path is a 404', async () => {
  const res = await call('/notebooks', { headers: { 'x-user': 'ada' } });

  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

test('the request past the limit is throttled', async () => {
  await spendTheWindow('ada');

  const res = await call('/notes', { headers: { 'x-user': 'ada' } });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_requests');
  assert.ok(Number(res.headers.get('retry-after')) > 0);
});

// ── the three assertions below pin the CHAIN ORDER, not the handlers ────────
// Each one names a response only reachable if the middleware ran in the order
// server.js composes them. Re-order the chain and these go red.

test('identity runs before the routes: an unidentified POST never reaches the store', async () => {
  const res = await call('/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'anonymous' }),
  });

  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'missing_user');
  assert.equal(store.count(), 0);
});

test('the throttle runs before the body parser: a throttled request with a broken body is a 429', async () => {
  await spendTheWindow('ada');

  const res = await call('/notes', {
    method: 'POST',
    headers: { 'x-user': 'ada', 'content-type': 'application/json' },
    body: '{ this is not json',
  });

  assert.equal(res.status, 429, 'a parsed-first chain would have answered 400');
});

test('the request id runs before the throttle: even a 429 carries one', async () => {
  await spendTheWindow('ada');

  const res = await call('/notes', { headers: { 'x-user': 'ada' } });
  assert.equal(res.status, 429);
  assert.match(res.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
  assert.match((await res.json()).requestId ?? '', /^[0-9a-f-]{36}$/);
});
