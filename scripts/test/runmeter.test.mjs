/**
 * Tests for scripts/runmeter.mjs, the run meter.
 *
 * The meter reads Claude Code transcripts and prints, for each session that started lanes: each
 * lane's models, effort, minutes and tokens, the owner's turns, and with --prs the merged pull
 * requests. It prints counts and names; with --labels also the first two words of the command that opened
 * each session. No other message text is printed.
 *
 * Every transcript, meta file, repository and `gh` here is synthetic, built in a temporary folder.
 *
 * `node --test scripts/test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync, chmodSync, existsSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  USAGE, DEFAULTS, KINDS, CLASSES, GH_ARGS, Unusable, word, short, dayOf, halfMonth, isDay, modelClass, usage, cleanLabel, commandWords, owner,
  laneKind, lanePrompt, agentFiles, readLane, collect, laneTable, totals, median, prStats, prs, GIT_REPOSITORY_VARS, checkPromptsDir, writePrompts, render, parseArgs, main,
} from '../runmeter.mjs';

// The variables that move git's idea of the repository: the --prompts check must run git without them.
const MOVERS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_NAMESPACE', 'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM', 'GIT_PREFIX'];
// git reads no global or system settings here, and none of those variables, so the guard tests depend on the fixture alone.
Object.assign(process.env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
for (const k of MOVERS) delete process.env[k];

const SCRIPT = fileURLToPath(new URL('../runmeter.mjs', import.meta.url)); // not URL.pathname: a checkout path may hold a space
const SECRET = 'SECRET-TEXT'; // stands for private text: it must never reach stdout or stderr
// A file or folder with mode 000 is how these tests make one that cannot be read. Root reads it all the same.
const UNREADABLE = process.getuid?.() === 0 ? { skip: 'running as root: a file or folder with mode 000 can still be read' } : {};
const rx = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, new RegExp(v, 'i')]));

// Record builders. `at(day, min)` is `min` minutes after 08:00 UTC on that day.
const at = (day, min = 0) => new Date(Date.parse(`${day}T08:00:00Z`) + min * 60000).toISOString();
const tokens = (input, output, cacheWrite, cacheRead) => ({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead });
let uid = 0;
const asst = (t, o = {}) => ({
  type: 'assistant',
  timestamp: t,
  message: {
    id: 'id' in o ? o.id : `msg_${++uid}`,
    model: 'model' in o ? o.model : 'claude-opus-5-5',
    usage: 'usage' in o ? o.usage : tokens(1, 2, 3, 4),
    content: o.content ?? [{ type: 'text', text: SECRET }],
  },
  ...(o.extra ?? {}),
});
const user = (t, content, extra = {}) => ({ type: 'user', timestamp: t, message: { content }, ...extra });
const human = (t, text = SECRET) => user(t, text, { origin: { kind: 'human' } });
const skill = (t, words, name = 'shawarma') => user(t, `<command-message>${name}</command-message>\n<command-name>/${name}</command-name>\n<command-args>${words}</command-args>`);
const builtin = (t, name, words = '') => user(t, `<command-name>/${name}</command-name>\n<command-message>${name}</command-message>\n<command-args>${words}</command-args>`);
const prompt = (t, text) => user(t, text, { isSidechain: true });

const ROOTS = [];
process.on('exit', () => { for (const r of ROOTS) { try { rmSync(r, { recursive: true, force: true }); } catch { /* best effort */ } } });
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'runmeter-'));
  ROOTS.push(root);
  const write = (rel, content) => {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, Array.isArray(content) ? content.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n' : JSON.stringify(content));
    return p;
  };
  return { root, write, projects: join(root, 'projects') };
};

// Session ids and agent ids are repeated hex digits.
const S1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', S2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', S3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc', S4 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const agent = (pair) => `agent-${pair.repeat(8)}0`;
const MAIN = '-home-u-demo', TREE = '-home-u-demo--worktrees-t-0001', AWAY = '-home-u-elsewhere';
const P1 = `${SECRET} Write the brief at docs/plans/t-0001/brief.md`;
// A lane started by a workflow tool opens with two user records: a relay of the owner's request, then its own task.
const RELAY = `${SECRET} the owner asked: run t-0002`;
const TASK = `${SECRET} Implement step 2 of docs/plans/t-0002/brief.md`;

/**
 * Two project folders that share the key `demo` (a main checkout and a worktree) and one that does not.
 * Session 1 (2026-09-20) has four lanes; session 2 (2026-10-03 and 04) has three; session 3 has none.
 */
const project = () => {
  const f = fixture();
  const D = '2026-09-20';
  f.write(`projects/${MAIN}/${S1}.jsonl`, [
    builtin(at(D, 0), 'clear'),
    skill(at(D, 1), 'plan t-0001'),
    asst(at(D, 2), { id: 'o1', usage: tokens(10, 100, 1000, 10000), extra: { effort: 'high' } }),
    human(at(D, 30)),
    asst(at(D, 31), { id: 'o2', usage: tokens(20, 200, 2000, 20000), extra: { effort: 'max' } }),
    human(at(D, 60)),
    asst(at(D, 90), { id: 'o3', usage: tokens(30, 300, 3000, 30000), extra: { effort: 'high' } }),
  ]);
  const sub1 = `projects/${MAIN}/${S1}/subagents`;
  // A plan/run lane on a Sonnet-class model. Its first message is on three records, the output count growing.
  f.write(`${sub1}/${agent('a1')}.jsonl`, [
    prompt(at(D, 5), P1),
    asst(at(D, 6), { id: 'm1', model: 'claude-sonnet-5', usage: tokens(7, 5, 70, 700), extra: { effort: 'high' } }),
    asst(at(D, 7), { id: 'm1', model: 'claude-sonnet-5', usage: tokens(7, 50, 70, 700), extra: { effort: 'high' } }),
    asst(at(D, 8), { id: 'm1', model: 'claude-sonnet-5', usage: tokens(7, 500, 70, 700), extra: { effort: 'high' } }),
    asst(at(D, 9), { id: 'm9', model: '<synthetic>', usage: tokens(999, 999, 999, 999) }),
    asst(at(D, 17.5), { id: 'm2', model: 'claude-sonnet-5', extra: { effort: 'high' } }),
  ]);
  f.write(`${sub1}/${agent('a1')}.meta.json`, { agentType: 'general-purpose', model: 'sonnet', description: SECRET, launchedWithDefaults: true });
  // A retro lane in a nested folder: it names both folders, and retro is tried before plans.
  f.write(`${sub1}/workflows/wf_1/${agent('b2')}.jsonl`, [
    prompt(at(D, 6), `${SECRET} Read docs/retros/0001.md, then docs/plans/t-0001/brief.md`),
    asst(at(D, 7), { usage: tokens(100, 1000, 10000, 100000), extra: { effort: 'medium', requestedModel: 'claude-opus-5-5' } }),
    asst(at(D, 8), { extra: { effort: 'medium', requestedModel: 'claude-opus-5-5' } }),
  ]);
  f.write(`${sub1}/workflows/wf_1/${agent('b2')}.meta.json`, { agentType: 'workflow-subagent', description: SECRET });
  f.write(`${sub1}/workflows/wf_1/journal.jsonl`, [{ type: 'launched' }, asst(at(D, 7))]);
  // A replay lane on a Haiku-class model, with no meta file: the marker wins over docs/plans/.
  f.write(`${sub1}/${agent('c3')}.jsonl`, [
    prompt(at(D, 7), `You are the scorer: credit each trap item. ${SECRET} Score docs/plans/t-0001/brief.md`),
    asst(at(D, 8), { model: 'claude-haiku-4-5-20251001' }),
  ]);
  // A plan/run lane from an older transcript: no model, usage, message id or effort, and no meta file.
  f.write(`${sub1}/${agent('d4')}.jsonl`, [
    prompt(at(D, 8), `${SECRET} Follow docs/plans/t-0001/brief.md`),
    asst(at(D, 8.5), { id: undefined, model: undefined, usage: undefined }),
    asst(at(D, 9), { id: undefined, model: undefined, usage: undefined }),
  ]);

  // Session 2, in the worktree's folder, on a model outside the three classes. It spans two days.
  // Its command goes on, in plain words, after the two that a label may hold.
  f.write(`projects/${TREE}/${S2}.jsonl`, [
    skill(at('2026-10-03', 0), `run t-0002 for ${SECRET}`, 'strandic:shawarma'),
    asst(at('2026-10-03', 1), { id: 'p1', model: 'claude-fable-5-1', usage: tokens(1, 10, 100, 1000), extra: { effort: 'medium' } }),
    human(at('2026-10-04', 0)),
    asst(at('2026-10-04', 5), { id: 'p2', model: 'claude-fable-5-1', usage: tokens(2, 20, 200, 2000), extra: { effort: 'medium' } }),
  ]);
  const sub2 = `projects/${TREE}/${S2}/subagents`;
  f.write(`${sub2}/${agent('e5')}.jsonl`, [prompt(at('2026-10-03', 2), `${SECRET} Implement docs/plans/t-0002/brief.md`), asst(at('2026-10-03', 4), { model: 'claude-fable-5-1' })]);
  f.write(`${sub2}/${agent('e5')}.meta.json`, { agentType: 'general-purpose', launchedWithDefaults: false, description: SECRET });
  f.write(`${sub2}/${agent('f6')}.jsonl`, [prompt(at('2026-10-04', 1), `${SECRET} explore the code`), asst(at('2026-10-04', 3))]);
  f.write(`${sub2}/${agent('f6')}.meta.json`, { agentType: 'Explore', model: 'opus' });
  // A plan/run lane started by a workflow tool: the relay, then the task. The meta record between them and
  // the orchestrator's later record are not its prompt: read, they would make it a retro or a replay lane.
  f.write(`${sub2}/workflows/wf_2/${agent('a7')}.jsonl`, [
    prompt(at('2026-10-03', 3), RELAY),
    user(at('2026-10-03', 3.1), `<system-reminder>${SECRET} see docs/retros/0001.md</system-reminder>`, { isMeta: true, isSidechain: true }),
    prompt(at('2026-10-03', 3.2), TASK),
    asst(at('2026-10-03', 4)),
    prompt(at('2026-10-03', 5), `${SECRET} You are the scorer: credit each trap item`),
    asst(at('2026-10-03', 6)),
  ]);
  f.write(`${sub2}/workflows/wf_2/${agent('a7')}.meta.json`, { agentType: 'workflow-subagent', description: SECRET });

  // A session with no lane, and a session with a lane in a folder the key does not match.
  f.write(`projects/${MAIN}/${S3}.jsonl`, [human(at(D, 0)), asst(at(D, 1))]);
  f.write(`projects/${AWAY}/${S4}.jsonl`, [human(at(D, 0)), asst(at(D, 1))]);
  f.write(`projects/${AWAY}/${S4}/subagents/${agent('07')}.jsonl`, [prompt(at(D, 2), P1), asst(at(D, 3))]);
  return f;
};

const json = (f, ...flags) => JSON.parse(main(['node', 'runmeter', f.projects, 'demo', '--json', ...flags])[0]);
const text = (f, ...flags) => main(['node', 'runmeter', f.projects, 'demo', ...flags]);
const cli = (args, env = {}) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, out: r.stdout, err: r.stderr };
};

// --- model class and half-month -----------------------------------------------------------------

test('modelClass: by the family name in the id; any other id is other; no id, or one that is not a plain word, is unknown', () => {
  const cases = [
    ['claude-opus-5-5', 'opus'], ['claude-sonnet-5', 'sonnet'], ['claude-haiku-4-5-20251001', 'haiku'], ['us.anthropic.claude-OPUS-5-5-v1:0', 'opus'],
    ['claude-opus-5-5[1m]', 'opus'], ['claude-fable-5-1', 'other'], ['some-model', 'other'],
    [undefined, 'unknown'], [null, 'unknown'], ['', 'unknown'], ['?', 'unknown'], ['<synthetic>', 'unknown'], [7, 'unknown'],
    // An id that is not one plain word is not read, whatever name it holds.
    ['claude opus 5', 'unknown'], ['/home/u/claude-opus-5-5', 'unknown'], [`claude-opus-${'5'.repeat(60)}`, 'unknown'], ['vendor/claude-opus-5-5', 'opus'],
  ];
  for (const [id, want] of cases) assert.equal(modelClass(id), want, String(id));
  assert.deepEqual(CLASSES, ['opus', 'sonnet', 'haiku', 'other', 'unknown']);
});

test('halfMonth, dayOf, isDay: UTC days; the 15th is in the first half, the 16th in the second', () => {
  assert.equal(halfMonth('2026-09-01'), '2026-09 first half');
  assert.equal(halfMonth('2026-09-15'), '2026-09 first half');
  assert.equal(halfMonth('2026-09-16'), '2026-09 second half');
  assert.equal(halfMonth('2026-02-28'), '2026-02 second half');
  assert.equal(dayOf(Date.parse('2026-09-15T23:59:59.999Z')), '2026-09-15');
  assert.equal(dayOf(Date.parse('2026-09-16T01:30:00+02:00')), '2026-09-15', 'the UTC day, not the local one');
  for (const ok of ['2026-09-17', '2028-02-29']) assert.ok(isDay(ok), ok);
  for (const no of ['2026-9-17', '2026-13-01', '2026-02-30', '2026-09-17T00:00:00Z', 'yesterday', '']) assert.ok(!isDay(no), no);
});

