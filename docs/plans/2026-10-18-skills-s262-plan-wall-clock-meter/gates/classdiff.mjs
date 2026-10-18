// node classdiff.mjs <old plantime.mjs> <new plantime.mjs> <projects dir>: per-record class pairs that differ, counts only.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const [a, b] = [await import(process.argv[2]), await import(process.argv[3])];
const rx = Object.fromEntries(Object.entries(a.DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const pairs = new Map(); let n = 0;
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name);
  if (f.isDirectory()) walk(p); else if (f.isFile() && f.name.endsWith('.jsonl')) { let r; try { r = a.records(p).recs; } catch { continue; }
    const ka = new Map(), kb = new Map();
    for (const d2 of r) { const x = a.classify(d2, ka, rx), y = b.classify(d2, kb, rx); n++; if (x !== y) pairs.set(`${x} -> ${y}`, (pairs.get(`${x} -> ${y}`) ?? 0) + 1); } } } };
walk(process.argv[4]); console.log({ records: n, changed: Object.fromEntries(pairs) });
