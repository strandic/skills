// Every sequence of up to 4 records from {owner, meta, model, interrupt, ask} at minutes 0..n-1 (0 is before the window
// when the start is 0.5, else the opener at the start), graded against the header's turn rule written out by hand.
// node turns.mjs <absolute path to plantime.mjs>
const { split, DEFAULTS } = await import(process.argv[2]);
const rx = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const T = (m) => new Date(Date.UTC(2026, 0, 1) + m * 60000).toISOString();
const mk = (kind, m, id) => kind === 'owner' ? { type: 'user', timestamp: T(m), origin: { kind: 'human' }, message: { content: 'x' } }
  : kind === 'meta' ? { type: 'user', timestamp: T(m), isMeta: true, message: { content: 'x' } }
  : kind === 'model' ? { type: 'assistant', timestamp: T(m), message: { content: [{ type: 'tool_use', id, name: 'AskUserQuestion', input: {} }] } }
  : kind === 'interrupt' ? { type: 'user', timestamp: T(m), message: { content: '[Request interrupted by user]' } }
  : { type: 'user', timestamp: T(m), message: { content: [{ type: 'tool_result', tool_use_id: id }] } };
// Hand rule: a "wake" is owner or ask (owner kinds); meta never breaks; model/interrupt end a turn. A turn starts at the
// first owner-kind record after a non-owner one (or the first after the start instant); it counts when its first
// record's wait lies inside the window: the last record before it that is not meta is at or after the start (meta
// passes its gap on, so it starts a wait only as the file's first record). Records at the start instant are skipped.
function hand(seq, start) {
  let turns = 0, open = false, prevT = null, lastId = null;
  seq.forEach(([k, m]) => {
    if (m > start && (k === 'owner' || (k === 'ask' && lastId))) {
      if (!open) { open = true; if (prevT !== null && prevT >= start) turns++; }
    } else if (m > start && (k === 'model' || k === 'interrupt' || k === 'ask')) open = false;
    if (k === 'model') lastId = true;
    if (k !== 'meta' || prevT === null) prevT = m;
  });
  return turns;
}
const kinds = ['owner', 'meta', 'model', 'interrupt', 'ask'];
let n = 0, bad = 0;
const go = (seq) => {
  if (seq.length) for (const start of [0, 0.5]) {
    let id = 0, recs = seq.map(([k, m]) => mk(k, m, k === 'model' ? `t${++id}` : `t${id}`));
    const got = split(recs, Date.parse(T(start)), Date.parse(T(99)), rx).turns, want = hand(seq, start);
    n++; if (got !== want) { bad++; if (bad <= 5) console.log('DIFF', start, JSON.stringify(seq), got, want); }
  }
  if (seq.length < 4) for (const k of kinds) go([...seq, [k, seq.length]]);
};
go([]);
console.log({ cases: n, differ: bad });