test('laneTable: plan/run lanes only, by half-month and class; the last Sonnet- or Haiku-class day; other ids listed', () => {
  const lane = (day, kind, model) => ({ day, kind, modelClass: modelClass(model), resolved: model ? [model] : [] });
  const sessions = [
    { lanes: [lane('2026-10-06', 'plan/run', 'claude-sonnet-5'), lane('2026-09-16', 'plan/run', 'claude-haiku-4-5'), lane('2026-09-15', 'plan/run', 'claude-opus-5')] },
    { lanes: [lane('2026-09-30', 'plan/run', 'claude-sonnet-5'), lane('2026-09-17', 'plan/run', 'claude-opus-5-5'), lane('2026-10-20', 'plan/run', 'claude-opus-5-5'),
      lane('2026-10-21', 'plan/run', 'claude-fable-5-1'), lane('2026-10-22', 'plan/run', 'claude-fable-5-1'), lane('2026-10-23', 'plan/run', undefined),
      lane('2026-11-09', 'retro', 'claude-sonnet-5'), lane('2026-11-09', 'replay', 'claude-haiku-4-5'), lane('2026-11-09', 'other', 'claude-sonnet-5')] },
  ];
  assert.deepEqual(laneTable(sessions), {
    rows: [
      { halfMonth: '2026-09 first half', opus: 1, sonnet: 0, haiku: 0, other: 0, unknown: 0 },
      { halfMonth: '2026-09 second half', opus: 1, sonnet: 1, haiku: 1, other: 0, unknown: 0 },
      { halfMonth: '2026-10 first half', opus: 0, sonnet: 1, haiku: 0, other: 0, unknown: 0 },
      { halfMonth: '2026-10 second half', opus: 1, sonnet: 0, haiku: 0, other: 2, unknown: 1 },
    ],
    lastSonnetOrHaikuDay: '2026-10-06',
    otherModels: { 'claude-fable-5-1': 2 },
  });
  assert.deepEqual(laneTable([{ lanes: [lane('2026-10-20', 'plan/run', 'claude-opus-5-5')] }]).lastSonnetOrHaikuDay, null);
  assert.deepEqual(laneTable([]), { rows: [], lastSonnetOrHaikuDay: null, otherModels: {} });
});

// --- usage ------------------------------------------------------------------------------------

test('usage: a message id counts once, at the highest value of each field; a synthetic record is no message', () => {
  const D = '2026-09-20';
  const recs = [
    asst(at(D, 0), { id: 'm1', usage: tokens(7, 5, 70, 700), extra: { effort: 'high', requestedModel: 'claude-opus-5-5' } }),
    asst(at(D, 1), { id: 'm1', usage: tokens(7, 50, 70, 700), extra: { effort: 'high' } }),
    asst(at(D, 2), { id: 'm1', usage: tokens(7, 500, 70, 700), extra: { effort: 'high' } }),
    asst(at(D, 3), { id: 'm2', model: 'claude-sonnet-5', usage: tokens(1, 2, 3, 4), extra: { effort: 'max', requestedModel: 'claude-sonnet-5' } }),
    asst(at(D, 4), { id: 'm3', model: '<synthetic>', usage: tokens(999, 999, 999, 999), extra: { effort: 'low', requestedModel: 'nothing' } }),
    asst(at(D, 5), { id: undefined, usage: { input_tokens: 10 }, extra: { effort: `two words ${SECRET}` } }),
    asst(at(D, 6), { id: undefined, usage: undefined }),
    user(at(D, 7), 'x', { effort: 'never read' }),
  ];
  const want = { messages: 4, tokens: { input: 18, output: 502, cacheWrite: 73, cacheRead: 704 }, models: ['claude-opus-5-5', 'claude-sonnet-5'],
    requested: ['claude-opus-5-5', 'claude-sonnet-5'], effort: ['high', 'max', '?'] };
  assert.deepEqual(usage(recs), want);
  // The order of a message's records does not matter: the highest value is kept.
  assert.deepEqual(usage([...recs].reverse()).tokens, want.tokens);
  assert.deepEqual(usage([]), { messages: 0, tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, models: [], requested: [], effort: [] });
  // The model that wrote most messages comes first.
  const mixed = [asst(at(D, 0), { model: 'claude-opus-5' }), asst(at(D, 1), { model: 'claude-sonnet-5' }), asst(at(D, 2), { model: 'claude-sonnet-5' })];
  assert.deepEqual(usage(mixed).models, ['claude-sonnet-5', 'claude-opus-5']);
});

test('word and short: only a plain word, or the head of an id, is ever printed', () => {
  for (const ok of ['claude-opus-5-5', 'general-purpose', 'us.anthropic.claude-opus-5-5-v1:0', 'claude-opus-5-5[1m]', 'a/b@c', 'vendor/model', 'high', 'x'.repeat(60), `${'x'.repeat(29)}/${'y'.repeat(30)}`]) assert.equal(word(ok), ok);
  for (const no of [`two ${SECRET}`, '', 'a\nb', 'a\n', '<synthetic>', 'x'.repeat(61), 'café', undefined, null, 7, { a: 1 }]) assert.equal(word(no), '?', String(no));
  // One slash at most, and never first or last: a model id such as vendor/model prints, a path does not.
  for (const path of ['/home/u/x', 'a/b/c', '/a', 'a/', '/', '//', 'a//b', '/home/u/private-place', 'docs/plans/t-0001', '~/x/y', '../../x', `${'x'.repeat(30)}/${'y'.repeat(30)}`]) assert.equal(word(path), '?', path);
  assert.equal(short('aaaaaaaa-aaaa-aaaa'), 'aaaaaaaa');
  assert.equal(short('a/../b c.jsonl'), 'a____b_c');
  assert.equal(short('ab'), 'ab');
});

// --- the owner --------------------------------------------------------------------------------

test('cleanLabel: two words at most, each 1 to 24 of [A-Za-z0-9._-]; reading stops at the first word that is not one', () => {
  const cases = [
    ['plan t-0001', 'plan t-0001'],
    ['  run \t t-0002  ', 'run t-0002'],
    ['retro', 'retro'],
    ['v1.2_x-y Z9', 'v1.2_x-y Z9'],
    // Two words at most: what the owner typed after them is never read.
    ['plan t-0001 and more words', 'plan t-0001'],
    [`run t-0002 for ${SECRET}`, 'run t-0002'],
    [`plan\nt-0001\n${SECRET}`, 'plan t-0001'],
    // A word with any other character ends the reading: a slash, a comma, a quote, a letter outside A-Z.
    ['plan docs/plans/t-0001/a_b.md', 'plan'],
    ['/home/u/private-place plan', ''],
    ['docs/x plan', ''],
    [`run t-0002, then "${SECRET}"`, 'run'],
    [`"${SECRET}" plan`, ''],
    [`é${SECRET}`, ''],
    ['plan café', 'plan'],
    // A word is 24 characters at most.
    [`plan ${'a'.repeat(24)}`, `plan ${'a'.repeat(24)}`],
    [`plan ${'a'.repeat(25)}`, 'plan'],
    [`${'a'.repeat(25)} plan`, ''],
    ['', ''], ['   ', ''], [undefined, ''], [null, ''], [7, ''],
  ];
  for (const [given, want] of cases) assert.equal(cleanLabel(given), want, String(given));
});

test('commandWords: only a skill command the harness wrote; never a built-in command or typed text', () => {
  const D = '2026-09-20';
  assert.equal(commandWords(skill(at(D), 'plan t-0001')), 'plan t-0001');
  assert.equal(commandWords(skill(at(D), ' retro ', 'strandic:shawarma')), 'retro');
  assert.equal(commandWords(skill(at(D), '')), '');
  assert.equal(commandWords(builtin(at(D), 'add-dir', '/home/u/private-place')), '', 'a built-in command may name a path');
  assert.equal(commandWords(human(at(D), '/shawarma plan t-0001')), '', 'typed text is not read');
  assert.equal(commandWords(human(at(D), '/home/u/private-place is broken')), '');
  assert.equal(commandWords(human(at(D), `see <command-message>x</command-message><command-args>${SECRET}</command-args>`)), '', 'a record quoting the tags');
  assert.equal(commandWords(asst(at(D))), '');
  assert.equal(commandWords({ type: 'user', timestamp: at(D) }), '');
});

test('owner: a run of owner records is one turn; accompanying records do not end it; the label is the first skill command with words', () => {
  const D = '2026-09-20';
  const ask = { type: 'tool_use', id: 'q1', name: 'AskUserQuestion', input: { questions: [] } };
  const shell = { type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'ls' } };
  const recs = [
    builtin(at(D, 0), 'add-dir', '/home/u/private-place'), skill(at(D, 1), ''), skill(at(D, 2), 'plan t-0001'), skill(at(D, 3), 'run t-0001'), // turn 1
    asst(at(D, 4)),
    human(at(D, 10)), user(at(D, 11), `<system-reminder>${SECRET}</system-reminder>`, { isMeta: true }), human(at(D, 12)), // turn 2
    asst(at(D, 13), { content: [ask] }),
    user(at(D, 20), [{ type: 'tool_result', tool_use_id: 'q1', content: SECRET }]), // turn 3: an answer
    asst(at(D, 21)),
    user(at(D, 22), [{ type: 'text', text: '[Request interrupted by user]' }]), // an interrupt is no turn
    asst(at(D, 23)),
    user(at(D, 24), `<task-notification>${SECRET}</task-notification>`, { origin: { kind: 'task-notification' } }), // a lane's report is no turn
    human(at(D, 30)), // turn 4
    asst(at(D, 31), { content: [shell] }),
    // A tool call the owner rejects, with a typed reason, is that call's result: no turn.
    user(at(D, 32), [{ type: 'tool_result', tool_use_id: 'b1', is_error: true, content: `The user doesn't want to proceed with this tool use. The user said:\n${SECRET}` }]),
    asst(at(D, 33)),
  ];
  assert.deepEqual(owner(recs), { turns: 4, label: 'plan t-0001' });
  assert.deepEqual(owner([]), { turns: 0, label: '' });
  // A skill command that the owner did not give is not the label: a meta record, a lane's report quoting one.
  const quoted = skill(at(D, 1), 'plan t-9999').message.content;
  const notOwner = [user(at(D, 0), quoted, { isMeta: true }), user(at(D, 1), quoted, { origin: { kind: 'task-notification' } }), asst(at(D, 2))];
  assert.deepEqual(owner(notOwner), { turns: 0, label: '' });
});

// --- lane kind --------------------------------------------------------------------------------

test('laneKind: replay, then retro, then plan/run, else other; the patterns ignore case', () => {
  const cases = [
    ['Write docs/plans/t-0001/brief.md', 'plan/run'],
    ['Read docs/retros/0001.md', 'retro'],
    ['Read docs/retros/0001.md and docs/plans/t-0001/brief.md', 'retro'],
    ['Replay the planning method on docs/plans/t-0001', 'replay'],
    ['You are the scorer: credit each trap item. Read docs/retros/0001.md', 'replay'],
    ['you are the proxy: answer from the rulings on record', 'replay'],
    ['You are replaying a plan for a past ticket', 'replay'],
    ['Replay the failing request against the server', 'other'], // the word alone is no marker
    ['Set the proxy for the build', 'other'],
    ['Explore the code', 'other'],
    ['', 'other'],
  ];
  for (const [p, want] of cases) assert.equal(laneKind(p, rx), want, p);
  assert.deepEqual(KINDS, ['plan/run', 'retro', 'replay', 'other']);
});

test('lanePrompt: the user records before the first answer, joined with a blank line; a meta record is left out', () => {
  const D = '2026-09-20';
  const relay = prompt(at(D, 0), RELAY), task = prompt(at(D, 0), TASK);
  const meta = user(at(D, 0), `<system-reminder>${SECRET}</system-reminder>`, { isMeta: true, isSidechain: true });
  const later = prompt(at(D, 2), 'the orchestrator writes to the lane');
  assert.equal(lanePrompt([relay, meta, task, asst(at(D, 1)), later, asst(at(D, 3))]), `${RELAY}\n\n${TASK}`);
  assert.equal(lanePrompt([task, asst(at(D, 1)), later]), TASK, 'a lane started by the Agent tool has one');
  assert.equal(lanePrompt([relay, task]), `${RELAY}\n\n${TASK}`, 'a lane that never answered');
  assert.equal(lanePrompt([asst(at(D, 0)), task]), '', 'nothing before the first answer');
  assert.equal(lanePrompt([meta, asst(at(D, 1))]), '');
  assert.equal(lanePrompt([]), '');
  // A record that holds no text adds nothing, so no blank line stands for it.
  assert.equal(lanePrompt([prompt(at(D, 0), [{ type: 'image' }]), task, user(at(D, 0), undefined), asst(at(D, 1))]), TASK);
  assert.equal(lanePrompt([prompt(at(D, 0), [{ type: 'text', text: 'one' }, { type: 'image' }, { type: 'text', text: 'two' }]), task]), `one\ntwo\n\n${TASK}`);
  // The kind is guessed from the same text: the task decides, and what comes after the first answer does not.
  assert.equal(laneKind(lanePrompt([relay, meta, task, asst(at(D, 1)), prompt(at(D, 2), 'You are the scorer: credit each trap item')]), rx), 'plan/run');
  assert.equal(laneKind(RELAY, rx), 'other', 'the relay alone names no folder');
});

