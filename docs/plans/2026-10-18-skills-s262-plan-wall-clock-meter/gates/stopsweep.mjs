// node stopsweep.mjs <abs path to plantime.mjs>: the stop-notice count against regexes written from the header's rule
// (R8, R10, R11, R12; an independent implementation): the harness's part of a notice ends at its summary's end, the
// first `</summary>` followed by `<note>`, `<result>`, `<usage>`, `</task-notification>` or the end, after optional
// whitespace; before any summary, at the first `<result>` or close. The summary must be the part's first tag of the
// three, open with the words and end with them, two quotes around the command; a summary that never ends is no stop
// notice and ends the reading. After a part, its notes and usages are passed over; then the close must follow, or the
// rest of the record is not read; the next notice starts at the next open tag. Every string of up to 5 tokens, every
// command of up to 4 tokens inside the harness's own shape with each tail it writes, and every two or three
// harness-shaped notices with each tail and each text between; the meter's count is read through split.
const { split, DEFAULTS } = await import(process.argv[2]);
const rx = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const OPEN = '<summary>Background command "', WORDS = ' was stopped after reaching its background time limit';
const END = String.raw`<\/summary>(?=\s*(?:<note>|<result>|<usage>|<\/task-notification>|$))`;
const HEAD = /(?:(?!<summary>|<result>|<\/task-notification>)[\s\S])*/y;
const SUMMARY = new RegExp(String.raw`<summary>(?:(?!${END})[\s\S])*${END}`, 'y');
const STOP = new RegExp(String.raw`^<summary>Background command "[\s\S]*"${WORDS}<\/summary>$`);
const TAIL = /(?:\s*<(note|usage)>[\s\S]*?(?:<\/\1>|$))*\s*/y;
const want = (s) => {
  let n = 0, i = s.indexOf('<task-notification>');
  while (i >= 0) {
    HEAD.lastIndex = i + '<task-notification>'.length; HEAD.exec(s);
    let j = HEAD.lastIndex;
    if (s.startsWith('<summary>', j)) {
      SUMMARY.lastIndex = j;
      const m = SUMMARY.exec(s);
      if (!m) break;
      if (STOP.test(m[0])) n++;
      j = SUMMARY.lastIndex;
    }
    TAIL.lastIndex = j; TAIL.exec(s); j = TAIL.lastIndex;
    if (!s.startsWith('</task-notification>', j)) break;
    i = s.indexOf('<task-notification>', j + '</task-notification>'.length);
  }
  return n;
};
const toks = [OPEN, `"${WORDS}</summary>`, '"', 'x', '</summary>', '<summary>', '<result>', '</task-notification>', '<note>', '<usage>', '\n', `${WORDS}</summary>`, '<task-notification>'];
const T = new Date(Date.UTC(2026, 0, 1)).toISOString();
let n = 0, differ = 0;
const check = (body) => {
  const rec = { type: 'user', timestamp: T, origin: { kind: 'task-notification' }, message: { content: body } };
  const got = split([rec], 0, Date.parse(T) + 1, rx).limited;
  n++; if (got !== want(body)) { differ++; if (differ <= 3) console.log('DIFF', JSON.stringify(body), got, want(body)); }
};
const strings = function* (s, d) { yield s; if (d) for (const t of toks) yield* strings(s + t, d - 1); };
const TAILS = ['', '<note>n</note>', '<usage>u</usage>', '<result>r</result>', '\n', '\n<note>n</note>\n<usage>u</usage>\n', '<note>n'];
for (const s of strings('', 5)) check(`<task-notification>${s}</task-notification>`);
for (const c of strings('', 4)) for (const tail of TAILS) check(`<task-notification><task-id>k</task-id><status>killed</status>${OPEN}${c}"${WORDS}</summary>${tail}</task-notification>`);
const shaped = [`${OPEN}x"${WORDS}</summary>`, `${OPEN}x"${WORDS}</summary>junk`, `${OPEN}x"${WORDS}`, '<summary>Agent "a" done</summary>', `${OPEN}"${WORDS}</summary>`, ''];
const notices = shaped.flatMap((p) => TAILS.map((t) => `<task-notification>${p}${t}</task-notification>`)).concat(['<task-notification>', `<task-notification>${OPEN}x"${WORDS}</summary>`]);
const between = ['', '\n', 'text', '<result>r</result>', '</task-notification>'];
for (const a of notices) for (const g of between) for (const b of notices) {
  check(a + g + b);
  for (const c of [notices[0], notices.at(-1)]) check(a + g + b + c);
}
console.log({ cases: n, differ });
