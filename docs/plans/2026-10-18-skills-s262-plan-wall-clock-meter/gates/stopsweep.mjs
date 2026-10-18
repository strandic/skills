// node stopsweep.mjs <abs path to plantime.mjs>: the stop-notice match against a regex written from the header's rule
// (R8, R10; an independent implementation): the harness's part of a notice ends at its summary's end, the first
// `</summary>` followed by `<note>`, `<result>`, `<usage>`, `</task-notification>` or the end, after optional
// whitespace; before any summary, at the first `<result>` or close. The summary must be the part's first tag of the
// three, open with the words and end with them, two quotes around the command; a summary that never ends is no stop
// notice. Every string of up to 5 tokens, and every command of up to 4 tokens inside the harness's own shape with each
// tail it writes; the meter's match is read through split's count.
const { split, DEFAULTS } = await import(process.argv[2]);
const rx = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const OPEN = '<summary>Background command "', WORDS = ' was stopped after reaching its background time limit';
const END = String.raw`<\/summary>(?=\s*(?:<note>|<result>|<usage>|<\/task-notification>|$))`;
const RE = new RegExp(String.raw`^(?:(?!<summary>|<result>|<\/task-notification>)[\s\S])*<summary>Background command "(?:(?!${END})[\s\S])*"${WORDS}${END}`);
const toks = [OPEN, `"${WORDS}</summary>`, '"', 'x', '</summary>', '<summary>', '<result>', '</task-notification>', '<note>', '<usage>', '\n', `${WORDS}</summary>`];
const T = new Date(Date.UTC(2026, 0, 1)).toISOString();
let n = 0, differ = 0;
const check = (s) => {
  const rec = { type: 'user', timestamp: T, origin: { kind: 'task-notification' }, message: { content: `<task-notification>${s}</task-notification>` } };
  const got = split([rec], 0, Date.parse(T) + 1, rx).limited === 1, want = RE.test(`${s}</task-notification>`);
  n++; if (got !== want) { differ++; if (differ <= 3) console.log('DIFF', JSON.stringify(s), got, want); }
};
const strings = function* (s, d) { yield s; if (d) for (const t of toks) yield* strings(s + t, d - 1); };
for (const s of strings('', 5)) check(s);
for (const c of strings('', 4)) for (const tail of ['', '<note>n</note>', '<usage>u</usage>', '<result>r</result>', '\n']) check(`<task-id>k</task-id><status>killed</status>${OPEN}${c}"${WORDS}</summary>${tail}`);
console.log({ cases: n, differ });