test('main: --plans, --retro and --replay replace the patterns', () => {
  const f = project();
  assert.deepEqual(json(f).totals.lanesByKind, { 'plan/run': 4, retro: 1, replay: 1, other: 1 });
  assert.deepEqual(json(f, '--plans', 'explore the code', '--replay', 'nothing-matches-this').totals.lanesByKind, { 'plan/run': 1, retro: 1, replay: 0, other: 5 });
  assert.deepEqual(json(f, '--retro', 'docs/plans/').totals.lanesByKind, { 'plan/run': 0, retro: 5, replay: 1, other: 1 });
  assert.deepEqual(json(f, '--replay', 'SECRET').totals.lanesByKind, { 'plan/run': 0, retro: 0, replay: 7, other: 0 });
  rmSync(f.root, { recursive: true });
});

// --- files ------------------------------------------------------------------------------------

test('agentFiles: agent files at any depth are lanes; a journal, a meta file and a link are not', () => {
  const f = project();
  const sub = join(f.projects, MAIN, S1, 'subagents');
  symlinkSync(join(sub, `${agent('a1')}.jsonl`), join(sub, `${agent('99')}.jsonl`));
  symlinkSync(sub, join(sub, 'loop'));
  const found = agentFiles(join(f.projects, MAIN, `${S1}.jsonl`)).map((p) => p.slice(sub.length + 1));
  assert.deepEqual(found, [`${agent('a1')}.jsonl`, `${agent('c3')}.jsonl`, `${agent('d4')}.jsonl`, `workflows/wf_1/${agent('b2')}.jsonl`]);
  assert.deepEqual(agentFiles(join(f.projects, MAIN, `${S3}.jsonl`)), []);
  // The nested lane is measured like any other.
  const nested = json(f).sessions[0].lanes.find((l) => l.agent === 'b2b2b2b2');
  assert.deepEqual([nested.kind, nested.agentType, nested.messages, nested.tokens.cacheRead], ['retro', 'workflow-subagent', 2, 100004]);
  rmSync(f.root, { recursive: true });
});

test('collect: every project folder whose name holds the key; a session with no lane is not printed', () => {
  const f = project();
  const { sessions, prompts, files } = collect(f.projects, 'demo', { rx });
  assert.deepEqual(sessions.map((s) => [s.id, s.day, s.lanes.length]), [['aaaaaaaa', '2026-09-20', 4], ['bbbbbbbb', '2026-10-03', 3]]);
  assert.deepEqual(files, { projectFolders: 2, projectFoldersSkipped: 0, sessionFiles: 3, sessionFilesSkipped: 0 });
  assert.equal(prompts.length, 7);
  assert.deepEqual(prompts[0], { session: 'aaaaaaaa', agent: 'a1a1a1a1', text: P1 });
  assert.deepEqual(prompts[5], { session: 'bbbbbbbb', agent: 'a7a7a7a7', text: `${RELAY}\n\n${TASK}` }, 'the relay, a blank line, the task');
  assert.deepEqual(collect(f.projects, 'elsewhere', { rx }).sessions.map((s) => s.id), ['dddddddd']);
  assert.deepEqual(collect(f.projects, 'worktrees', { rx }).sessions.map((s) => s.id), ['bbbbbbbb']);
  assert.throws(() => collect(f.projects, 'no-such-project', { rx }), (e) => e instanceof Unusable && e.message === 'no project folder matches the key');
  assert.throws(() => collect(f.projects, '', { rx }), (e) => e instanceof Unusable && e.message === 'project key is empty');
  assert.throws(() => collect(join(f.root, 'gone'), 'demo', { rx }), (e) => e instanceof Unusable && e.message === 'projects dir not readable: ENOENT');
  rmSync(f.root, { recursive: true });
});

test('files that cannot be read are skipped and counted; bad lines and a bad meta file never stop the run', () => {
  const f = project();
  const sub = join(f.projects, MAIN, S1, 'subagents');
  chmodSync(join(sub, `${agent('c3')}.jsonl`), 0o000); // unreadable
  f.write(`projects/${MAIN}/${S1}/subagents/${agent('08')}.jsonl`, ['{not json', '{also bad']); // nothing usable
  f.write(`projects/${MAIN}/${S1}/subagents/${agent('09')}.jsonl`, []); // empty
  writeFileSync(join(sub, `${agent('a1')}.meta.json`), '{not json');
  f.write(`projects/${MAIN}/${S1}/subagents/${agent('d4')}.jsonl`, [prompt(at('2026-09-20', 8), P1), '{bad', { ...asst(at('2026-09-20', 9)), timestamp: 'never' }, asst(at('2026-09-20', 9))]);
  // A session file with a lane that cannot be measured: no usable record.
  f.write(`projects/${MAIN}/${S3}.jsonl`, ['{bad']);
  f.write(`projects/${MAIN}/${S3}/subagents/${agent('07')}.jsonl`, [prompt(at('2026-09-20', 2), P1), asst(at('2026-09-20', 3))]);
  try {
    const r = json(f);
    assert.deepEqual(r.sessions.map((s) => s.id), ['aaaaaaaa', 'bbbbbbbb']);
    assert.deepEqual(r.sessions[0].lanes.map((l) => l.agent), ['a1a1a1a1', 'b2b2b2b2', 'd4d4d4d4']);
    assert.equal(r.sessions[0].laneFilesSkipped, 3);
    assert.equal(r.sessions[0].lanes[2].recordsNotRead, 2);
    assert.deepEqual([r.totals.sessionFilesSkipped, r.totals.laneFilesSkipped, r.totals.recordsNotRead], [1, 3, 2]);
    const a1 = r.sessions[0].lanes[0];
    assert.deepEqual([a1.agentType, a1.launchModel, a1.launchedWithDefaults], ['?', '?', null], 'a meta file that is not JSON reads as absent');
    assert.match(text(f).join('\n'), /\n {2}session files skipped 1 · lane files skipped 3 · records not read 2$/);
  } finally { chmodSync(join(sub, `${agent('c3')}.jsonl`), 0o600); rmSync(f.root, { recursive: true }); }
});

test('a lane that used two models is classed by the one that wrote most of its messages', () => {
  const f = fixture();
  const D = '2026-09-20';
  const sub = `projects/${MAIN}/${S1}/subagents`;
  f.write(`projects/${MAIN}/${S1}.jsonl`, [human(at(D, 0)), asst(at(D, 1))]);
  // One message on an Opus-class model, then two on a Sonnet-class one: the first used is not the most used.
  f.write(`${sub}/${agent('a1')}.jsonl`, [prompt(at(D, 2), P1), asst(at(D, 3)), asst(at(D, 4), { model: 'claude-sonnet-5' }), asst(at(D, 5), { model: 'claude-sonnet-5' })]);
  // Messages are counted, not records: one Opus-class message on three records does not outweigh two Haiku-class messages.
  f.write(`${sub}/${agent('b2')}.jsonl`, [prompt(at(D, 2.5), P1), asst(at(D, 3), { id: 'm1' }), asst(at(D, 3.1), { id: 'm1' }), asst(at(D, 3.2), { id: 'm1' }),
    asst(at(D, 4), { model: 'claude-haiku-4-5' }), asst(at(D, 5), { model: 'claude-haiku-4-5' })]);
  const { lane } = readLane(join(f.root, sub, `${agent('a1')}.jsonl`), rx);
  assert.deepEqual([lane.resolved, lane.modelClass, lane.messages], [['claude-sonnet-5', 'claude-opus-5-5'], 'sonnet', 3]);
  const r = json(f);
  assert.deepEqual(r.sessions[0].lanes.map((l) => [l.agent, l.resolved, l.modelClass]), [['a1a1a1a1', ['claude-sonnet-5', 'claude-opus-5-5'], 'sonnet'], ['b2b2b2b2', ['claude-haiku-4-5', 'claude-opus-5-5'], 'haiku']]);
  assert.deepEqual(r.lanesByHalfMonth.rows, [{ halfMonth: '2026-09 second half', opus: 0, sonnet: 1, haiku: 1, other: 0, unknown: 0 }]);
  assert.ok(text(f)[5].includes(' · resolved claude-sonnet-5/claude-opus-5-5 · '), 'the most used model is printed first');
  rmSync(f.root, { recursive: true });
});

test('sessions are printed oldest first, whatever the order of the folders and of the files in them', () => {
  const f = fixture();
  const session = (folder, id, day, pair) => {
    f.write(`projects/${folder}/${id}.jsonl`, [human(at(day, 0)), asst(at(day, 1))]);
    f.write(`projects/${folder}/${id}/subagents/${agent(pair)}.jsonl`, [prompt(at(day, 2), P1), asst(at(day, 3))]);
  };
  // By name the first folder comes before the second, and S1 before S2. By date it is the reverse.
  assert.ok(MAIN < TREE && S1 < S2 && S3 < S4);
  session(MAIN, S1, '2026-10-05', 'a1');
  session(MAIN, S2, '2026-10-01', 'b2');
  session(TREE, S3, '2026-09-20', 'c3');
  session(TREE, S4, '2026-09-10', 'd4');
  const oldestFirst = [['dddddddd', '2026-09-10'], ['cccccccc', '2026-09-20'], ['bbbbbbbb', '2026-10-01'], ['aaaaaaaa', '2026-10-05']];
  assert.deepEqual(json(f).sessions.map((s) => [s.id, s.day]), oldestFirst);
  assert.deepEqual(text(f).filter((l) => l.startsWith('## ')).map((l) => l.slice(3, 22).split(' ')), oldestFirst);
  rmSync(f.root, { recursive: true });
});

test('a linked session file and a linked project folder are not read', () => {
  const f = project();
  const linked = join(f.projects, MAIN, `${S4}.jsonl`);
  // A link whose name holds the key, to a project folder with a session and its lane.
  symlinkSync(join(f.projects, AWAY), join(f.projects, '-home-u-demo-link'));
  // A linked session file, with a real lane beside it: read, it would be one more session.
  symlinkSync(join(f.projects, AWAY, `${S4}.jsonl`), linked);
  f.write(`projects/${MAIN}/${S4}/subagents/${agent('07')}.jsonl`, [prompt(at('2026-09-20', 2), P1), asst(at('2026-09-20', 3))]);
  const r = json(f);
  assert.deepEqual(r.sessions.map((s) => s.id), ['aaaaaaaa', 'bbbbbbbb']);
  assert.deepEqual([r.totals.projectFolders, r.totals.projectFoldersSkipped, r.totals.sessionFiles, r.totals.sessionFilesSkipped], [2, 0, 3, 0], 'a link is not read, and is not counted as skipped');
  assert.throws(() => collect(f.projects, 'demo-link', { rx }), (e) => e instanceof Unusable && e.message === 'no project folder matches the key', 'a linked folder matches no key');
  // The same session file, real: it is read. So the link alone kept it out.
  rmSync(linked);
  f.write(`projects/${MAIN}/${S4}.jsonl`, [human(at('2026-09-20', 0)), asst(at('2026-09-20', 1))]);
  assert.deepEqual(json(f).sessions.map((s) => s.id), ['aaaaaaaa', 'dddddddd', 'bbbbbbbb']);
  rmSync(f.root, { recursive: true });
});

test('a session whose only lane file cannot be read counts as a session file skipped', UNREADABLE, () => {
  const f = project();
  const lane = f.write(`projects/${MAIN}/${S3}/subagents/${agent('07')}.jsonl`, [prompt(at('2026-09-20', 2), P1), asst(at('2026-09-20', 3))]);
  assert.deepEqual(json(f).sessions.map((s) => s.id), ['aaaaaaaa', 'cccccccc', 'bbbbbbbb'], 'while its lane can be read, the session is printed');
  chmodSync(lane, 0o000);
  try {
    const r = json(f);
    assert.deepEqual(r.sessions.map((s) => s.id), ['aaaaaaaa', 'bbbbbbbb']);
    // The lane file is not counted on its own: lane files skipped are those of the sessions printed.
    assert.deepEqual([r.totals.sessionFiles, r.totals.sessionFilesSkipped, r.totals.laneFilesSkipped], [3, 1, 0]);
    assert.equal(text(f).at(-1), '  session files skipped 1');
  } finally { chmodSync(lane, 0o600); rmSync(f.root, { recursive: true }); }
});

