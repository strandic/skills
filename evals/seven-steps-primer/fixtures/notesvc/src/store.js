'use strict';

/**
 * In-memory note store. Process-local and unpersisted: restart the service and
 * every note is gone. That is deliberate — the service exists to be read, not
 * to be operated.
 *
 * The return types below are the contract, and they are meant literally. A
 * reader who plans against them should not be ambushed at runtime: `listNotes`
 * always hands back an array, `createNote` always hands back the stored note,
 * and neither ever hands back a live reference into the store.
 */

/**
 * @typedef {object} Note
 * @property {string} id         `note-<n>`, assigned by the store, never by the caller
 * @property {string} owner      the `x-user` identity that created it
 * @property {string} title
 * @property {string} body       the empty string when the caller sent none — never null
 * @property {string} createdAt  ISO-8601 timestamp
 */

/** @type {Note[]} insertion-ordered; the only mutable state in this module. */
const notes = [];

let sequence = 0;

/**
 * @param {Note} note
 * @returns {Note} a shallow copy, so callers cannot reach back into the store
 */
function copyOf(note) {
  return { ...note };
}

/**
 * @param {{ owner: string, title: string, body?: string }} input
 * @returns {Note} the note as stored, copied — mutating it does not touch the store
 */
function createNote(input) {
  sequence += 1;
  /** @type {Note} */
  const note = {
    id: `note-${sequence}`,
    owner: input.owner,
    title: input.title,
    body: input.body ?? '',
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  return copyOf(note);
}

/**
 * @param {string} owner
 * @returns {Note[]} that owner's notes, newest first; an empty array when the
 *                   owner has none and when the owner is unknown — never null
 */
function listNotes(owner) {
  return notes
    .filter((note) => note.owner === owner)
    .map(copyOf)
    .reverse();
}

/**
 * @returns {number} how many notes the store holds, across every owner
 */
function count() {
  return notes.length;
}

/**
 * Test hook: empties the store and restarts id numbering.
 * @returns {void}
 */
function reset() {
  notes.length = 0;
  sequence = 0;
}

module.exports = { createNote, listNotes, count, reset };
