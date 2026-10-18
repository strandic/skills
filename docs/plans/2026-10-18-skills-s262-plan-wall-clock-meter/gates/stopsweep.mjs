// node stopsweep.mjs <abs path to plantime.mjs>: the stop-notice match against the old regex (an independent
// implementation) on every string of up to 5 tokens; the meter's match is read through split's count.
const { split, DEFAULTS } = await import(process.argv[2]);
const rx = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const RE = /<summary>Background command "[\s\S]*" was stopped after reaching its background time limit<\/summary>/;
const toks = ['<summary>Background command "', '" was stopped after reaching its background time limit</summary>', '"', 'x', '</summary>', '<summary>', ' was stopped after reaching its background time limit</summary>'];
let n = 0, differ = 0;
const T = new Date(Date.UTC(2026, 0, 1)).toISOString();
const go = (s, d) => {
  const rec = { type: 'user', timestamp: T, origin: { kind: 'task-notification' }, message: { content: `<task-notification>${s}</task-notification>` } };
  const got = split([rec], 0, Date.parse(T) + 1, rx).limited === 1, want = RE.test(s);
  n++; if (got !== want) { differ++; if (differ <= 3) console.log('DIFF', JSON.stringify(s), got, want); }
  if (d) for (const t of toks) go(s + t, d - 1);
};
go('', 5);
console.log({ cases: n, differ });