test('a project folder that cannot be read is skipped and counted; the run stops only when none can be read', UNREADABLE, () => {
  const f = project();
  const tree = join(f.projects, TREE), checkout = join(f.projects, MAIN), lane = join(checkout, S1, 'subagents', `${agent('c3')}.jsonl`);
  chmodSync(tree, 0o000);
  try {
    const r = json(f);
    assert.deepEqual(r.sessions.map((s) => s.id), ['aaaaaaaa'], 'the folder that can be read is measured');
    assert.deepEqual([r.totals.projectFolders, r.totals.projectFoldersSkipped, r.totals.sessionFiles, r.totals.lanes], [2, 1, 2, 4]);
    assert.equal(text(f).at(-1), '  project folders skipped 1');
    const run = cli([f.projects, 'demo']);
    assert.deepEqual([run.status, run.err], [0, '']);
    assert.ok(run.out.endsWith('\n  project folders skipped 1\n'));
    // It is printed with the other skipped figures.
    chmodSync(lane, 0o000);
    assert.equal(text(f).at(-1), '  project folders skipped 1 · lane files skipped 1');
    // A key that only matches folders that can be read counts none.
    assert.deepEqual(collect(f.projects, 'elsewhere', { rx }).files, { projectFolders: 1, projectFoldersSkipped: 0, sessionFiles: 1, sessionFilesSkipped: 0 });
    // No matching folder can be read: there is nothing to measure.
    chmodSync(checkout, 0o000);
    assert.throws(() => text(f), (e) => e instanceof Unusable && e.message === 'no matching project folder is readable: EACCES');
    assert.deepEqual(cli([f.projects, 'demo']), { status: 2, out: '', err: 'no matching project folder is readable: EACCES\n' });
  } finally {
    for (const p of [tree, checkout]) chmodSync(p, 0o755);
    chmodSync(lane, 0o600);
    rmSync(f.root, { recursive: true });
  }
});

// --- end to end -------------------------------------------------------------------------------

test('text output: the table, one line per session, one line per lane, the totals', () => {
  const f = project();
  const lines = text(f);
  assert.deepEqual(lines.slice(0, 5), [
    '# plan/run lanes by half-month and model class (UTC days)',
    'half-month           opus  sonnet  haiku  other  unknown',
    '2026-09 second half     0       1      0      0        1',
    '2026-10 first half      1       0      0      1        0',
    'last day a plan/run lane ran on a Sonnet- or Haiku-class model: 2026-09-20',
  ]);
  assert.equal(lines[5], 'other models: claude-fable-5-1 1');
  assert.equal(lines[6], '## aaaaaaaa 2026-09-20 · 90m · orchestrator claude-opus-5-5 · effort high/max · messages 3 · owner turns 3 · lanes 4 · '
    + 'orchestrator tokens in 60 out 600 cache-write 6.0k cache-read 60.0k · lane tokens in 110 out 1.5k cache-write 10.1k cache-read 100.7k');
  assert.equal(lines[7], '   a1a1a1a1 2026-09-20 plan/run general-purpose · launch sonnet · requested ? · resolved claude-sonnet-5 · effort high · 12.5m · messages 2 · '
    + 'tokens in 8 out 502 cache-write 73 cache-read 704 · launched with defaults: yes');
  assert.equal(lines[8], '   b2b2b2b2 2026-09-20 retro workflow-subagent · launch ? · requested claude-opus-5-5 · resolved claude-opus-5-5 · effort medium · 2m · messages 2 · '
    + 'tokens in 101 out 1.0k cache-write 10.0k cache-read 100.0k');
  assert.equal(lines[9], '   c3c3c3c3 2026-09-20 replay ? · launch ? · requested ? · resolved claude-haiku-4-5-20251001 · effort ? · 1m · messages 1 · tokens in 1 out 2 cache-write 3 cache-read 4');
  assert.equal(lines[11], '## bbbbbbbb 2026-10-03 · 1445m · orchestrator claude-fable-5-1 · effort medium · messages 2 · owner turns 2 · lanes 3 · '
    + 'orchestrator tokens in 3 out 30 cache-write 300 cache-read 3.0k · lane tokens in 4 out 8 cache-write 12 cache-read 16');
  assert.equal(lines[12], '   e5e5e5e5 2026-10-03 plan/run general-purpose · launch ? · requested ? · resolved claude-fable-5-1 · effort ? · 2m · messages 1 · '
    + 'tokens in 1 out 2 cache-write 3 cache-read 4 · launched with defaults: no');
  assert.equal(lines[13], '   a7a7a7a7 2026-10-03 plan/run workflow-subagent · launch ? · requested ? · resolved claude-opus-5-5 · effort ? · 3m · messages 2 · tokens in 2 out 4 cache-write 6 cache-read 8');
  assert.equal(lines[14], '   f6f6f6f6 2026-10-04 other Explore · launch opus · requested ? · resolved claude-opus-5-5 · effort ? · 2m · messages 1 · tokens in 1 out 2 cache-write 3 cache-read 4');
  assert.deepEqual(lines.slice(15), [
    '# TOTAL: sessions with lanes 2 (session files 3, project folders 2) · lanes 7 (plan/run 4, retro 1, replay 1, other 1) · owner turns 5 · session minutes 1535 · lane minutes 23.5 (summed, overlap not removed)',
    '  orchestrator tokens in 63 out 630 cache-write 6.3k cache-read 63.0k',
    '  lane tokens in 114 out 1.5k cache-write 10.1k cache-read 100.7k',
  ]);
  // Large counts are shortened in text; --json holds them exactly.
  f.write(`projects/${MAIN}/${S1}.jsonl`, [human(at('2026-09-20', 0)), asst(at('2026-09-20', 1), { usage: tokens(999, 1500, 999949, 999950) })]);
  assert.match(text(f)[6], /orchestrator tokens in 999 out 1\.5k cache-write 999\.9k cache-read 1\.0M · /);
  assert.deepEqual(json(f).sessions[0].tokens, { input: 999, output: 1500, cacheWrite: 999949, cacheRead: 999950 });
  rmSync(f.root, { recursive: true });
});

test('a missing value prints as ? and is still counted', () => {
  const f = fixture();
  // An older transcript: no model, effort, usage or message id anywhere, and a meta file whose values are not plain words.
  f.write(`projects/${MAIN}/${S1}.jsonl`, [human(at('2026-09-20', 0)), asst(at('2026-09-20', 1), { id: undefined, model: undefined, usage: undefined })]);
  f.write(`projects/${MAIN}/${S1}/subagents/${agent('d4')}.jsonl`, [prompt(at('2026-09-20', 2), P1), asst(at('2026-09-20', 3), { id: undefined, model: undefined, usage: undefined })]);
  f.write(`projects/${MAIN}/${S1}/subagents/${agent('d4')}.meta.json`, { agentType: `not one word ${SECRET}`, model: { name: SECRET }, launchedWithDefaults: 'yes' });
  f.write(`projects/${MAIN}/${S1}/subagents/${agent('e5')}.jsonl`, [prompt(at('2026-09-20', 4), P1)]); // a lane that never answered
  f.write(`projects/${MAIN}/${S1}/subagents/${agent('e5')}.meta.json`, { agentType: '/home/u/private-place', model: 'home/u/private-place' }); // a path with no space is no plain word
  const lines = text(f);
  assert.equal(lines[2], '2026-09 second half     0       0      0      0        2');
  assert.equal(lines[4], '## aaaaaaaa 2026-09-20 · 1m · orchestrator ? · effort ? · messages 1 · owner turns 1 · lanes 2 · '
    + 'orchestrator tokens in 0 out 0 cache-write 0 cache-read 0 · lane tokens in 0 out 0 cache-write 0 cache-read 0');
  assert.equal(lines[5], '   d4d4d4d4 2026-09-20 plan/run ? · launch ? · requested ? · resolved ? · effort ? · 1m · messages 1 · tokens in 0 out 0 cache-write 0 cache-read 0');
  assert.equal(lines[6], '   e5e5e5e5 2026-09-20 plan/run ? · launch ? · requested ? · resolved ? · effort ? · 0m · messages 0 · tokens in 0 out 0 cache-write 0 cache-read 0');
  const r = json(f);
  assert.equal(r.totals.lanes, 2);
  assert.deepEqual(r.sessions[0].lanes.map((l) => [l.modelClass, l.resolved, l.launchedWithDefaults]), [['unknown', ['?'], null], ['unknown', [], null]]);
  rmSync(f.root, { recursive: true });
});

test('--since and --until: a lane is kept by its first day; a session is measured on its records inside the window', () => {
  const f = project();
  const ids = (...flags) => json(f, ...flags).sessions.map((s) => [s.id, s.lanes.map((l) => l.agent)]);
  assert.deepEqual(ids('--since', '2026-10-01'), [['bbbbbbbb', ['e5e5e5e5', 'a7a7a7a7', 'f6f6f6f6']]]);
  assert.deepEqual(ids('--until', '2026-09-30'), [['aaaaaaaa', ['a1a1a1a1', 'b2b2b2b2', 'c3c3c3c3', 'd4d4d4d4']]]);
  assert.deepEqual(ids('--since', '2026-09-20', '--until', '2026-10-03'), [['aaaaaaaa', ['a1a1a1a1', 'b2b2b2b2', 'c3c3c3c3', 'd4d4d4d4']], ['bbbbbbbb', ['e5e5e5e5', 'a7a7a7a7']]]);
  assert.deepEqual(ids('--since', '2026-09-21', '--until', '2026-10-02'), []);
  // Session 2 from its second day on: one lane, and only that day's records.
  const late = json(f, '--labels', '--since', '2026-10-04');
  const [s] = late.sessions;
  assert.deepEqual([s.day, s.label, s.minutes, s.ownerTurns, s.messages, s.tokens], ['2026-10-04', null, 5, 1, 1, { input: 2, output: 20, cacheWrite: 200, cacheRead: 2000 }], 'the command is outside the window: no label');
  assert.deepEqual(late.lanesByHalfMonth, { rows: [], lastSonnetOrHaikuDay: null, otherModels: {} });
  assert.deepEqual([late.totals.sessions, late.totals.lanes, late.totals.sessionFiles], [1, 1, 3]);
  // Its first day alone: the skill command is inside the window again.
  assert.deepEqual(json(f, '--labels', '--until', '2026-10-03', '--since', '2026-10-03').sessions.map((x) => [x.label, x.minutes, x.ownerTurns]), [['run t-0002', 1, 1]]);
  // Nothing in the window is not an error.
  assert.deepEqual(text(f, '--since', '2026-11-01').slice(0, 3), ['# plan/run lanes by half-month and model class (UTC days)', 'half-month  opus  sonnet  haiku  other  unknown',
    'last day a plan/run lane ran on a Sonnet- or Haiku-class model: none']);
  for (const bad of [['--since', '2026-13-01'], ['--until', '2026-9-1'], ['--since', 'yesterday']]) {
    assert.throws(() => text(f, ...bad), (e) => e instanceof Unusable && e.message === `${bad[0]} is not a date (YYYY-MM-DD)`);
  }
  assert.throws(() => text(f, '--since', '2026-10-02', '--until', '2026-10-01'), (e) => e instanceof Unusable && e.message === '--since is after --until');
  rmSync(f.root, { recursive: true });
});

test('the label: none unless --labels is given; then the first two words of the command that opened the session', () => {
  const f = project();
  assert.deepEqual(json(f).sessions.map((s) => s.label), [null, null]);
  assert.deepEqual(collect(f.projects, 'demo', { rx }).sessions.map((s) => s.label), [null, null]);
  const plain = text(f);
  assert.ok(plain[6].startsWith('## aaaaaaaa 2026-09-20 · 90m · '), plain[6]);
  assert.ok(plain[11].startsWith('## bbbbbbbb 2026-10-03 · 1445m · '), plain[11]);
  assert.ok(plain.every((l) => !l.includes('[') && !l.includes('t-000')), 'no word the owner typed is printed');
  // With --labels: two words, and nothing of what follows them.
  assert.deepEqual(json(f, '--labels').sessions.map((s) => s.label), ['plan t-0001', 'run t-0002']);
  assert.deepEqual(collect(f.projects, 'demo', { rx, labels: true }).sessions.map((s) => s.label), ['plan t-0001', 'run t-0002']);
  const labelled = text(f, '--labels');
  assert.ok(labelled[6].startsWith('## aaaaaaaa 2026-09-20 [plan t-0001] · 90m · '), labelled[6]);
  assert.ok(labelled[11].startsWith('## bbbbbbbb 2026-10-03 [run t-0002] · 1445m · '), labelled[11]);
  assert.deepEqual(labelled.map((l) => l.replace(/ \[[^\]]*\]/, '')), plain, 'the label is all that --labels adds');
  assert.ok(!labelled.join('\n').includes('SECRET'));
  // The flag that used to drop the label is gone.
  assert.throws(() => text(f, '--no-labels'), (e) => e instanceof Unusable && e.message === `usage: ${USAGE}`);
  // A session opened by plain text, by a path, or by a skill command whose first word is no plain word, has no label.
  f.write(`projects/${MAIN}/${S1}.jsonl`, [human(at('2026-09-20', 0), `/shawarma plan ${SECRET}`), skill(at('2026-09-20', 1), `"${SECRET}"`), skill(at('2026-09-20', 1.5), '/home/u/private-place'), asst(at('2026-09-20', 2))]);
  assert.equal(json(f, '--labels').sessions[0].label, null);
  assert.ok(text(f, '--labels')[6].startsWith('## aaaaaaaa 2026-09-20 · 2m · '));
  rmSync(f.root, { recursive: true });
});

