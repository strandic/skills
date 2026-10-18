// The new meter's class for every user/assistant record of one transcript, in file order: `<timestamp>\t<uuid>\t<class>`.
// Uses the meter's classify alone; reads and orders the records itself (time order, as both meters do).
import { readFileSync } from 'node:fs';
const [, , meter, file] = process.argv;
const m = await import(meter);
const rx = Object.fromEntries(Object.entries(m.DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const recs = [];
for (const line of readFileSync(file, 'utf8').split('\n')) {
  try { const d = JSON.parse(line); if (d && (d.type === 'user' || d.type === 'assistant') && d.timestamp) recs.push(d); } catch {}
}
recs.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
const kinds = new Map();
for (const d of recs) console.log([d.timestamp, d.uuid, m.classify(d, kinds, rx)].join('\t'));
