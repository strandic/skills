// Gate R2 (skills-cb5t): every sequence of length 1..3 over 11 unit kinds, in a session with one lane.
//   node parts-sum.mjs <base scripts/ dir> <candidate scripts/ dir>
// Per sequence: (a) the candidate's parts sum to the base's session figures; (b) its cut count equals an
// independent count; (c) its session fields other than parts and lanes equal the base's; (d) no label
// without --labels and no private text, path or full id in any output. Prints `graded <n>/1463` and PASS or FAIL.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [BASE, CAND] = process.argv.slice(2).map((p) => resolve(p));
const B = await import(pathToFileURL(join(BASE, 'runmeter.mjs')).href), S = await import(pathToFileURL(join(CAND, 'runmeter.mjs')).href);
const SP = await import(pathToFileURL(join(CAND, 'plantime.mjs')).href);
const rx = Object.fromEntries(Object.entries(B.DEFAULTS).map(([k, v]) => [k, new RegExp(v, 'i')]));
const SECRET = 'SECRET-TEXT';
const NOORIGIN = process.env.NOORIGIN === '1'; // variant: typed skill commands carry no origin (fixture shape)
const at = (min) => new Date(Date.parse('2026-11-01T08:00:00Z') + min * 60000).toISOString();
const tok = (i) => ({ input_tokens: i, output_tokens: 2 * i, cache_creation_input_tokens: 3 * i, cache_read_input_tokens: 5 * i });
const cmd = (args) => `<command-message>shawarma</command-message>\n<command-name>/shawarma</command-name>\n<command-args>${args}</command-args>`;
const KINDS = ['text', 'cmdL', 'cmdN', 'builtin', 'modelSkill', 'skillTool', 'asst', 'asstRepeat', 'lane', 'compact', 'interrupt'];
let n = 0;
function build(seq) {
  const recs = [], lanes = []; let last = null, m = 1;
  const own = NOORIGIN ? {} : { origin: { kind: 'human' } };
  for (const k of seq) {
    const t = at(m); m += 1;
    if (k === 'text') recs.push({ type: 'user', timestamp: t, origin: { kind: 'human' }, message: { content: SECRET } });
    if (k === 'cmdL') recs.push({ type: 'user', timestamp: t, ...own, message: { content: cmd('plan t-0001') } });
    if (k === 'cmdN') recs.push({ type: 'user', timestamp: t, ...own, message: { content: cmd(`"${SECRET}"`) } });
    if (k === 'builtin') recs.push({ type: 'user', timestamp: t, message: { content: '<command-name>/compact</command-name>\n<command-message>compact</command-message>\n<command-args></command-args>' } });
    if (k === 'modelSkill') recs.push({ type: 'user', timestamp: t, isMeta: true, message: { content: '<command-message>shawarma</command-message>\n<command-name>shawarma</command-name>\n<skill-format>true</skill-format>' } });
    if (k === 'skillTool') { const id = `tu${++n}`; last = `m${++n}`; recs.push({ type: 'assistant', timestamp: t, message: { id: last, model: 'claude-opus-5-5', usage: tok(7), content: [{ type: 'tool_use', id, name: 'Skill', input: { skill: 'shawarma', args: 'run t-0003' } }] } }); recs.push({ type: 'user', timestamp: at(m - 0.5), message: { content: [{ type: 'tool_result', tool_use_id: id, content: SECRET }] } }); }
    if (k === 'asst') { last = `m${++n}`; recs.push({ type: 'assistant', timestamp: t, message: { id: last, model: 'claude-opus-5-5', usage: tok(1), content: [{ type: 'text', text: SECRET }] } }); }
    if (k === 'asstRepeat') { const id = last ?? `m${++n}`; last = id; recs.push({ type: 'assistant', timestamp: t, message: { id, model: 'claude-opus-5-5', usage: tok(11), content: [{ type: 'text', text: SECRET }] } }); }
    if (k === 'lane') lanes.push(t);
    if (k === 'compact') recs.push({ type: 'user', timestamp: t, isCompactSummary: true, message: { content: SECRET } });
    if (k === 'interrupt') recs.push({ type: 'user', timestamp: t, message: { content: '[Request interrupted by user]' } });
  }
  if (!lanes.length) lanes.push(at(m)); // the session's one lane, after the sequence
  return { recs, lanes, end: m };
}
// independent cut count: origin.kind in owner set, no isMeta, text opening with <command-message>
const OWN = new Set(['human', 'person', 'composer', 'suggestion']);
const text = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n') : '');
const oracleCuts = (recs) => recs.filter((d) => d.type === 'user' && OWN.has(d.origin?.kind) && !d.isMeta && /^\s*<command-message>/.test(text(d.message.content))).length;
const TK = ['input', 'output', 'cacheWrite', 'cacheRead'];
const root = mkdtempSync(join(tmpdir(), 'a2-'));
let graded = 0, crashed = 0, total = 0, nulls = 0, nullMismatch = 0, sumBad = 0, cutBad = 0, leak = 0, labelNoFlag = 0, sharedChanged = 0, crossing = 0, partsOut = 0; const ex = [];
const seqs = [];
const rec = (pre) => { if (pre.length) seqs.push(pre); if (pre.length < 3) for (const k of KINDS) rec([...pre, k]); };
rec([]);
for (const seq of seqs) {
  total++;
  const { recs, lanes } = build(seq);
  try {
  const dir = join(root, String(total), 'projects', '-home-u-demo'); const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  mkdirSync(join(dir, sid, 'subagents'), { recursive: true });
  writeFileSync(join(dir, `${sid}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  lanes.forEach((t, i) => writeFileSync(join(dir, sid, 'subagents', `agent-${String(i).repeat(16)}.jsonl`), [{ type: 'user', isSidechain: true, timestamp: t, message: { content: `${SECRET} docs/plans/x` } }, { type: 'assistant', timestamp: new Date(Date.parse(t) + 90000).toISOString(), message: { id: 'L' + i, model: 'claude-opus-5-5', usage: tok(100), content: [] } }].map((r) => JSON.stringify(r)).join('\n') + '\n'));
  let b, s;
  const call = (M, labels) => { try { return M.collect(join(root, String(total), 'projects'), 'demo', { rx, labels }); } catch (e) { return { err: String(e.message) }; } };
  b = call(B, true); s = call(S, true);
  const bs = b.sessions?.[0], ss = s.sessions?.[0];
  if (!bs || !ss) { nulls++; if (!!bs !== !!ss || b.err !== s.err) { nullMismatch++; ex.push(`null mismatch ${seq}`); } continue; }
  const sum = (f) => ss.parts.reduce((x, p) => x + f(p), 0);
  const chk = [['turns', sum((p) => p.ownerTurns), bs.ownerTurns], ['messages', sum((p) => p.messages), bs.messages], ['lanes', sum((p) => p.lanes), bs.lanes.length], ...TK.flatMap((k) => [['t.' + k, sum((p) => p.tokens[k]), bs.tokens[k]], ['lt.' + k, sum((p) => p.laneTokens[k]), bs.laneTokens[k]]])];
  const bad = chk.filter(([, g, w]) => g !== w);
  if (bad.length) { sumBad++; if (ex.length < 12) ex.push(`SUM ${seq}: ${bad.map(([k, g, w]) => `${k} ${g}/${w}`).join(' ')}`); }
  const all = SP.records(join(dir, `${sid}.jsonl`)).recs;
  const cs = S.cuts(all).starts.length, co = oracleCuts(recs);
  if (cs !== co) { cutBad++; if (ex.length < 24) ex.push(`CUTS ${seq}: sketch ${cs} oracle ${co}`); }
  partsOut += ss.parts.length;
  crossing += s.sessions[0].lanes.filter((l) => l.crossesCommand).length;
  const { parts, lanes: sl, ...r1 } = ss; const { lanes: bl, ...r2 } = bs; if (JSON.stringify(r1) !== JSON.stringify(r2)) sharedChanged++;
  // A5: no labels without --labels, no SECRET / path / 36-char id in text and json
  const s0 = call(S, false);
  if (s0.sessions[0].parts.some((p) => p.label !== null)) labelNoFlag++;
  const rep = { lanesByHalfMonth: S.laneTable(s0.sessions), sessions: s0.sessions, totals: S.totals(s0.sessions, s0.files) };
  const repL = { lanesByHalfMonth: S.laneTable(s.sessions), sessions: s.sessions, totals: S.totals(s.sessions, s.files) };
  for (const out of [S.render(rep).join('\n'), JSON.stringify(rep), S.render(repL).join('\n'), JSON.stringify(repL)]) {
    if (out.includes('SECRET') || /\/[A-Za-z]/.test(out.replace(/plan\/run/g, '')) || /[0-9a-f]{8}-[0-9a-f]{4}-/.test(out) || /aaaaaaaaa|0{9}/.test(out)) { leak++; if (ex.length < 30) ex.push(`LEAK ${seq}`); break; }
  }
  graded++;
  } catch (e) { crashed++; if (ex.length < 30) ex.push(`CRASH ${seq}: ${e?.name}`); }
}
rmSync(root, { recursive: true, force: true });
console.log(`mode ${NOORIGIN ? 'typed commands with NO origin' : 'typed commands with origin human (real shape)'}`);
console.log(`sequences ${total}; both null ${nulls} (null/err mismatch ${nullMismatch}); parts emitted ${partsOut}; (a) parts-sum mismatches ${sumBad}; (b) cut-count mismatches ${cutBad}; shared session fields changed ${sharedChanged}; lanes crossing ${crossing}; A5 label without --labels ${labelNoFlag}; A5 leak hits ${leak}`);
const ok = graded + nulls === total && !crashed && !sumBad && !cutBad && !sharedChanged && !nullMismatch && !labelNoFlag && !leak;
console.log(`graded ${graded + nulls}/1463 · crashed ${crashed}`);
console.log(ex.join('\n'));
console.log(graded === 0 || graded + nulls < 1463 ? 'CANNOT-RUN' : ok ? 'PASS' : 'FAIL');