test('--json: one document with the same figures', () => {
  const f = project();
  const out = main(['node', 'runmeter', f.projects, 'demo', '--json']);
  assert.equal(out.length, 1);
  const r = JSON.parse(out[0]);
  assert.deepEqual(Object.keys(r), ['lanesByHalfMonth', 'sessions', 'totals']);
  assert.deepEqual(r.lanesByHalfMonth, {
    rows: [{ halfMonth: '2026-09 second half', opus: 0, sonnet: 1, haiku: 0, other: 0, unknown: 1 }, { halfMonth: '2026-10 first half', opus: 1, sonnet: 0, haiku: 0, other: 1, unknown: 0 }],
    lastSonnetOrHaikuDay: '2026-09-20',
    otherModels: { 'claude-fable-5-1': 1 },
  });
  const { lanes, ...s1 } = r.sessions[0];
  assert.deepEqual(s1, { id: 'aaaaaaaa', day: '2026-09-20', label: null, minutes: 90, models: ['claude-opus-5-5'], modelClasses: ['opus'], effort: ['high', 'max'], ownerTurns: 3, messages: 3,
    tokens: { input: 60, output: 600, cacheWrite: 6000, cacheRead: 60000 }, laneTokens: { input: 110, output: 1506, cacheWrite: 10079, cacheRead: 100712 },
    laneFilesSkipped: 0, recordsNotRead: 0 });
  assert.deepEqual(lanes[0], { agent: 'a1a1a1a1', kind: 'plan/run', agentType: 'general-purpose', launchModel: 'sonnet', requested: [], resolved: ['claude-sonnet-5'],
    modelClass: 'sonnet', effort: ['high'], day: '2026-09-20', minutes: 12.5, messages: 2, tokens: { input: 8, output: 502, cacheWrite: 73, cacheRead: 704 },
    launchedWithDefaults: true, recordsNotRead: 0 });
  assert.deepEqual(lanes.map((l) => [l.kind, l.modelClass]), [['plan/run', 'sonnet'], ['retro', 'opus'], ['replay', 'haiku'], ['plan/run', 'unknown']]);
  assert.deepEqual(r.sessions[1].modelClasses, ['other']);
  assert.deepEqual(r.totals, { projectFolders: 2, projectFoldersSkipped: 0, sessionFiles: 3, sessionFilesSkipped: 0, sessions: 2, lanes: 7, lanesByKind: { 'plan/run': 4, retro: 1, replay: 1, other: 1 },
    ownerTurns: 5, sessionMinutes: 1535, laneMinutes: 23.5, tokens: { input: 63, output: 630, cacheWrite: 6300, cacheRead: 63000 },
    laneTokens: { input: 114, output: 1514, cacheWrite: 10091, cacheRead: 100728 }, laneFilesSkipped: 0, recordsNotRead: 0 });
  assert.deepEqual(totals([], { projectFolders: 1, sessionFiles: 0, sessionFilesSkipped: 0 }).lanesByKind, { 'plan/run': 0, retro: 0, replay: 0, other: 0 });
  rmSync(f.root, { recursive: true });
});

// --- prompts ----------------------------------------------------------------------------------

const NOT_EMPTY = '--prompts folder exists and is not an empty real folder: refused';
const IN_REPOSITORY = '--prompts folder is inside a git repository: refused';
const unusable = (message) => (e) => e instanceof Unusable && (message instanceof RegExp ? message.test(e.message) : e.message === message);
const modeOf = (path) => (statSync(path).mode & 0o777).toString(8);

