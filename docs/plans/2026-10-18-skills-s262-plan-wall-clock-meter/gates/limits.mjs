// node limits.mjs <meter .mjs> <projects dir>: the meter's time-limit hits summed over every transcript.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const m = await import(process.argv[2]);
const rx = Object.fromEntries(Object.entries(m.DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
let n = 0;
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name);
  if (f.isDirectory()) walk(p); else if (f.isFile() && f.name.endsWith('.jsonl')) { let r; try { r = m.records(p).recs; } catch { continue; } if (r.length) n += m.split(r, -Infinity, Infinity, rx).limited; } } };
walk(process.argv[3]); console.log(n);