const repository = (f) => {
  const repo = join(f.root, 'repo');
  mkdirSync(repo);
  execFileSync('git', ['-C', repo, 'init', '-q'], { stdio: 'pipe' });
  writeFileSync(join(repo, '.gitignore'), 'ignored/\n');
  return repo;
};
const NO_REPOSITORY = 'echo "fatal: not a git repository (or any of the parent directories): .git" >&2; exit 128';
/** A `git` that logs how it was called and the environment it was given, then answers: by default, that no repository is here. */
const fakeGit = (f, body = NO_REPOSITORY, path = process.env.PATH) => {
  const bin = join(f.root, 'git-bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'git'), `#!/bin/sh\n{ echo "CALL $*"; env; } >> "$SEEN_LOG"\n${body}\n`);
  chmodSync(join(bin, 'git'), 0o755);
  return { PATH: `${bin}:${path}`, SEEN_LOG: join(f.root, 'git.log') };
};
// A --prompts folder is accepted only outside any git repository. When the system temporary folder is inside
// one, no folder built here can be accepted, so the tests of the accepted cases are skipped.
const TMP_IN_REPOSITORY = spawnSync('git', ['-C', tmpdir(), 'rev-parse', '--git-dir'], { stdio: 'ignore' }).status === 0;
const ACCEPTED = TMP_IN_REPOSITORY ? { skip: 'the system temporary folder is inside a git repository, so no --prompts folder in it can be accepted' } : {};

test('--prompts guard: a folder inside a git repository is refused, ignored or not', () => {
  const f = fixture();
  const repo = repository(f);
  const refused = (dir) => assert.throws(() => checkPromptsDir(dir), unusable(IN_REPOSITORY), dir);
  refused(join(repo, 'prompts'));
  refused(join(repo, 'a', 'b', 'c'));
  mkdirSync(join(repo, 'exists'));
  refused(join(repo, 'exists'));
  // An ignore rule does not make a folder acceptable, before the folder exists or after.
  refused(join(repo, 'ignored'));
  refused(join(repo, 'ignored', 'deeper'));
  mkdirSync(join(repo, 'ignored'));
  refused(join(repo, 'ignored'));
  // A link from outside into the work tree is checked where it leads.
  symlinkSync(join(repo, 'exists'), join(f.root, 'link'));
  refused(join(f.root, 'link', 'deeper'));
  // git's own folder is no place for prompts either: in a work tree's `.git`, or in a repository that has no work tree.
  // (A git set to refuse such a folder fails there: the folder is then not checked, and refused all the same.)
  const own = unusable(/^--prompts folder (is inside a git repository: refused|not checked: git failed)$/);
  assert.throws(() => checkPromptsDir(join(repo, '.git', 'prompts')), own);
  execFileSync('git', ['init', '-q', '--bare', join(f.root, 'bare.git')], { stdio: 'pipe' });
  assert.throws(() => checkPromptsDir(join(f.root, 'bare.git', 'prompts')), own);
  // A `.git` file that leads nowhere: a work tree was here once. The `.git` entry alone refuses the folder.
  mkdirSync(join(f.root, 'broken'));
  writeFileSync(join(f.root, 'broken', '.git'), `gitdir: ${join(f.root, 'gone')}\n`);
  refused(join(f.root, 'broken', 'prompts'));
  for (const dir of ['prompts', 'a', 'ignored/deeper', '.git/prompts', '../bare.git/prompts', '../broken/prompts']) assert.ok(!existsSync(join(repo, dir)), 'the check creates nothing');
  rmSync(f.root, { recursive: true });
});

test('--prompts guard: a folder that exists is refused unless it is an empty real folder', () => {
  const f = fixture();
  const refused = (name) => assert.throws(() => checkPromptsDir(join(f.root, name)), unusable(NOT_EMPTY), name);
  mkdirSync(join(f.root, 'holds-a-folder', 'aaaaaaaa'), { recursive: true });
  refused('holds-a-folder');
  mkdirSync(join(f.root, 'holds-a-file'));
  writeFileSync(join(f.root, 'holds-a-file', '.hidden'), '');
  refused('holds-a-file');
  writeFileSync(join(f.root, 'file'), 'x');
  refused('file');
  mkdirSync(join(f.root, 'empty'));
  symlinkSync(join(f.root, 'empty'), join(f.root, 'link-to-empty'));
  refused('link-to-empty');
  refused('link-to-empty/');
  symlinkSync(join(f.root, 'gone'), join(f.root, 'link-to-nothing'));
  refused('link-to-nothing');
  assert.deepEqual(readdirSync(f.root, { recursive: true }).sort(), ['empty', 'file', 'holds-a-file', 'holds-a-file/.hidden', 'holds-a-folder', 'holds-a-folder/aaaaaaaa', 'link-to-empty', 'link-to-nothing'], 'the check changes nothing');
  rmSync(f.root, { recursive: true });
});

test('--prompts guard: a folder that cannot be looked at is refused', UNREADABLE, () => {
  const f = fixture();
  const locked = join(f.root, 'locked');
  mkdirSync(join(locked, 'inner'), { recursive: true });
  chmodSync(locked, 0o000);
  try {
    // The folder itself cannot be listed. Below it, nothing can be reached: not a folder that exists, not a new one.
    for (const dir of [locked, join(locked, 'inner'), join(locked, 'new')]) assert.throws(() => checkPromptsDir(dir), unusable('--prompts folder not usable: EACCES'), dir);
  } finally { chmodSync(locked, 0o755); rmSync(f.root, { recursive: true }); }
});

test('--prompts guard: a new or empty folder outside any git repository is accepted', ACCEPTED, () => {
  const f = fixture();
  mkdirSync(join(f.root, 'empty'));
  symlinkSync(join(f.root, 'empty'), join(f.root, 'link'));
  // The last one is new, below a link that leads outside any repository: only the folder itself must not be a link.
  for (const dir of [join(f.root, 'new'), join(f.root, 'new', 'deeper', 'still'), join(f.root, 'empty'), join(f.root, 'link', 'new')]) assert.doesNotThrow(() => checkPromptsDir(dir), dir);
  assert.deepEqual(readdirSync(f.root, { recursive: true }).sort(), ['empty', 'link'], 'the check creates nothing');
  rmSync(f.root, { recursive: true });
});

test('--prompts guard: a variable that moves git\'s idea of the repository does not make a folder acceptable', () => {
  const f = project();
  const repo = repository(f);
  mkdirSync(join(repo, 'sub'));
  mkdirSync(join(f.root, 'elsewhere'));
  const cases = [
    [join(repo, 'prompts'), { GIT_DIR: join(repo, '.git'), GIT_WORK_TREE: join(f.root, 'elsewhere') }], // the work tree is said to be elsewhere
    [join(repo, 'sub', 'prompts'), { GIT_CEILING_DIRECTORIES: realpathSync(repo) }], // git is told not to look above `sub`
  ];
  for (const [dir, env] of cases) {
    assert.deepEqual(cli([f.projects, 'demo', '--prompts', dir], env), { status: 2, out: '', err: `${IN_REPOSITORY}\n` }, Object.keys(env).join(' '));
    assert.ok(!existsSync(dir), 'nothing is written');
  }
  // What git is given: the caller's environment without those variables, with LC_ALL=C, asked about the nearest
  // folder that exists, links followed.
  assert.deepEqual(GIT_REPOSITORY_VARS, MOVERS);
  const env = fakeGit(f);
  const moved = Object.fromEntries(MOVERS.map((k) => [k, join(f.root, 'elsewhere')]));
  const r = cli([f.projects, 'demo', '--prompts', join(f.root, 'new', 'out')], { ...env, ...moved, LC_ALL: 'fr_FR.UTF-8', KEPT_BY_THE_CHECK: 'yes' });
  assert.equal(r.status, 0, r.err);
  // The folder is checked before anything is read and again before anything is written. Each check asks git
  // twice here: once without the caller's variables, once with them, since a variable can also name a repository.
  const calls = readFileSync(env.SEEN_LOG, 'utf8').split(/^CALL /m).filter(Boolean).map((c) => c.trim().split('\n'));
  assert.equal(calls.length, 4, 'two checks, two asks each');
  const movers = (seen) => seen.filter((line) => MOVERS.includes(line.split('=')[0])).sort();
  for (const [args] of calls) assert.equal(args, `-C ${realpathSync(f.root)} rev-parse --is-inside-work-tree`);
  for (const [, ...seen] of [calls[0], calls[2]]) {
    // None of the caller's values reaches this ask. The tool sets one of its own: git must look past a mount point.
    assert.deepEqual(movers(seen), ['GIT_DISCOVERY_ACROSS_FILESYSTEM=1']);
    for (const kept of ['LC_ALL=C', 'KEPT_BY_THE_CHECK=yes', 'GIT_CONFIG_GLOBAL=/dev/null']) assert.ok(seen.includes(kept), kept);
  }
  for (const [, ...seen] of [calls[1], calls[3]]) {
    assert.deepEqual(movers(seen), MOVERS.map((k) => `${k}=${join(f.root, 'elsewhere')}`).sort());
    assert.ok(seen.includes('LC_ALL=C'));
  }
  rmSync(f.root, { recursive: true });
});

test('--prompts guard: a repository that only the caller\'s variables name is still a repository', ACCEPTED, () => {
  const f = project();
  const bare = join(f.root, 'bare.git'), tree = join(f.root, 'tree');
  mkdirSync(tree);
  execFileSync('git', ['init', '-q', '--bare', bare], { stdio: 'pipe' });
  const dir = join(tree, 'prompts');
  assert.equal(cli([f.projects, 'demo', '--prompts', dir]).status, 0, 'without the variables the folder is outside any repository');
  rmSync(dir, { recursive: true });
  assert.deepEqual(cli([f.projects, 'demo', '--prompts', dir], { GIT_DIR: bare, GIT_WORK_TREE: tree }), { status: 2, out: '', err: `${IN_REPOSITORY}\n` });
  assert.ok(!existsSync(dir), 'nothing is written');
  rmSync(f.root, { recursive: true });
});

test('--prompts guard: a `.git` entry above the folder is a work tree, whatever git can read of it', () => {
  const f = project();
  const cases = {
    locked: (dir) => { mkdirSync(join(dir, '.git')); chmodSync(join(dir, '.git'), 0o000); }, // git cannot read it
    nowhere: (dir) => writeFileSync(join(dir, '.git'), 'gitdir: /nowhere/not a git repository (or any of the parent directories)\n'),
  };
  for (const [name, make] of Object.entries(cases)) {
    const top = join(f.root, name);
    mkdirSync(join(top, 'sub'), { recursive: true });
    make(top);
    try {
      const dir = join(top, 'sub', 'prompts');
      assert.deepEqual(cli([f.projects, 'demo', '--prompts', dir]), { status: 2, out: '', err: `${IN_REPOSITORY}\n` }, name);
      assert.ok(!existsSync(dir), 'nothing is written');
    } finally { if (name === 'locked') chmodSync(join(top, '.git'), 0o700); }
  }
  rmSync(f.root, { recursive: true });
});

test('--prompts guard: the folder is checked again just before the files are written', () => {
  const f = project();
  // A git that finds no repository at the first check and finds one at the second.
  const env = fakeGit(f, 'n=$(cat "$COUNT" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "$COUNT"\n'
    + 'if [ $n -le 1 ]; then echo "fatal: not a git repository (or any of the parent directories): .git" >&2; exit 128; fi\necho true');
  const dir = join(f.root, 'late', 'out');
  assert.deepEqual(cli([f.projects, 'demo', '--prompts', dir], { ...env, COUNT: join(f.root, 'count') }), { status: 2, out: '', err: `${IN_REPOSITORY}\n` });
  assert.ok(!existsSync(dir), 'nothing is written');
  rmSync(f.root, { recursive: true });
});

test('--prompts guard: a folder that git cannot check is refused; only git\'s word that no repository is here lets it pass', () => {
  const f = project();
  const run = (env, name = 'unchecked') => cli([f.projects, 'demo', '--prompts', join(f.root, name)], env);
  mkdirSync(join(f.root, 'empty-bin'));
  assert.deepEqual(run({ PATH: join(f.root, 'empty-bin') }), { status: 2, out: '', err: '--prompts folder not checked: git not found\n' });
  const failing = [
    `echo "fatal: detected dubious ownership in repository at ${SECRET}" >&2; exit 128`,
    `echo "fatal: not a git repository: ${SECRET}" >&2; exit 128`, // a `.git` file that leads nowhere: a work tree was here
    'exit 1',
    'kill -9 $$',
  ];
  for (const body of failing) assert.deepEqual(run(fakeGit(f, body)), { status: 2, out: '', err: '--prompts folder not checked: git failed\n' }, body);
  // Any answer means a repository: `true` in a work tree, `false` in git's own folder.
  for (const body of ['echo true', 'echo false', 'exit 0']) assert.deepEqual(run(fakeGit(f, body)), { status: 2, out: '', err: `${IN_REPOSITORY}\n` }, body);
  assert.ok(!existsSync(join(f.root, 'unchecked')));
  // git finds no repository by looking up to the root, or up to the mount point where it stops.
  const mount = 'printf "fatal: not a git repository (or any parent up to mount point /x)\\nStopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).\\n" >&2; exit 128';
  for (const [i, body] of [NO_REPOSITORY, mount].entries()) {
    const r = run(fakeGit(f, body), `passed-${i}`);
    assert.deepEqual([r.status, r.err], [0, ''], body);
    assert.ok(r.out.endsWith('\nprompts: 7 files written\n'), body);
  }
  rmSync(f.root, { recursive: true });
});

test('--prompts: a refused folder stops the run before anything is read; nothing is written and the folder is left unchanged', () => {
  const f = project();
  const repo = repository(f);
  const refusedBy = (message, dir, projects = f.projects) => assert.deepEqual(cli([projects, 'demo', '--prompts', dir]), { status: 2, out: '', err: `${message}\n` }, dir);
  refusedBy(IN_REPOSITORY, join(repo, 'prompts'));
  refusedBy(IN_REPOSITORY, join(repo, 'ignored'));
  assert.ok(!existsSync(join(repo, 'prompts')) && !existsSync(join(repo, 'ignored')));
  assert.equal(execFileSync('git', ['-C', repo, 'status', '--porcelain', '--ignored'], { encoding: 'utf8' }), '?? .gitignore\n', 'git sees no new file');
  // A folder that holds anything, were it a file from an earlier run of the meter.
  const full = join(f.root, 'full');
  mkdirSync(join(full, 'aaaaaaaa'), { recursive: true });
  writeFileSync(join(full, 'aaaaaaaa', 'a1a1a1a1.prompt.txt'), 'kept');
  refusedBy(NOT_EMPTY, full);
  assert.deepEqual(readdirSync(full, { recursive: true }).sort(), ['aaaaaaaa', 'aaaaaaaa/a1a1a1a1.prompt.txt']);
  assert.equal(readFileSync(join(full, 'aaaaaaaa', 'a1a1a1a1.prompt.txt'), 'utf8'), 'kept');
  // A link, were it to an empty folder outside any repository.
  mkdirSync(join(f.root, 'empty'));
  symlinkSync(join(f.root, 'empty'), join(f.root, 'link'));
  refusedBy(NOT_EMPTY, join(f.root, 'link'));
  assert.deepEqual(readdirSync(join(f.root, 'empty')), []);
  // The folder is checked first: with no projects folder to read, the refusal is still the folder's.
  refusedBy(NOT_EMPTY, full, join(f.root, 'no-projects'));
  refusedBy(IN_REPOSITORY, join(repo, 'ignored'), join(f.root, 'no-projects'));
  rmSync(f.root, { recursive: true });
});

test('--prompts: each lane\'s prompt is written as sent, into a new or empty folder outside any git repository', ACCEPTED, () => {
  const f = project();
  const out = join(f.root, 'outside', 'prompts');
  const mask = process.umask(0); // the meter inherits it: with no mask, the modes below are the ones the meter asked for
  let yes;
  try { yes = cli([f.projects, 'demo', '--prompts', out]); } finally { process.umask(mask); }
  assert.deepEqual([yes.status, yes.err], [0, '']);
  assert.ok(yes.out.endsWith('\nprompts: 7 files written\n'));
  assert.ok(!yes.out.includes(SECRET));
  assert.deepEqual(readdirSync(out, { recursive: true }).sort(), ['aaaaaaaa', 'aaaaaaaa/a1a1a1a1.prompt.txt', 'aaaaaaaa/b2b2b2b2.prompt.txt', 'aaaaaaaa/c3c3c3c3.prompt.txt',
    'aaaaaaaa/d4d4d4d4.prompt.txt', 'bbbbbbbb', 'bbbbbbbb/a7a7a7a7.prompt.txt', 'bbbbbbbb/e5e5e5e5.prompt.txt', 'bbbbbbbb/f6f6f6f6.prompt.txt']);
  assert.equal(readFileSync(join(out, 'aaaaaaaa', 'a1a1a1a1.prompt.txt'), 'utf8'), P1);
  assert.equal(readFileSync(join(out, 'bbbbbbbb', 'a7a7a7a7.prompt.txt'), 'utf8'), `${RELAY}\n\n${TASK}`, 'the relay and the task, not the relay alone');
  assert.equal(readFileSync(join(out, 'bbbbbbbb', 'f6f6f6f6.prompt.txt'), 'utf8'), `${SECRET} explore the code`);
  // Prompt files are private: every folder the meter makes is 0700, and every file 0600.
  assert.deepEqual([join(f.root, 'outside'), out, join(out, 'aaaaaaaa'), join(out, 'bbbbbbbb')].map(modeOf), ['700', '700', '700', '700']);
  assert.deepEqual(readdirSync(out, { recursive: true }).filter((p) => p.endsWith('.txt')).map((p) => modeOf(join(out, p))), Array(7).fill('600'));
  // A second run into the same folder is refused: the folder is no longer empty. Its files stay as they were.
  assert.deepEqual(cli([f.projects, 'demo', '--prompts', out]), { status: 2, out: '', err: `${NOT_EMPTY}\n` });
  assert.equal(readdirSync(out, { recursive: true }).length, 9);
  // An empty folder that exists is used; with a window, only the kept lanes are written.
  const empty = join(f.root, 'empty');
  mkdirSync(empty, { mode: 0o755 });
  assert.equal(JSON.parse(cli([f.projects, 'demo', '--json', '--since', '2026-10-04', '--prompts', empty]).out).promptFilesWritten, 1);
  assert.deepEqual(readdirSync(empty, { recursive: true }).sort(), ['bbbbbbbb', 'bbbbbbbb/f6f6f6f6.prompt.txt']);
  assert.deepEqual([empty, join(empty, 'bbbbbbbb'), join(empty, 'bbbbbbbb', 'f6f6f6f6.prompt.txt')].map(modeOf), [(0o755 & ~mask).toString(8), '700', '600'], 'a folder the owner made keeps its mode');
  // With no lane in the window nothing is written, and the folder is not made.
  assert.ok(cli([f.projects, 'demo', '--since', '2026-11-01', '--prompts', join(f.root, 'none')]).out.endsWith('\nprompts: 0 files written\n'));
  assert.ok(!existsSync(join(f.root, 'none')));
  // A prompt held in text blocks is written block by block.
  f.write(`projects/${TREE}/${S2}/subagents/${agent('f6')}.jsonl`, [prompt(at('2026-10-04', 1), [{ type: 'text', text: 'one' }, { type: 'image' }, { type: 'text', text: 'two' }]), asst(at('2026-10-04', 3))]);
  cli([f.projects, 'demo', '--since', '2026-10-04', '--prompts', join(f.root, 'blocks')]);
  assert.equal(readFileSync(join(f.root, 'blocks', 'bbbbbbbb', 'f6f6f6f6.prompt.txt'), 'utf8'), 'one\ntwo');
  // A folder that cannot be made: the files cannot be written, so the meter exits 2 and prints no report.
  writeFileSync(join(f.root, 'file'), 'x');
  assert.deepEqual(cli([f.projects, 'demo', '--prompts', join(f.root, 'file', 'below')]), { status: 2, out: '', err: '--prompts folder not writable: ENOTDIR\n' });
  rmSync(f.root, { recursive: true });
});

test('writePrompts: folders are made with mode 0700 and files with mode 0600; two lanes that share a name both keep their prompt', () => {
  const f = fixture();
  const out = join(f.root, 'new', 'out');
  const same = { session: 'aaaaaaaa', agent: 'a1a1a1a1' };
  const mask = process.umask(0); // with no mask, the modes below are the ones the meter asked for
  try {
    assert.equal(writePrompts(out, [{ ...same, text: 'first' }, { ...same, text: 'second' }, { ...same, text: 'third' }, { session: 'bbbbbbbb', agent: 'a1a1a1a1', text: 'other' }]), 4);
  } finally { process.umask(mask); }
  const files = ['aaaaaaaa/a1a1a1a1.prompt.txt', 'aaaaaaaa/a1a1a1a1-2.prompt.txt', 'aaaaaaaa/a1a1a1a1-3.prompt.txt', 'bbbbbbbb/a1a1a1a1.prompt.txt'];
  assert.deepEqual(files.map((rel) => readFileSync(join(out, rel), 'utf8')), ['first', 'second', 'third', 'other']);
  assert.deepEqual([join(f.root, 'new'), out, join(out, 'aaaaaaaa'), join(out, 'bbbbbbbb')].map(modeOf), ['700', '700', '700', '700'], 'every folder the meter makes');
  assert.deepEqual(files.map((rel) => modeOf(join(out, rel))), ['600', '600', '600', '600']);
  // A file is only ever created. One that appeared after the folder was checked is not written over, so no prompt lands in a file with another mode.
  chmodSync(join(out, files[0]), 0o644);
  assert.throws(() => writePrompts(out, [{ ...same, text: 'again' }]), unusable('--prompts folder not writable: EEXIST'));
  assert.deepEqual([readFileSync(join(out, files[0]), 'utf8'), modeOf(join(out, files[0]))], ['first', '644']);
  rmSync(f.root, { recursive: true });
});

test('without --prompts the meter writes nothing', () => {
  const f = project();
  const before = JSON.stringify(readdirSync(f.root, { recursive: true }).sort());
  text(f); json(f, '--since', '2026-10-01');
  assert.equal(JSON.stringify(readdirSync(f.root, { recursive: true }).sort()), before);
  rmSync(f.root, { recursive: true });
});

// --- pull requests ----------------------------------------------------------------------------

const pr = (number, opened, mins, o = {}) => ({ number, createdAt: opened, mergedAt: new Date(Date.parse(opened) + mins * 60000).toISOString(),
  reviews: o.reviews ?? [], comments: o.comments ?? [], statusCheckRollup: o.checks ?? [], title: SECRET });
const PRS = [
  pr(5, '2026-10-03T23:30:00Z', 100),
  pr(1, '2026-09-10T10:00:00Z', 5),
  pr(2, '2026-09-20T10:00:00Z', 9, { reviews: [{ body: SECRET }] }),
  pr(3, '2026-09-21T10:00:00Z', 10.26, { comments: [{}, {}] }),
  pr(4, '2026-10-02T10:00:00Z', 30, { checks: [{}] }),
];
/** A `gh` that logs where and how it was called, then prints the file `$GH_JSON`. */
const fakeGh = (f, body = 'printf \'%s\\n\' "$PWD" "$*" > "$GH_LOG"; cat "$GH_JSON"') => {
  const bin = join(f.root, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\n${body}\n`);
  chmodSync(join(bin, 'gh'), 0o755);
  writeFileSync(join(f.root, 'prs.json'), JSON.stringify(PRS));
  return { PATH: `${bin}:${process.env.PATH}`, GH_JSON: join(f.root, 'prs.json'), GH_LOG: join(f.root, 'gh.log') };
};

test('median: the middle value, or the mean of the two middle values', () => {
  assert.equal(median([]), null);
  assert.equal(median([7]), 7);
  assert.equal(median([30, 9, 10]), 10);
  assert.equal(median([100, 9, 30, 10]), 20);
});

test('prStats: minutes from open to merge, counts, the median, and the window by the day it was opened', () => {
  const all = prStats(PRS, null, null);
  assert.deepEqual(all.rows, [
    { number: 1, minutes: 5, reviews: 0, comments: 0, checks: 0 },
    { number: 2, minutes: 9, reviews: 1, comments: 0, checks: 0 },
    { number: 3, minutes: 10.3, reviews: 0, comments: 2, checks: 0 },
    { number: 4, minutes: 30, reviews: 0, comments: 0, checks: 1 },
    { number: 5, minutes: 100, reviews: 0, comments: 0, checks: 0 },
  ]);
  const { rows, ...summary } = all;
  assert.deepEqual(summary, { merged: 5, medianMinutes: 10.3, withReview: 1, withComment: 1, withCheck: 1, limitReached: false });
  assert.deepEqual([prStats(PRS, '2026-09-17', null).merged, prStats(PRS, '2026-09-17', null).medianMinutes], [4, 20.1]);
  assert.deepEqual(prStats(PRS, '2026-09-17', '2026-10-02').rows.map((r) => r.number), [2, 3, 4]);
  assert.deepEqual(prStats(PRS, '2026-10-03', '2026-10-03').rows.map((r) => r.number), [5], 'by the UTC day it was opened');
  // A pull request with no real dates is left out; a field that is not a list counts as none.
  const odd = [{ number: 9, createdAt: '2026-10-01T00:00:00Z' }, { number: 8, createdAt: '2026-10-01T00:00:00Z', mergedAt: '2026-10-01T00:02:00Z', reviews: null, comments: 'x' }];
  assert.deepEqual(prStats(odd, null, null), { rows: [{ number: 8, minutes: 2, reviews: 0, comments: 0, checks: 0 }], merged: 1, medianMinutes: 2, withReview: 0, withComment: 0, withCheck: 0, limitReached: false });
  assert.deepEqual(prStats([], null, null), { rows: [], merged: 0, medianMinutes: null, withReview: 0, withComment: 0, withCheck: 0, limitReached: false });
  assert.equal(prStats(Array.from({ length: 1000 }, (_, i) => pr(i + 1, '2026-10-01T00:00:00Z', 1)), null, null).limitReached, true);
});

test('--prs: gh runs in the repository folder with the documented command; its figures follow the report', () => {
  const f = project();
  const env = fakeGh(f);
  const repo = join(f.root, 'repo');
  mkdirSync(repo);
  const r = cli([f.projects, 'demo', '--prs', repo, '--since', '2026-09-17'], env);
  assert.equal(r.status, 0, r.err);
  assert.deepEqual(readFileSync(env.GH_LOG, 'utf8').trim().split('\n'), [realpathSync(repo), GH_ARGS.join(' ')]);
  assert.deepEqual(r.out.trim().split('\n').slice(-5), [
    '   #2 · open to merge 9m · reviews 1 · comments 0 · checks 0',
    '   #3 · open to merge 10.3m · reviews 0 · comments 2 · checks 0',
    '   #4 · open to merge 30m · reviews 0 · comments 0 · checks 1',
    '   #5 · open to merge 100m · reviews 0 · comments 0 · checks 0',
    'prs: 4 merged · median open to merge 20.1m · with any review 1 · with any comment 1 · with any check 1',
  ]);
  assert.ok(!r.out.includes(SECRET));
  const data = JSON.parse(cli([f.projects, 'demo', '--prs', repo, '--json'], env).out);
  assert.deepEqual([data.prs.merged, data.prs.medianMinutes, data.prs.rows.length], [5, 10.3, 5]);
  assert.deepEqual(prs(repo, null, '2026-09-30', { ...process.env, ...env }).rows.map((x) => x.number), [1, 2, 3]);
  rmSync(f.root, { recursive: true });
});

test('--prs: gh missing or failing reads NOT RUN, and the rest of the report stands', () => {
  const f = project();
  const repo = join(f.root, 'repo');
  mkdirSync(repo);
  const empty = join(f.root, 'empty-bin');
  mkdirSync(empty);
  const missing = cli([f.projects, 'demo', '--prs', repo], { PATH: empty });
  assert.equal(missing.status, 0, missing.err);
  assert.ok(missing.out.endsWith('\nprs: NOT RUN (gh not found)\n'));
  assert.match(missing.out, /\n## aaaaaaaa 2026-09-20 /);
  assert.deepEqual(JSON.parse(cli([f.projects, 'demo', '--prs', repo, '--json'], { PATH: empty }).out).prs, { notRun: 'gh not found' });
  const cases = [
    [`echo "${SECRET} could not reach ${repo}" >&2; exit 3`, 'gh exited 3'],
    [`echo "${SECRET} is not JSON"`, 'gh output is not JSON'],
    ['echo "{}"', 'gh output is not a list'],
    ['kill -9 $$', 'gh failed: killed'],
  ];
  for (const [body, reason] of cases) {
    const r = cli([f.projects, 'demo', '--prs', repo], fakeGh(f, body));
    assert.deepEqual([r.status, r.err], [0, ''], reason);
    assert.ok(r.out.endsWith(`\nprs: NOT RUN (${reason})\n`), reason);
    assert.ok(!r.out.includes(SECRET) && !r.out.includes(repo), reason);
  }
  // A gh that cannot be started reads as its error code.
  writeFileSync(join(empty, 'gh'), '#!/bin/sh\n');
  assert.ok(cli([f.projects, 'demo', '--prs', repo], { PATH: empty }).out.endsWith('\nprs: NOT RUN (gh failed: EACCES)\n'));
  assert.deepEqual(cli([f.projects, 'demo', '--prs', join(f.root, 'gone')], fakeGh(f)), { status: 2, out: '', err: '--prs folder not found\n' });
  rmSync(f.root, { recursive: true });
});

test('the order: the folder is checked, the transcripts are read, gh is asked, the prompt files are written, then everything is printed', () => {
  const f = project();
  const gh = fakeGh(f);
  const env = { ...gh, ...fakeGit(f, NO_REPOSITORY, gh.PATH) }; // the --prompts folder passes the check wherever this test runs
  const repo = join(f.root, 'repo');
  mkdirSync(repo);
  // Prompt files that cannot be written: exit 2 and no report, though gh was asked.
  writeFileSync(join(f.root, 'file'), 'x');
  assert.deepEqual(cli([f.projects, 'demo', '--prs', repo, '--prompts', join(f.root, 'file', 'below')], env), { status: 2, out: '', err: '--prompts folder not writable: ENOTDIR\n' });
  assert.ok(existsSync(env.GH_LOG), 'gh was asked before the prompt files were written');
  // A refused folder: the run stops before any transcript is read and before gh is asked.
  rmSync(env.GH_LOG);
  assert.deepEqual(cli([join(f.root, 'no-projects'), 'demo', '--prs', repo, '--prompts', f.projects], env), { status: 2, out: '', err: `${NOT_EMPTY}\n` });
  assert.ok(!existsSync(env.GH_LOG));
  // All is well: the report, then the pull requests, then the number of prompt files.
  const lines = cli([f.projects, 'demo', '--prs', repo, '--prompts', join(f.root, 'out')], env).out.trim().split('\n');
  assert.deepEqual([lines[0], lines.at(-2).slice(0, 14), lines.at(-1)], ['# plan/run lanes by half-month and model class (UTC days)', 'prs: 5 merged ', 'prompts: 7 files written']);
  assert.ok(lines.indexOf('  lane tokens in 114 out 1.5k cache-write 10.1k cache-read 100.7k') < lines.indexOf('   #1 · open to merge 5m · reviews 0 · comments 0 · checks 0'));
  rmSync(f.root, { recursive: true });
});

// --- the command line -------------------------------------------------------------------------

test('exit codes: 0 with the report; 2 with one line that names no path for unusable input', () => {
  const f = project();
  const repo = repository(f);
  const ok = cli([f.projects, 'demo']);
  assert.deepEqual([ok.status, ok.err], [0, '']);
  assert.equal(ok.out.split('\n')[0], '# plan/run lanes by half-month and model class (UTC days)');
  const cases = [
    [[join(f.root, 'gone'), 'demo'], 'projects dir not readable: ENOENT'],
    [[join(f.projects, MAIN, `${S1}.jsonl`), 'demo'], 'projects dir not readable: ENOTDIR'],
    [[f.projects, 'no-such-project'], 'no project folder matches the key'],
    [[f.projects, ''], 'project key is empty'],
    [[f.projects, 'demo', '--since', '2026-02-30'], '--since is not a date (YYYY-MM-DD)'],
    [[f.projects, 'demo', '--until', 'soon'], '--until is not a date (YYYY-MM-DD)'],
    [[f.projects, 'demo', '--prompts', join(repo, 'prompts')], IN_REPOSITORY],
    [[f.projects, 'demo', '--prompts', f.projects], NOT_EMPTY],
    [[f.projects, 'demo', '--plans', '('], '--plans is not a valid regex'],
    [[f.projects, 'demo', '--retro'], '--retro needs a value'],
    [[f.projects], `usage: ${USAGE}`],
    [[f.projects, 'demo', 'extra'], `usage: ${USAGE}`],
    [[f.projects, 'demo', '--unknown'], `usage: ${USAGE}`],
    [[], `usage: ${USAGE}`],
  ];
  for (const [args, message] of cases) {
    const r = cli(args);
    assert.deepEqual(r, { status: 2, out: '', err: `${message}\n` }, message);
    assert.ok(!r.err.includes(f.root), message);
  }
  rmSync(f.root, { recursive: true });
});

test('parseArgs: every flag in the usage line is accepted, in any position', () => {
  const flags = [...USAGE.matchAll(/--([a-z-]+)/g)].map((m) => m[1]);
  assert.deepEqual(flags, ['since', 'until', 'json', 'labels', 'prs', 'prompts', 'plans', 'retro', 'replay']);
  for (const flag of flags) {
    const value = flag === 'json' || flag === 'labels' ? [] : [flag === 'since' || flag === 'until' ? '2026-09-17' : 'x'];
    assert.deepEqual(parseArgs([`--${flag}`, ...value, 'dir', 'key']).pos, ['dir', 'key'], flag);
    assert.deepEqual(parseArgs(['dir', 'key', `--${flag}`, ...value]).pos, ['dir', 'key'], flag);
  }
  const o = parseArgs(['dir', '--json', 'key', '--labels', '--since', '2026-09-17', '--until', '2026-09-30', '--prs', 'r', '--prompts', 'p', '--plans', 'a', '--retro', 'b', '--replay', 'c']);
  assert.deepEqual(o, { pos: ['dir', 'key'], json: true, labels: true, since: '2026-09-17', until: '2026-09-30', prs: 'r', prompts: 'p', rx: { replay: 'c', retro: 'b', plans: 'a' } });
  assert.deepEqual(parseArgs(['dir', 'key']), { pos: ['dir', 'key'], json: false, labels: false, since: null, until: null, prs: null, prompts: null, rx: DEFAULTS }, 'nothing is opted into');
  assert.throws(() => parseArgs(['dir', 'key', '--no-labels']), (e) => e instanceof Unusable && e.message === `usage: ${USAGE}`);
});

// --- privacy ----------------------------------------------------------------------------------

test('no line of output holds message text, a prompt, a full id or a path', () => {
  const f = project();
  const repo = repository(f);
  const env = fakeGh(f);
  const noRepository = { ...env, ...fakeGit(f, NO_REPOSITORY, env.PATH) }; // the --prompts folder passes the check wherever this test runs
  const outs = [
    cli([f.projects, 'demo'], env),
    cli([f.projects, 'demo', '--json'], env),
    cli([f.projects, 'demo', '--labels', '--since', '2026-09-20', '--until', '2026-10-04'], env),
    cli([f.projects, 'demo', '--labels', '--json'], env),
    cli([f.projects, 'demo', '--prs', repo], env),
    cli([f.projects, 'demo', '--prs', repo, '--json'], env),
    cli([f.projects, 'demo', '--prompts', join(f.root, 'out')], noRepository),
    cli([f.projects, 'demo', '--prompts', join(f.root, 'out-json'), '--json'], noRepository),
    cli([f.projects, 'demo', '--prompts', join(repo, 'ignored')], env),
    cli([f.projects, 'demo', '--prompts', f.projects], env),
    cli([f.projects, 'elsewhere', '--prs', join(f.root, 'gone')], env),
    cli([join(f.projects, 'gone'), 'demo'], env),
  ];
  assert.deepEqual(outs.map((o) => o.status), [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2]);
  // Without --labels, no word the owner typed is printed either.
  for (const o of [outs[0], outs[4]]) assert.ok(!/t-000|\[/.test(o.out), 'no label by default');
  assert.deepEqual(JSON.parse(outs[1].out).sessions.map((s) => s.label), [null, null]);
  assert.ok(outs[2].out.includes(' [plan t-0001] ') && outs[2].out.includes(' [run t-0002] '), 'with --labels: two words, and SECRET, the fourth, is not among them');
  const leaks = [SECRET, 'SECRET', 'brief.md', 'explore the code', 'scorer', 'the owner asked', 'Implement step', S1, S2, agent('a1'), 'a1a1a1a1a', f.root, repo, MAIN, 'worktrees', '.jsonl', '.prompt.txt'];
  for (const o of outs) {
    for (const line of `${o.out}\n${o.err}`.split('\n')) {
      for (const leak of leaks) assert.ok(!line.includes(leak), `a line holds ${leak}: ${line.slice(0, 60)}`);
    }
  }
  // The prompt text is in the prompt files, and nowhere else.
  for (const out of ['out', 'out-json']) assert.equal(readFileSync(join(f.root, out, 'aaaaaaaa', 'c3c3c3c3.prompt.txt'), 'utf8'), `You are the scorer: credit each trap item. ${SECRET} Score docs/plans/t-0001/brief.md`);
  rmSync(f.root, { recursive: true });
});

test('readLane: the prompt is kept apart from the figures', () => {
  const f = project();
  const r = readLane(join(f.projects, MAIN, S1, 'subagents', `${agent('a1')}.jsonl`), rx);
  assert.equal(r.prompt, P1);
  assert.ok(!JSON.stringify(r.lane).includes('SECRET'));
  // A lane started by a workflow tool: the kind and the prompt both come from the relay and the task.
  const w = readLane(join(f.projects, TREE, S2, 'subagents', 'workflows', 'wf_2', `${agent('a7')}.jsonl`), rx);
  assert.deepEqual([w.lane.kind, w.prompt], ['plan/run', `${RELAY}\n\n${TASK}`]);
  assert.ok(!JSON.stringify(w.lane).includes('SECRET'));
  assert.ok(!JSON.stringify(collect(f.projects, 'demo', { rx }).sessions).includes('SECRET'));
  assert.ok(!render({ lanesByHalfMonth: laneTable([]), sessions: collect(f.projects, 'demo', { rx }).sessions, totals: totals([], {}) }).join('\n').includes('SECRET'));
  rmSync(f.root, { recursive: true });
});

// --- the reference ----------------------------------------------------------------------------

const SRC = readFileSync(SCRIPT, 'utf8');
const DOC = readFileSync(new URL('../runmeter.md', import.meta.url), 'utf8');

test('doc: the usage line is the same in the header, the code and scripts/runmeter.md', () => {
  const header = SRC.slice(0, SRC.indexOf('*/'));
  assert.ok(header.includes(`\n *   ${USAGE}\n`), 'the header comment');
  assert.ok(DOC.includes(`\`\`\`sh\n${USAGE}\n\`\`\``), 'the reference');
  assert.ok(header.includes('Full reference') && header.includes('scripts/runmeter.md'));
  // The header says what is printed: no promise that no message text is, since --labels prints two words of it.
  assert.ok(!/never message text/.test(header) && /with --labels also the first two words of the command that opened each session/.test(header.replace(/\n \* +/g, ' ')), 'the header comment says what is printed');
  assert.ok(!SRC.includes('no-labels') && !DOC.includes('no-labels'), 'the flag is gone');
  assert.throws(() => main(['node', 'runmeter']), (e) => e instanceof Unusable && e.message === `usage: ${USAGE}`);
});

test('doc: the reference says what a lane\'s prompt is, wherever it names it', () => {
  assert.ok(!/first prompt/i.test(DOC), 'the prompt is not the first user record');
  assert.ok(!/first prompt/i.test(SRC));
  assert.ok(DOC.includes('the lane\'s prompt: its user records before its first answer'));
});

test('doc: the prompt files section says the folder rule the code applies', () => {
  const section = DOC.slice(DOC.indexOf('\n## Prompt files\n'), DOC.indexOf('\n## Privacy rules\n'));
  for (const k of GIT_REPOSITORY_VARS) assert.ok(section.includes(`\`${k}\``), k);
  for (const said of ['new or empty', 'outside any git repository', 'twice: before it reads anything, and again just before it writes', 'private text', '`0700`', '`0600`']) assert.ok(section.includes(said), said);
  assert.ok(!DOC.includes('check-ignore'), 'an ignore rule no longer makes a folder acceptable');
  // Every refusal the code can print for the folder is one line that the reference explains.
  const said = [...new Set([...SRC.matchAll(/(?:Unusable\(|IN_REPOSITORY = )['`](--prompts folder [^'`$:]+)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(said, ['--prompts folder exists and is not an empty real folder', '--prompts folder is inside a git repository', '--prompts folder not checked',
    '--prompts folder not usable', '--prompts folder not writable']);
  for (const tail of ['git not found', 'git failed', 'a folder above it cannot be looked at']) assert.ok(section.includes(`\`--prompts folder not checked: ${tail}\``), tail);
  for (const message of said) assert.ok(section.includes(`\`${message}`), message);
});

test('doc: the privacy rules say what the word filter does', () => {
  const rules = DOC.slice(DOC.indexOf('\n## Privacy rules\n'), DOC.indexOf('\n## Limits\n')).split('\n');
  const rule = rules.find((line) => line.startsWith('2. '));
  // The rule's own examples print, or do not, as it says.
  for (const [example, prints] of [['vendor/model', true], ['/home/u/x', false], ['a/b/c', false]]) {
    assert.ok(rule.includes(`\`${example}\``), example);
    assert.equal(word(example) === example, prints, example);
  }
  assert.ok(rule.includes('60 characters') && rule.includes('one `/`'), rule);
  assert.ok(!rule.includes('`_ . : @ / [ ] -`'), 'a slash is no longer allowed anywhere');
});

test('doc: the reference lists every reason the code can give for gh NOT RUN', () => {
  const section = DOC.slice(DOC.indexOf('\n## Pull requests\n'), DOC.indexOf('\n## Prompt files\n'));
  // Every `gh …` reason in the source, with what it interpolates left out.
  const inCode = [...SRC.matchAll(/['`](gh (?:not found|exited|failed|output)[^'`$]*)/g)].map((m) => m[1].trim());
  assert.deepEqual(inCode, ['gh not found', 'gh exited', 'gh failed:', 'gh output is not JSON', 'gh output is not a list']);
  for (const reason of ['gh not found', 'gh exited <code>', 'gh failed: killed', 'gh failed: <error code>', 'gh output is not JSON', 'gh output is not a list']) assert.ok(section.includes(`\`${reason}\``), reason);
  assert.ok(!section.includes('unreadable'), 'a gh that a signal ended reads as killed');
});

test('doc: the reference measures sessions, and says where a session is not a run', () => {
  assert.ok(!DOC.includes('A run is one Claude Code session'));
  const intro = DOC.slice(0, DOC.indexOf('\n## What each figure is for\n'));
  for (const said of ['A session that started at least one lane is printed', 'may hold more than one run']) assert.ok(intro.includes(said), said);
  assert.ok(DOC.includes('- **A session is a file, not a run.** A session that holds several commands, or is resumed over several days, is one line.'));
  assert.ok(DOC.includes('Splitting a session at each command is ticket `skills-cb5t`.'));
  // The key is a substring: the reference says to check the count of folders it matched.
  const key = DOC.split('\n').find((line) => line.startsWith('| `<project key>` |'));
  assert.ok(key.includes('sibling') && key.includes('`project folders`'), key);
  // Model class `unknown`, and a rejected tool call.
  const unknown = DOC.split('\n').find((line) => line.startsWith('| Model class |'));
  assert.ok(/`unknown` when .*no model id.*not one plain word/.test(unknown), unknown);
  const turns = DOC.slice(DOC.indexOf('\n## Owner turns\n'), DOC.indexOf('\n## Minutes\n'));
  assert.ok(/rejects/.test(turns) && /typed reason/.test(turns), 'a rejected tool call is not a turn');
});

test('doc: the default patterns, the gh command, the kinds and the classes are the code\'s', () => {
  assert.deepEqual(Object.keys(DEFAULTS), ['replay', 'retro', 'plans']);
  for (const [k, v] of Object.entries(DEFAULTS)) assert.ok(DOC.includes(`\n--${k}  ${v}\n`), `--${k}`);
  assert.ok(DOC.includes(`\ngh ${GH_ARGS.join(' ')}\n`), 'the gh command');
  for (const name of [...KINDS, ...CLASSES]) assert.ok(DOC.includes(`\`${name}\``), name);
  // The patterns in the reference sort the fixture's prompts as the code does.
  const documented = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, new RegExp(DOC.match(new RegExp(`\\n--${k}  (.+)\\n`))[1], 'i')]));
  for (const p of ['Replay the plan in a scratch folder', 'Read docs/retros/1.md', 'Write docs/plans/t-0001/brief.md', 'Explore']) assert.equal(laneKind(p, documented), laneKind(p, rx), p);
});

test('doc: the example in scripts/runmeter.md is what the meter prints for this file\'s fixture', () => {
  const f = project();
  const example = text(f).join('\n');
  rmSync(f.root, { recursive: true });
  assert.ok(DOC.includes(`\`\`\`\n${example}\n\`\`\``), `the reference should hold:\n${example}`);
});

test('doc: scripts/runmeter.md names every --json key', () => {
  const f = project();
  const repo = repository(f);
  const env = fakeGh(f);
  const noRepository = { ...env, ...fakeGit(f, NO_REPOSITORY, env.PATH) }; // the --prompts folder passes the check wherever this test runs
  const full = JSON.parse(cli([f.projects, 'demo', '--json', '--prs', repo, '--prompts', join(f.root, 'out')], noRepository).out);
  const failed = JSON.parse(cli([f.projects, 'demo', '--json', '--prs', repo], { PATH: join(f.root, 'nowhere') }).out);
  rmSync(f.root, { recursive: true });
  const keys = new Set();
  const walk = (v, under) => {
    if (Array.isArray(v)) for (const x of v) walk(x, under);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (under !== 'otherModels') keys.add(k); walk(x, k); }
  };
  walk(full); walk(failed);
  for (const k of ['lanesByHalfMonth', 'promptFilesWritten', 'notRun', 'limitReached', 'launchModel', 'cacheRead', 'laneFilesSkipped', 'projectFoldersSkipped', 'plan/run']) assert.ok(keys.has(k), `the fixture shows ${k}`);
  assert.ok(keys.size >= 55, `found ${keys.size} keys`);
  assert.deepEqual([...keys].filter((k) => !DOC.includes(`\`${k}\``)), []);
});
