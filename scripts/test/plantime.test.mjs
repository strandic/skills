/**
 * Tests for scripts/plantime.mjs, the plan wall-clock meter (skills-s262).
 *
 * The meter charges each gap between two transcript records to the record that ends it. Records
 * that only accompany a wake-up (isMeta, system reminders, a compaction) pass their gap on to the
 * next record when that record wakes the session. It prints durations and counts, never content.
 *
 * All transcripts here are synthetic.
 *
 * `node --test scripts/test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, symlinkSync, chmodSync, copyFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULTS, classify, split, planStarts, parsePlans, sessionFile, records, measure, main, isIso, isProbe, bashKind, waitStats,
} from '../plantime.mjs';

const rx = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const T = (min) => new Date(Date.UTC(2026, 9, 1, 8, 0, 0) + min * 60000).toISOString();
const M = 60000;

// Record builders. `at` is minutes after 08:00Z.
let uid = 0;
const asst = (at, ...blocks) => ({ type: 'assistant', timestamp: T(at), message: { content: blocks.length ? blocks : [{ type: 'text', text: 'SECRET-TEXT' }] } });
const use = (name, input = {}) => ({ type: 'tool_use', id: `tu${++uid}`, name, input });
const result = (at, u, extra = {}) => ({ type: 'user', timestamp: T(at), message: { content: [{ type: 'tool_result', tool_use_id: u.id, content: 'SECRET-TEXT' }] }, ...extra });
const user = (at, content, extra = {}) => ({ type: 'user', timestamp: T(at), message: { content }, ...extra });
const human = (at, text = 'SECRET-TEXT') => user(at, text, { origin: { kind: 'human' }, promptSource: 'typed' });
const meta = (at) => user(at, '<system-reminder>SECRET-TEXT</system-reminder>', { isMeta: true });
const compact = (at) => user(at, 'SECRET-TEXT summary', { isCompactSummary: true });
const ms = (b) => Object.fromEntries([...b.entries()].map(([k, v]) => [k, v / M]));

// --- classify -------------------------------------------------------------------------------

test('classify: a tool result takes the kind of its call', () => {
  const cases = [
    [use('Bash', { command: 'uv run pytest -q' }), 'exec:suite'],
    [use('Bash', { command: 'node --test scripts/test/*.test.mjs' }), 'exec:suite'],
    [use('Bash', { command: 'python3 probe.py x' }), 'exec:probe'],
    [use('Bash', { command: 'cd /r && git log -1' }), 'vcs/tracker'],
    [use('Bash', { command: 'ruff check .' }), 'exec:lint'],
    [use('Bash', { command: 'ls -la' }), 'exec:other-shell'],
    [use('Bash', {}), 'exec:other-shell'],
    [use('WebSearch', { query: 'q' }), 'web'],
    [use('Agent', { prompt: 'p' }), 'lane-fg'],
    [use('Agent', { prompt: 'p', run_in_background: true }), 'lane-launch'],
    [use('Workflow', {}), 'lane-launch'],
    [use('Read', { file_path: '/x' }), 'file-io'],
    [use('AskUserQuestion', { questions: [] }), 'human'],
    [use('mcp__x__y', {}), 'tool:other'],
  ];
  for (const [u, want] of cases) {
    const kinds = new Map();
    assert.equal(classify(asst(0, u), kinds, rx), 'model');
    assert.equal(classify(result(1, u), kinds, rx), want, u.input.command ?? u.name);
  }
  assert.equal(classify(result(1, { id: 'unknown' }), new Map(), rx), 'tool:other');
});

test('classify: what woke the session', () => {
  const cases = [
    [human(0), 'human'],
    [user(0, '<command-message>shawarma</command-message>\n<command-name>/shawarma</command-name>'), 'human'],
    [user(0, '<command-name>/clear</command-name>'), 'human'],
    [user(0, '<bash-input>ls</bash-input>'), 'human'],
    [user(0, 'plain text from an older version'), 'human'],
    [user(0, '<task-notification>x</task-notification>', { origin: { kind: 'task-notification' } }), 'lane-wait'],
    [user(0, '<task-notification>x</task-notification>'), 'lane-wait'],
    [user(0, 'x', { origin: { kind: 'peer', name: 'general-purpose' }, isMeta: true }), 'lane-wait'],
    [user(0, '<cross-session-message from="s">x</cross-session-message>', { origin: { kind: 'peer', name: 'repo-81' }, isMeta: true }), 'other-session-wait'],
    [user(0, 'The coordinator sent a message', { isSidechain: true }), 'idle-for-coordinator'],
    [user(0, 'x', { origin: { kind: 'coordinator' } }), 'idle-for-coordinator'],
    [user(0, 'x', { turnOrigin: 'scheduled', promptSource: 'system' }), 'scheduled'],
    [compact(0), 'compaction'],
    [user(0, 'x', { origin: { kind: 'channel' } }), 'external'],
    [user(0, 'x', { origin: { kind: 'auto-continuation' } }), 'external'],
    [user(0, 'x', { origin: { kind: 'some-future-kind' }, isMeta: true }), 'external'],
    [user(0, 'x', { origin: { kind: 'person' } }), 'human'],
    [user(0, 'x', { origin: { kind: 'composer' } }), 'human'],
    [user(0, [{ type: 'text', text: '[Request interrupted by user]' }]), 'interrupt'],
    [user(0, '<task-notification>x</task-notification>', { origin: { kind: 'task-notification', subkind: 'scheduled-trigger' } }), 'scheduled'],
    [user(0, '<teammate-message from="t">x</teammate-message>'), 'other-session-wait'],
    [user(0, '<coordinator-relay>x</coordinator-relay>'), 'idle-for-coordinator'],
    [user(0, '<slack-ping>x</slack-ping>'), 'external'],
    [user(0, '<tick>x</tick>'), 'scheduled'],
    [user(0, '<remote-review>x</remote-review>'), 'lane-wait'],
    [user(0, 'follow-up from the orchestrator', { isSidechain: true }), 'idle-for-coordinator'],
    [user(0, 'what does <teammate-message> mean?', { origin: { kind: 'human' } }), 'human'],
    [user(0, 'quoting <task-notification> and <agent-message', { origin: { kind: 'human' } }), 'human'],
    [user(0, '[Request interrupted by user] is what it printed', { origin: { kind: 'human' } }), 'human'],
    [user(0, '<task-notification>pasted from a log</task-notification>', { origin: { kind: 'human' } }), 'human'],
    [user(0, '<b>bold</b> please', { origin: { kind: 'human' } }), 'human'],
    // With no origin, a tag only counts opening the text: owner text quoting one stays the owner's.
    [user(0, 'why did <cross-session-message> show up?'), 'human'],
    [user(0, 'see <teammate-message from="t">'), 'human'],
    [user(0, 'see <task-notification> here'), 'human'],
    [user(0, 'see <agent-message> here'), 'human'],
    [user(0, 'see <coordinator-relay> here'), 'human'],
    [user(0, ' <cross-session-message from="s">x</cross-session-message>'), 'other-session-wait'],
    [user(0, '<agent-message from="a">x</agent-message>'), 'lane-wait'],
    // With a harness origin, the tag may sit anywhere in the text.
    [user(0, 'Message relayed. <cross-session-message from="s">x</cross-session-message>', { origin: { kind: 'peer' }, isMeta: true }), 'other-session-wait'],
    [user(0, 'note <coordinator-relay>x</coordinator-relay>', { origin: { kind: 'coordinator' } }), 'idle-for-coordinator'],
    // Any other origin is external whatever it quotes; an owner's meta record quoting a tag is deferred.
    [user(0, '<task-notification>x</task-notification>', { origin: { kind: 'channel' } }), 'external'],
    [user(0, 'skill text naming <task-notification>', { origin: { kind: 'human' }, isMeta: true }), 'defer'],
    // An interrupt is the harness's record with no origin; the words under any origin are that origin's.
    [user(0, '[Request interrupted by user]', { origin: { kind: 'channel' } }), 'external'],
    [user(0, '[Request interrupted by user]', { turnOrigin: 'scheduled' }), 'scheduled'],
    [user(0, '[Request interrupted by user]', { origin: { kind: 'peer' } }), 'lane-wait'],
  ];
  for (const [d, want] of cases) assert.equal(classify(d, new Map(), rx), want, JSON.stringify(d.message.content).slice(0, 40));
});

test('classify: a background command\'s notification is a wait on the command, a lane\'s on the lane', () => {
  const kinds = new Map();
  const sh = use('Bash', { command: 'sleep 9', run_in_background: true });
  const mon = use('Monitor', {});
  const lane = use('Agent', { prompt: 'p', run_in_background: true });
  classify(asst(0, sh, mon, lane), kinds, rx);
  const note = (u) => user(1, `<task-notification>\n<tool-use-id>${u.id}</tool-use-id>\n</task-notification>`, { origin: { kind: 'task-notification' } });
  assert.equal(classify(note(sh), kinds, rx), 'exec-wait');
  assert.equal(classify(note(mon), kinds, rx), 'exec-wait');
  assert.equal(classify(note(lane), kinds, rx), 'lane-wait');
  assert.equal(classify(note({ id: 'unknown' }), kinds, rx), 'lane-wait');
  // A Monitor's events name its task id only; the id comes from the call's result.
  const mon2 = use('Monitor', {});
  classify(asst(2, mon2), kinds, rx);
  classify(result(3, mon2, { toolUseResult: { taskId: 'bk7' } }), kinds, rx);
  const ev = user(4, '<task-notification>\n<task-id>bk7</task-id>\nMonitor event: "x"\n</task-notification>', { origin: { kind: 'task-notification' } });
  assert.equal(classify(ev, kinds, rx), 'exec-wait');
  const sh2 = use('Bash', { command: 'sleep 9' });
  classify(asst(5, sh2), kinds, rx);
  classify(result(6, sh2, { toolUseResult: { backgroundTaskId: 'bk8', timedOutAfterMs: 120000 } }), kinds, rx);
  assert.equal(classify(user(7, '<task-notification><task-id>bk8</task-id></task-notification>'), kinds, rx), 'exec-wait');
  assert.equal(classify(user(8, '<task-notification><task-id>bk9</task-id></task-notification>'), kinds, rx), 'lane-wait');
  // A call this transcript does not hold: the harness's own words decide.
  const orphan = (body) => user(9, `<task-notification>\n<task-id>zz1</task-id>\n${body}\n</task-notification>`, { origin: { kind: 'task-notification' } });
  assert.equal(classify(orphan('<summary>Background command "sleep 9" completed (exit code 0)</summary>'), kinds, rx), 'exec-wait');
  assert.equal(classify(orphan('Monitor event: "x"'), kinds, rx), 'exec-wait');
  assert.equal(classify(orphan('<summary>Monitor "tail" stopped</summary>'), kinds, rx), 'exec-wait');
  assert.equal(classify(orphan('<summary>Agent "a" finished</summary>'), kinds, rx), 'lane-wait');
  // A known call wins over the words it carries.
  assert.equal(classify(user(10, `<task-notification><tool-use-id>${lane.id}</tool-use-id>Background command "x"</task-notification>`), kinds, rx), 'lane-wait');
});

test('classify: records that only accompany a wake-up are deferred', () => {
  for (const d of [
    meta(0),
    user(0, 'skill text', { isMeta: true }),
    user(0, 'x', { origin: { kind: 'human' }, isMeta: true }),
    user(0, '<local-command-caveat>x</local-command-caveat>'),
    user(0, '<local-command-stdout>x</local-command-stdout>'),
    user(0, '<bash-stdout>x</bash-stdout>'),
    user(0, '<fetched-web-content url="u">x</fetched-web-content>'),
    user(0, ''),
    user(0, [{ type: 'image' }]),
  ]) assert.equal(classify(d, new Map(), rx), 'defer');
});

// --- split ----------------------------------------------------------------------------------

test('split: a deferred gap goes to the wake-up record that follows it', () => {
  // The session idles 120 min; a system reminder lands, then a message from another session.
  const recs = [asst(0), meta(120), user(121, '<cross-session-message>x</cross-session-message>', { origin: { kind: 'peer' }, isMeta: true }), asst(122)];
  const { buckets } = split(recs, Date.parse(T(0)), Date.parse(T(200)), rx);
  assert.deepEqual(ms(buckets), { 'other-session-wait': 121, model: 1 });
});

test('split: a deferred gap followed by the model is other, never model', () => {
  const recs = [asst(0), meta(30), asst(31)];
  assert.deepEqual(ms(split(recs, Date.parse(T(0)), Date.parse(T(60)), rx).buckets), { other: 30, model: 1 });
});

test('split: a deferred gap at the end of the window is other', () => {
  const recs = [asst(0), meta(30)];
  assert.deepEqual(ms(split(recs, Date.parse(T(0)), Date.parse(T(60)), rx).buckets), { other: 30 });
});

test('split: an idle compaction is owner wait; a mid-turn one is compaction', () => {
  const t0 = Date.parse(T(0)), t1 = Date.parse(T(500));
  const idle = [asst(0), compact(55), human(400), asst(401)];
  assert.deepEqual(ms(split(idle, t0, t1, rx).buckets), { human: 400, model: 1 });
  const u = use('Bash', { command: 'ls' });
  const busy = [asst(0, u), result(1, u), compact(3), asst(4)];
  assert.deepEqual(ms(split(busy, t0, t1, rx).buckets), { 'exec:other-shell': 1, compaction: 2, model: 1 });
});

test('split: gaps that cross the window edges are dropped', () => {
  const recs = [human(0), asst(10), human(20), asst(30), human(40)];
  const { buckets } = split(recs, Date.parse(T(5)), Date.parse(T(35)), rx);
  assert.deepEqual(ms(buckets), { human: 10, model: 10 });
});

test('split: an owner record right after the window opens starts a turn', () => {
  const recs = [user(0, '<command-args>plan ab12</command-args>'), human(5), asst(6)];
  const { turns, waits } = split(recs, Date.parse(T(0)), Date.parse(T(10)), rx);
  assert.equal(turns, 1);
  assert.deepEqual(waits.map((w) => w / M), [5]);
});

test('split: a record at the opener\'s own instant is not a turn after it', () => {
  const recs = [meta(0), user(0, '<command-args>plan ab12</command-args>'), asst(1), human(5), asst(6)];
  const { turns, waits } = split(recs, Date.parse(T(0)), Date.parse(T(10)), rx);
  assert.equal(turns, 1);
  assert.deepEqual(waits.map((w) => w / M), [4]);
});

test('waitStats: median and max of any number of waits', () => {
  assert.deepEqual(waitStats([]), { median: 0, max: 0 });
  assert.deepEqual(waitStats([3, 1, 2, 9]), { median: 2, max: 9 });
  const many = Array.from({ length: 300000 }, (_, i) => i);
  assert.deepEqual(waitStats(many), { median: 149999, max: 299999 });
});

test('split: owner turns count runs of owner records; a compaction or reminder between adds none', () => {
  const recs = [asst(0), human(10), human(12), asst(13), compact(70), human(200), asst(201), meta(205), human(260)];
  const { turns, waits } = split(recs, Date.parse(T(0)), Date.parse(T(300)), rx);
  assert.equal(turns, 3);
  assert.deepEqual(waits.map((w) => w / M), [12, 187, 59]);
  const joined = split([asst(0), human(10), meta(11), human(12), asst(13)], Date.parse(T(0)), Date.parse(T(20)), rx);
  assert.equal(joined.turns, 1, 'a reminder between two owner records does not break the turn');
  // A start time at 00:10: the turn ending at 00:11 waited from 00:05, across the start; 00:12 joins it.
  const crossed = split([human(5), human(11), human(12), asst(13), human(15), asst(16)], Date.parse(T(10)), Date.parse(T(20)), rx);
  assert.equal(crossed.turns, 1);
  assert.deepEqual(crossed.waits.map((w) => w / M), [2]);
});

test('split: tool calls that hit their time limit, by the harness\'s record only', () => {
  const t0 = Date.parse(T(0)), t1 = Date.parse(T(100));
  const hits = (recs) => split(recs, t0, t1, rx).limited;
  const res = (at, u, content, extra = {}) => ({ ...result(at, u, extra), message: { content: [{ type: 'tool_result', tool_use_id: u.id, content }] } });
  const a = use('Bash', { command: 'sleep 999', timeout: 600000 });
  assert.equal(hits([asst(0, a), result(10, a, { toolUseResult: { timedOutAfterMs: 600000, backgroundTaskId: 'b1' } })]), 1, 'timedOutAfterMs');
  const b = use('Bash', { command: 'sleep 999' });
  assert.equal(hits([asst(0, b), res(2, b, 'Command did not complete within its 120s timeout and was moved to the background (ID: b2). Output is being written to: /x')]), 1, 'moved to the background, text only');
  const c = use('Bash', { command: 'sleep 999' });
  assert.equal(hits([asst(0, c), res(2, c, [{ type: 'text', text: 'Exit code 143\nCommand timed out after 2m 0s' }], { is_error: true })]), 1, 'stopped at its limit');
  const d = use('Bash', { command: 'sleep 999', timeout: 60000 });
  assert.equal(hits([asst(0, d), result(9, d, { toolUseResult: { stdout: 'done', interrupted: false } })]), 0, 'late but completed: elapsed time never counts');
  const e = use('Bash', { command: 'sleep 999' });
  assert.equal(hits([asst(0, e), result(3, e, { toolUseResult: { backgroundTaskId: 'b3', stdout: '' } })]), 0, 'moved to the background by the owner');
  const f = use('Bash', { command: 'x', timeout: 600000 });
  assert.equal(hits([asst(95, f), result(105, f, { toolUseResult: { timedOutAfterMs: 600000 } })]), 0, 'result after the window');
  const g = use('Bash', { command: 'cat log' });
  assert.equal(hits([asst(0, g), res(0.1, g, 'x'.repeat(250) + 'Command timed out after 2m')]), 0, 'command output quoting the words');
  const g2 = use('Bash', { command: 'grep x' });
  assert.equal(hits([asst(0, g2), res(0.1, g2, 'match: Command did not complete within its 120s timeout and was moved to the background')]), 0, 'quoted, not opening the result');
  const g3 = use('Bash', { command: 'sleep 999' });
  assert.equal(hits([asst(0, g3), res(2, g3, '<error>Command timed out after 2m 0s</error>', { is_error: true })]), 1, 'stopped, as an error block');
  const r = use('Read', { file_path: '/x' });
  assert.equal(hits([asst(0, r), result(1, r, { toolUseResult: { timedOutAfterMs: 1000 } })]), 1, 'timedOutAfterMs on any tool');
  const h = use('Read', { file_path: '/x' });
  assert.equal(hits([asst(0, h), res(0.1, h, 'Command timed out after 2m')]), 0, 'a file holding the words');
  const bg = use('Bash', { command: 'sleep 9999', run_in_background: true });
  const stopped = (text, extra = { origin: { kind: 'task-notification' } }) => user(50, text, extra);
  const notice = `<task-notification>\n<tool-use-id>${bg.id}</tool-use-id>\n<status>killed</status>\n<summary>Background command "sleep 9999" was stopped after reaching its background time limit</summary>\n</task-notification>`;
  assert.equal(hits([asst(0, bg), result(1, bg), stopped(notice)]), 1, 'a background command stopped at its background limit');
  assert.equal(hits([asst(0, bg), result(1, bg), stopped(notice.replace('was stopped after reaching its background time limit', 'completed (exit code 0)'))]), 0, 'a background command that completed');
  assert.equal(hits([asst(0, bg), result(1, bg), human(50, notice)]), 0, 'the owner pasting the notice');
  const fg = use('Bash', { command: 'sleep 9999' });
  const moved = result(2, fg, { toolUseResult: { timedOutAfterMs: 120000, backgroundTaskId: 'bk20' } });
  const later = stopped(`<task-notification><task-id>bk20</task-id><summary>Background command "sleep 9999" was stopped after reaching its background time limit</summary></task-notification>`);
  assert.equal(hits([asst(0, fg), moved, later]), 1, 'moved at its limit, then stopped at the next: one call');
  const orphan = later.message.content.replace('bk20', 'bk21');
  assert.equal(hits([stopped(orphan), stopped(orphan)]), 1, 'a call this transcript does not hold is known by the id it names');
  const noId = '<task-notification><summary>Background command "x" was stopped after reaching its background time limit</summary></task-notification>';
  assert.equal(hits([stopped(noId), stopped(noId)]), 2, 'a notice naming no id is a call of its own');
  assert.equal(hits([stopped(noId.replace('command "x"', 'command " was stopped after reaching its background time limit</summary>'))]), 0, 'one quote cannot open and close the command');
  const relay = `<cross-session-message from="s">${notice}</cross-session-message>`;
  assert.equal(classify(user(0, relay, { origin: { kind: 'peer' }, isMeta: true }), new Map(), rx), 'other-session-wait');
  assert.equal(hits([asst(0, bg), result(1, bg), stopped(relay, { origin: { kind: 'peer' }, isMeta: true })]), 0, 'another session\'s notice, relayed');
  const quoting = notice.replace('sleep 9999', 'echo <cross-session-message from=x>');
  assert.equal(hits([asst(0, bg), result(1, bg), stopped(quoting)]), 1, 'the command it quotes holds a tag');
  assert.equal(classify(stopped(quoting), new Map([[bg.id, { name: 'Bash' }]]), rx), 'exec-wait');
  const dup = use('Bash', { command: 'sleep 999' });
  assert.equal(hits([asst(0, dup), result(10, dup, { toolUseResult: { timedOutAfterMs: 1 } }), asst(11, dup), result(12, dup, { toolUseResult: { timedOutAfterMs: 1 } })]), 1, 'a call seen again is still one call');
  const away = { id: 'zz9' };
  assert.equal(hits([result(10, away, { toolUseResult: { timedOutAfterMs: 1 } }), result(12, away, { toolUseResult: { timedOutAfterMs: 1 } })]), 1, 'a result for a call the file does not hold is known by its id');
});

test('split: an AskUserQuestion answer is an owner turn; an interrupt is not', () => {
  const q = use('AskUserQuestion', { questions: [] });
  const recs = [asst(0, q), result(30, q), asst(31), user(40, [{ type: 'text', text: '[Request interrupted by user]' }]), human(50), asst(51)];
  const { buckets, turns, waits } = split(recs, Date.parse(T(0)), Date.parse(T(60)), rx);
  assert.deepEqual(ms(buckets), { human: 40, model: 2, interrupt: 9 });
  assert.equal(turns, 2);
  assert.deepEqual(waits.map((w) => w / M), [30, 10]);
});

// --- plan start -----------------------------------------------------------------------------

test('planStarts: plan commands for exactly this ticket', () => {
  const recs = [
    user(1, '<command-message>shawarma</command-message>\n<command-name>/shawarma</command-name>\n<command-args>plan pi0y</command-args>'),
    user(2, '<command-name>/strandic:shawarma</command-name>\n<command-args>plan pi0y with 3tvp folded in</command-args>'),
    human(3, '/shawarma plan pi0y'),
    human(4, '/strandic:shawarma plan pi0y'),
    user(10, '<command-args>plan pi0yz</command-args>'),
    user(11, '<command-args>plan pi0</command-args>'),
    user(12, '<command-args>run pi0y</command-args>'),
    human(13, 'yesterday I ran /shawarma plan pi0y'),
    user(14, '<command-args>plan pi0y</command-args>', { isSidechain: true }),
    user(15, '<command-args>plan pi0y</command-args>', { isMeta: true }),
    { ...result(16, { id: 'x' }), message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: '<command-args>plan pi0y</command-args>' }] } },
  ];
  assert.deepEqual(planStarts(recs, 'pi0y').map((t) => (t - Date.parse(T(0))) / M), [1, 2, 3, 4]);
  assert.deepEqual(planStarts(recs, 'pi0').map((t) => (t - Date.parse(T(0))) / M), [11]);
  assert.deepEqual(planStarts([user(1, '<command-args>plan a.b</command-args>')], 'a+b'), []);
});

// --- inputs ---------------------------------------------------------------------------------

test('parsePlans: fields, comments, and refusals by line number', () => {
  assert.deepEqual(parsePlans('# header\n\npi0y d0d3 2026-10-17T10:15:08+02:00\nab12 ffee 2026-10-17T08:00:00Z 2026-10-17T07:00:00Z  # resumed\n'), [
    { ticket: 'pi0y', session: 'd0d3', brief: Date.parse('2026-10-17T08:15:08Z'), start: null },
    { ticket: 'ab12', session: 'ffee', brief: Date.parse('2026-10-17T08:00:00Z'), start: Date.parse('2026-10-17T07:00:00Z') },
  ]);
  assert.throws(() => parsePlans('x abcd\n'), /line 1: expected/);
  assert.throws(() => parsePlans('\nx abcd 2026-10-17T10:15:08\n'), /line 2: brief time/);
  assert.throws(() => parsePlans('x abcd 2026-10-17T10:15:08Z later\n'), /line 1: start time/);
  assert.throws(() => parsePlans('x abcd 2026-10-17T10:15:08Z 2026-10-17T10:15:08Z z\n'), /line 1: expected/);
  assert.throws(() => parsePlans('x . 2026-10-17T10:15:08Z\n'), /line 1: session/);
  assert.throws(() => parsePlans('x ../a 2026-10-17T10:15:08Z\n'), /line 1: session/);
  assert.throws(() => parsePlans('x abcd 2026-10-01Z\n'), /line 1: brief time/);
  assert.throws(() => parsePlans('x abcd 2026-13-45T10:00Z\n'), /line 1: brief time/);
  assert.throws(() => parsePlans('x abcd 2026-10-17T10:00Z 2026-02-30T10:00Z\n'), /line 1: start time/);
  assert.throws(() => parsePlans('x abcd 2026-10-17T10:15:08Z\ny abcd 2026-10-17T10:15:08Z\nx abcd 2026-10-18T10:15:08Z\n'), /line 3: same ticket and session as line 1/);
  assert.deepEqual(parsePlans('\uFEFFab12 abcd 2026-10-17T08:00:00Z\r\n#x abcd 2026-10-17T08:00:00Z\n').map((p) => p.ticket), ['ab12']);
  assert.deepEqual(parsePlans('a#b abcd 2026-10-17T08:00:00Z # note\n').map((p) => p.ticket), ['a#b']);
});

const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'plantime-'));
  const write = (rel, recs) => {
    const p = join(dir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, recs.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n');
  };
  return { dir, write };
};

test('isIso: real instants only', () => {
  for (const ok of ['2026-10-17T10:15:08+02:00', '2026-10-17T08:00Z', '2028-02-29T00:00:00.123Z']) assert.ok(isIso(ok), ok);
  for (const no of ['2026-10-17T10:15:08', '2026-10-01Z', '2026-13-01T00:00Z', '2026-02-29T00:00Z', '2026-10-17T24:00Z', '2026-10-17T10:60Z', '2026-10-17T10:00+25:00', 7, undefined]) assert.ok(!isIso(no), String(no));
});

test('sessionFile: a unique prefix; refusals do not name the path', () => {
  const { dir, write } = fixture();
  write('aaaa1111-x.jsonl', []); write('aaaa2222-y.jsonl', []);
  assert.equal(sessionFile(dir, 'aaaa1'), join(dir, 'aaaa1111-x.jsonl'));
  assert.throws(() => sessionFile(dir, 'aaaa'), (e) => /ambiguous: 2/.test(e.message) && !e.message.includes(dir));
  assert.throws(() => sessionFile(dir, 'bbbb'), (e) => /not found: 0/.test(e.message) && !e.message.includes(dir));
  mkdirSync(join(dir, 'cccc0001.jsonl'));
  symlinkSync(join(dir, 'aaaa1111-x.jsonl'), join(dir, 'dddd0001-link.jsonl'));
  assert.throws(() => sessionFile(dir, 'cccc'), /not found: 0/);
  assert.throws(() => sessionFile(dir, 'dddd'), /not found: 0/);
  rmSync(dir, { recursive: true });
});

test('records: unreadable lines and untimed records are counted, the rest sorted', () => {
  const { dir, write } = fixture();
  write('s.jsonl', [asst(5), '{not json', human(1), { type: 'user', message: { content: 'x' } }, { type: 'attachment', timestamp: T(2) }, { ...asst(3), timestamp: 'never' }, { ...asst(4), timestamp: '2026-10-01T08:04:00' }]);
  const { recs, bad } = records(join(dir, 's.jsonl'));
  assert.equal(bad, 4); // bad JSON, no timestamp, 'never', no offset; the attachment is not a turn record
  assert.deepEqual(recs.map((r) => r.timestamp), [T(1), T(5)]);
  writeFileSync(join(dir, 'bom.jsonl'), '\uFEFF' + JSON.stringify(human(1)) + '\n' + JSON.stringify(asst(2)));
  assert.deepEqual(records(join(dir, 'bom.jsonl')), { recs: [human(1), asst(2)], bad: 0 });
  writeFileSync(join(dir, 'date.jsonl'), [human(1), { ...asst(2), timestamp: '2026-02-30T08:00:00Z' }].map((r) => JSON.stringify(r)).join('\n'));
  assert.deepEqual(records(join(dir, 'date.jsonl')), { recs: [human(1)], bad: 1 });
  rmSync(dir, { recursive: true });
});

// --- probe ---------------------------------------------------------------------------------

test('isProbe: the default probe regex\'s verdict on every command, without its backtracking', () => {
  const re = new RegExp(DEFAULTS.probe);
  const parts = ['uv run ', 'python ', 'python3 ', 'python', 'x.py', '.py', ' -c', 'node -e', 'node ', '|', ';', '&', ' ', 'a', 'pythonx', 'uv run', 'run '];
  let n = 0;
  const walk = (s, depth) => {
    assert.equal(isProbe(s), re.test(s), JSON.stringify(s)); n++;
    if (depth) for (const p of parts) walk(s + p, depth - 1);
  };
  walk('', 4);
  assert.equal(n, 88741);
  assert.equal(bashKind('uv run python x', rx), 'exec:probe');
  assert.equal(bashKind('uv run x', { ...rx, probe: /uv run/ }), 'exec:probe', 'a --probe regex is used as given');
});

test('cost: classifying four times the command or the notice costs at most six times the time (best of 3)', () => {
  // Through bashKind with the default patterns, as the meter calls it.
  const best = (s) => Math.min(...[0, 1, 2].map(() => { const t = process.hrtime.bigint(); bashKind(s, rx); return Number(process.hrtime.bigint() - t); }));
  assert.equal(isProbe('uv run python x'), true);
  // A stop notice that opens and never closes, through split as the meter reads it.
  const note = (k) => [user(0, `<task-notification>${'<summary>Background command "'.repeat(k)}</task-notification>`, { origin: { kind: 'task-notification' } })];
  const bestSplit = (r) => Math.min(...[0, 1, 2].map(() => { const t = process.hrtime.bigint(); split(r, 0, Date.parse(T(9)), rx); return Number(process.hrtime.bigint() - t); }));
  const small = note(20000), big = note(80000);
  bestSplit(small);
  assert.ok(bestSplit(big) / bestSplit(small) <= 6, 'stop notice');
  // Rejected only after the most work: every opener with nothing after it that completes it.
  for (const unit of ['uv run ', 'python3 ']) {
    const n = unit.repeat(20000), n4 = unit.repeat(80000);
    assert.equal(bashKind(n4, rx), 'exec:other-shell');
    const r = best(n4) / best(n);
    assert.ok(r <= 6, `${unit}: ratio ${r.toFixed(2)}`);
  }
});

// --- end to end -----------------------------------------------------------------------------

const session = 'abcd0001-0000-0000-0000-000000000000';
const project = () => {
  const { dir, write } = fixture();
  const u = use('Bash', { command: 'uv run pytest' });
  write(`${session}.jsonl`, [
    human(0, 'SECRET-TEXT before the plan'),
    asst(1),
    user(10, '<command-message>shawarma</command-message>\n<command-name>/shawarma</command-name>\n<command-args>plan ab12</command-args>'),
    asst(11, u), result(14, u), asst(15),
    human(75),
    asst(76),
  ]);
  write(`${session}/subagents/agent-a1.jsonl`, [user(20, 'SECRET-TEXT lane prompt', { isSidechain: true }), asst(26)]);
  write(`${session}/subagents/workflows/wf_1/agent-a2.jsonl`, [user(30, 'p', { isSidechain: true }), asst(34)]);
  write(`${session}/subagents/agent-a0.jsonl`, [user(2, 'p', { isSidechain: true }), asst(9)]);
  return dir;
};
const plans = (text) => parsePlans(text);

test('measure: one plan, its lanes nested at any depth, and a plan with no command', () => {
  const dir = project();
  const { data, lines } = measure(dir, plans(`ab12 abcd0001 ${T(80)}\nzz99 abcd0001 ${T(80)}\nab12 beef ${T(80)}\n`), rx);
  assert.equal(data.length, 3);
  assert.equal(data[0].wallMs, 70 * M);
  assert.equal(data[0].attributedMs, 66 * M);
  assert.deepEqual(data[0].buckets, { model: 3 * M, 'exec:suite': 3 * M, human: 60 * M });
  assert.deepEqual(data[0].laneBuckets, { model: 10 * M });
  assert.equal(data[0].lanes, 2);
  assert.equal(data[0].ownerTurns, 1);
  assert.equal(data[0].timeLimitHits, 0); // a 3 min suite run that completed
  assert.deepEqual(data[1], { ticket: 'zz99', notRun: 'no `plan zz99` command before the brief time' });
  assert.deepEqual(data[2], { ticket: 'ab12', notRun: 'session not found: 0 transcripts match' });
  assert.match(lines.join('\n'), /## ab12: wall 70m \(attributed 66m\)/);
  rmSync(dir, { recursive: true });
});

test('measure: a given start time overrides the plan command; a start after the brief is refused', () => {
  const dir = project();
  const { data } = measure(dir, plans(`ab12 abcd0001 ${T(80)} ${T(70)}\nab12 abcd0001 ${T(80)} ${T(90)}\n`.split('\n')[0]), rx);
  const late = measure(dir, plans(`ab12 abcd0001 ${T(80)} ${T(90)}\n`), rx).data;
  assert.equal(data.length, 1);
  assert.equal(data[0].wallMs, 10 * M);
  assert.deepEqual(late, [{ ticket: 'ab12', notRun: 'start is after the brief time' }]);
  rmSync(dir, { recursive: true });
});

test('lanes: links, loops, pipes and unreadable files are skipped and counted, never followed', () => {
  const dir = project();
  const sub = join(dir, session, 'subagents');
  symlinkSync(sub, join(sub, 'loop'));
  symlinkSync(join(dir, `${session}.jsonl`), join(sub, 'agent-link.jsonl'));
  symlinkSync(join(dir, 'missing'), join(sub, 'agent-dangling.jsonl'));
  execFileSync('mkfifo', [join(sub, 'agent-fifo.jsonl')]);
  writeFileSync(join(sub, 'agent-locked.jsonl'), JSON.stringify(asst(21)));
  chmodSync(join(sub, 'agent-locked.jsonl'), 0o000);
  const { data } = measure(dir, plans(`ab12 abcd0001 ${T(80)}\n`), rx);
  assert.equal(data.length, 1);
  assert.equal(data[0].lanes, 2);
  assert.deepEqual(data[0].laneBuckets, { model: 10 * M });
  assert.equal(data[0].lanesSkipped, 5, 'the FIFO, both file links, the locked file and the directory link loop');
  rmSync(dir, { recursive: true });
});

test('unreadable inputs read NOT RUN by error code', () => {
  const dir = project();
  const gone = join(dir, 'gone');
  assert.throws(() => measure(gone, plans(`ab12 abcd0001 ${T(80)}\n`), rx), (e) => e.message === 'transcripts dir not readable: ENOENT');
  chmodSync(join(dir, `${session}.jsonl`), 0o000);
  assert.deepEqual(measure(dir, plans(`ab12 abcd0001 ${T(80)}\n`), rx).data, [{ ticket: 'ab12', notRun: 'session transcript not readable: EACCES' }]);
  rmSync(dir, { recursive: true });
});

test('output holds durations and counts only: no message text, command, session id or path', () => {
  const dir = project();
  const pf = join(dir, 'plans.txt');
  writeFileSync(pf, `ab12 abcd0001 ${T(80)}\nzz99 abcd0001 ${T(80)}\nab12 beef ${T(80)}\n`);
  const outs = [main(['node', 'plantime', dir, pf]), main(['node', 'plantime', dir, pf, '--json'])];
  for (const bad of [[dir, join(dir, 'missing.txt')], [dir, pf, '--suite', '('], [join(dir, 'gone'), pf]]) {
    try { main(['node', 'plantime', ...bad]); assert.fail('no error'); } catch (e) { outs.push([e.message]); }
  }
  chmodSync(join(dir, `${session}.jsonl`), 0o000);
  outs.push(main(['node', 'plantime', dir, pf, '--json']));
  for (const out of outs) {
    const s = out.join('\n');
    for (const leak of ['SECRET', 'pytest', 'uv run', session, 'abcd0001', dir, 'agent-a', 'missing.txt']) assert.ok(!s.includes(leak), `output holds ${leak}: ${s.slice(0, 80)}`);
  }
  rmSync(dir, { recursive: true });
});

test('measure: records not read are counted in the session and its lanes', () => {
  const { dir, write } = fixture();
  write(`${session}.jsonl`, [user(0, '<command-args>plan ab12</command-args>'), asst(1), '{bad', { ...asst(2), timestamp: '2026-13-01T00:00:00Z' }, asst(3)]);
  write(`${session}/subagents/agent-a.jsonl`, [user(1, 'p', { isSidechain: true }), { ...asst(2), timestamp: 'later' }, asst(3)]);
  write(`${session}/subagents/agent-b.jsonl`, ['{bad', { ...asst(2), timestamp: 'nope' }]);
  write(`${session}/subagents/agent-c.jsonl`, []);
  const { data, lines } = measure(dir, plans(`ab12 abcd0001 ${T(10)}\n`), rx);
  assert.equal(data.length, 1);
  assert.equal(data[0].unreadableRecords, 3);
  assert.equal(data[0].lanes, 1);
  assert.equal(data[0].lanesSkipped, 1, 'a lane with nothing readable is skipped; an empty one is no lane');
  assert.match(lines.join('\n'), /records not read in the session file and its lanes \(bad line or no real timestamp\): 3/);
  rmSync(dir, { recursive: true });
});

test('measure writes nothing', () => {
  const dir = project();
  const before = JSON.stringify(readdirSync(dir, { recursive: true }).sort());
  measure(dir, plans(`ab12 abcd0001 ${T(80)}\n`), rx);
  assert.equal(JSON.stringify(readdirSync(dir, { recursive: true }).sort()), before);
  rmSync(dir, { recursive: true });
});

test('main: flags and usage', () => {
  const dir = project();
  const pf = join(dir, 'plans.txt');
  writeFileSync(pf, `ab12 abcd0001 ${T(80)}\n`);
  const out = main(['node', 'plantime', dir, pf, '--json', '--suite', 'nothing-matches-this']);
  assert.equal(out.length, 1);
  const data = JSON.parse(out[0]);
  assert.deepEqual(data[0].buckets, { model: 3 * M, 'exec:other-shell': 3 * M, human: 60 * M });
  assert.throws(() => main(['node', 'plantime', dir]), /usage/);
  assert.throws(() => main(['node', 'plantime', dir, pf, '--probe']), /--probe needs a regex/);
  assert.throws(() => main(['node', 'plantime', dir, pf, '--vcs', '[']), /--vcs is not a valid regex/);
  rmSync(dir, { recursive: true });
});

test('the CLI prints from any path to the script: a link, a %, a #', () => {
  const dir = project();
  const pf = join(dir, 'plans.txt');
  writeFileSync(pf, `ab12 abcd0001 ${T(80)}\n`);
  const script = new URL('../plantime.mjs', import.meta.url).pathname;
  const odd = join(dir, 'a %23# b');
  mkdirSync(odd);
  copyFileSync(script, join(odd, 'plantime.mjs'));
  symlinkSync(odd, join(dir, 'link'));
  for (const p of [script, join(odd, 'plantime.mjs'), join(dir, 'link', 'plantime.mjs')]) {
    assert.match(execFileSync('node', [p, dir, pf], { encoding: 'utf8' }), /## ab12: wall 70m/, p);
  }
  assert.match(execFileSync('node', ['--preserve-symlinks-main', join(dir, 'link', 'plantime.mjs'), dir, pf], { encoding: 'utf8' }), /## ab12: wall 70m/);
  let err;
  try { execFileSync('node', [script, join(dir, 'gone'), pf], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { err = e; }
  assert.equal(err?.status, 1);
  assert.equal(err.stderr.trim(), 'transcripts dir not readable: ENOENT');
  rmSync(dir, { recursive: true });
});

test('cost: four times the records costs at most six times the time (best of 3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plantime-cost-'));
  const make = (n) => {
    const u = use('Bash', { command: 'python3 x ' + 'a'.repeat(200) });
    const recs = [user(0, '<command-args>plan ab12</command-args>')];
    for (let i = 1; i < n; i += 2) recs.push(asst(i / 60, u), result((i + 1) / 60, u));
    writeFileSync(join(dir, `abcd${n}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n'));
    return parsePlans(`ab12 abcd${n} ${T(n)}\n`);
  };
  const time = (p) => Math.min(...[0, 1, 2].map(() => { const s = process.cpuUsage(); measure(dir, p, rx); const d = process.cpuUsage(s); return d.user + d.system; }));
  try {
    const small = make(20000), big = make(80000);
    // The work is real: the plan was read, every record in its window.
    const read = measure(dir, big, rx).data;
    assert.equal(read.length, 1);
    assert.equal(read[0].buckets['exec:other-shell'], 40000 * 1000);
    time(small);
    const ratio = time(big) / time(small);
    assert.ok(ratio <= 6, `ratio ${ratio.toFixed(2)}`);
  } finally { rmSync(dir, { recursive: true }); }
});

// --- review round 1 ------------------------------------------------------------------------

test('measure: a malformed record never stops the run', () => {
  const { dir, write } = fixture();
  const deep = `{"type":"user","timestamp":"${T(4)}","message":{"content":[{"type":"text","text":${'['.repeat(6000)}${']'.repeat(6000)}}]}}`;
  const odd = (id, command) => ({ type: 'tool_use', id, name: 'Bash', input: { command } });
  write(`${session}.jsonl`, [user(0, '<command-args>plan ab12</command-args>'), asst(1, odd('n1', 42), odd('n2', ['ls']), odd('n3', { a: 1 })),
    result(2, { id: 'n1' }), deep, asst(5)]);
  write('beef0001.jsonl', [user(0, '<command-args>plan cd34</command-args>'), asst(3)]);
  let data;
  assert.doesNotThrow(() => ({ data } = measure(dir, plans(`ab12 abcd0001 ${T(10)}\ncd34 beef0001 ${T(10)}\n`), rx)));
  assert.equal(data.length, 2);
  assert.equal(data[0].wallMs, 10 * M);
  assert.equal(data[0].buckets['exec:other-shell'], 1 * M, 'a command that is not text is no known kind of command');
  assert.equal(data[1].wallMs, 10 * M);
  rmSync(dir, { recursive: true });
});

test('main: a plans file that never ends, or a pipe with no writer, does not hang', () => {
  const dir = project();
  const script = new URL('../plantime.mjs', import.meta.url).pathname;
  const run = (args, opts = {}) => {
    try { return { status: 0, out: execFileSync('node', [script, dir, ...args], { encoding: 'utf8', stdio: 'pipe', timeout: 15000, ...opts }) }; }
    catch (e) { return { status: e.status, err: String(e.stderr).trim(), signal: e.signal }; }
  };
  assert.deepEqual(run(['/dev/zero']), { status: 1, err: 'plans file not readable: not a file or pipe', signal: null });
  execFileSync('mkfifo', [join(dir, 'fifo')]);
  assert.deepEqual(run([join(dir, 'fifo')]), { status: 1, err: 'plans file holds no plan', signal: null });
  const piped = execFileSync('bash', ['-c', `node "${script}" "${dir}" <(printf 'ab12 abcd0001 ${T(80)}\\n')`], { encoding: 'utf8', timeout: 15000 });
  assert.match(piped, /## ab12: wall 70m/);
  rmSync(dir, { recursive: true });
});

test('split: a wait that began before the start is no turn, whatever accompanies it at the start', () => {
  for (const between of [meta(11), compact(11), meta(10)]) {
    const r = split([asst(0), between, human(12), asst(13), human(15), asst(16)], Date.parse(T(10)), Date.parse(T(20)), rx);
    assert.equal(r.turns, 1, JSON.stringify(between.timestamp));
    assert.deepEqual(r.waits.map((w) => w / M), [2]);
  }
  // With nothing but accompanying records before it, the wait runs from the file's first record.
  for (const start of [-1, 0]) {
    const r = split([meta(0), meta(1), human(3), asst(4)], Date.parse(T(start)), Date.parse(T(20)), rx);
    assert.equal(r.turns, 1, `start ${start}`);
    assert.deepEqual(r.waits.map((w) => w / M), [3]);
  }
  assert.equal(split([human(3), asst(4)], Date.parse(T(0)), Date.parse(T(20)), rx).turns, 0, 'the first record waited on nothing');
});

test('classify: the harness\'s words count only outside the result a lane wrote', () => {
  const t0 = Date.parse(T(0)), t1 = Date.parse(T(100));
  const lane = (inner) => user(9, `<task-notification>\n<task-id>zz2</task-id>\n<summary>Agent "a" finished</summary>\n<result>${inner}</result>\n</task-notification>`, { origin: { kind: 'task-notification' } });
  assert.equal(classify(lane('Background command "make" completed'), new Map(), rx), 'lane-wait');
  assert.equal(classify(lane('Monitor event: "x"'), new Map(), rx), 'lane-wait');
  const stopped = lane('<summary>Background command "make" was stopped after reaching its background time limit</summary>');
  assert.equal(split([stopped], t0, t1, rx).limited, 0);
});

test('split: time-limit hits are keyed by call, in every shape the harness writes', () => {
  const t0 = Date.parse(T(0)), t1 = Date.parse(T(100));
  const hits = (recs) => split(recs, t0, t1, rx).limited;
  const tn = { origin: { kind: 'task-notification' } };
  const stop = (ids, cmd = 'x') => `<task-notification>${ids}<summary>Background command "${cmd}" was stopped after reaching its background time limit</summary></task-notification>`;
  // A completed command whose own text holds the stop words and the summary's close.
  const quoted = `<task-notification><task-id>q0</task-id><summary>Background command "echo '" was stopped after reaching its background time limit</summary>'" completed (exit code 0)</summary></task-notification>`;
  assert.equal(hits([user(5, quoted, tn)]), 0, 'a completed command quoting the stop words');
  assert.equal(hits([user(5, stop('<task-id>q1</task-id>') + '\n' + stop('<task-id>q2</task-id>'))]), 2, 'two notices in one record, two calls');
  const bare = { type: 'user', timestamp: T(5), message: { content: [{ type: 'tool_result', content: 'x' }] }, toolUseResult: { timedOutAfterMs: 1 } };
  assert.equal(hits([bare, { ...bare, timestamp: T(6) }]), 2, 'results naming no call are calls of their own');
  const a = use('Bash', { command: 'sleep 999' });
  const movedText = { ...result(2, a), message: { content: [{ type: 'tool_result', tool_use_id: a.id, content: 'Command did not complete within its 120s timeout and was moved to the background (ID: k1). Output is being written to: /x' }] } };
  assert.equal(hits([asst(0, a), movedText, user(50, stop('<task-id>k1</task-id>'), tn)]), 1, 'moved (its id in the text), then stopped: one call');
  const away = { id: 'x9' };
  assert.equal(hits([result(2, away, { toolUseResult: { timedOutAfterMs: 1, backgroundTaskId: 'k9' } }), user(50, stop('<task-id>k9</task-id>'), tn)]), 1, 'a call the file does not hold, moved then stopped');
  assert.equal(hits([user(40, stop('<task-id>k8</task-id><tool-use-id>u8</tool-use-id>'), tn), user(50, stop('<task-id>k8</task-id>'), tn)]), 1, 'one unknown call named by both ids, then by its task id');
  const kinds = new Map();
  classify(asst(0, { type: 'tool_use', id: 'task:k5', name: 'Agent', input: {} }), kinds, rx);
  assert.equal(classify(user(5, '<task-notification><task-id>k5</task-id><summary>Background command "x" completed</summary></task-notification>', tn), kinds, rx), 'exec-wait', 'a call id is never a task id');
  for (const kind of ['peer', 'coordinator']) {
    const r = user(5, `Relayed: ${stop('<task-id>p1</task-id>')}`, { origin: { kind } });
    assert.equal(classify(r, new Map(), rx), kind === 'peer' ? 'lane-wait' : 'idle-for-coordinator', kind);
    assert.equal(hits([r]), 0, `a ${kind} record quoting a notice`);
  }
});

test('planStarts: only a command the owner gave opens the window', () => {
  const recs = [
    human(1, 'see <command-args>plan pi0y</command-args>'),
    user(2, 'quoted <command-args>plan pi0y</command-args>'),
    user(3, '<command-args>plan pi0y</command-args>', { origin: { kind: 'peer' } }),
    user(4, '<command-args>plan pi0y</command-args>', { origin: { kind: 'task-notification' } }),
    user(5, '<command-args>plan pi0y</command-args>', { origin: { kind: 'channel' } }),
    user(6, '<command-name>/shawarma</command-name>\n<command-args>plan pi0y</command-args>', { origin: { kind: 'human' } }),
  ];
  assert.deepEqual(planStarts(recs, 'pi0y').map((t) => (t - Date.parse(T(0))) / M), [6]);
});

test('lanes: directory links and a linked session folder are skipped and counted, never followed', () => {
  const dir = project();
  const sub = join(dir, session, 'subagents');
  const elsewhere = join(dir, 'elsewhere');
  renameSync(join(sub, 'workflows'), elsewhere);
  symlinkSync(elsewhere, join(sub, 'workflows'));
  const { data } = measure(dir, plans(`ab12 abcd0001 ${T(80)}\n`), rx);
  assert.equal(data[0].lanes, 1);
  assert.equal(data[0].lanesSkipped, 1);
  const away = join(dir, 'away');
  renameSync(join(dir, session), away);
  symlinkSync(away, join(dir, session));
  const linked = measure(dir, plans(`ab12 abcd0001 ${T(80)}\n`), rx).data;
  assert.equal(linked[0].lanes, 0);
  assert.equal(linked[0].lanesSkipped, 1);
  rmSync(dir, { recursive: true });
});

test('measure: a transcripts dir that can be listed but not searched reads its error code', () => {
  const dir = project();
  chmodSync(dir, 0o400);
  try {
    assert.deepEqual(measure(dir, plans(`ab12 abcd0001 ${T(80)}\n`), rx).data, [{ ticket: 'ab12', notRun: 'session transcript not readable: EACCES' }]);
  } finally { chmodSync(dir, 0o700); rmSync(dir, { recursive: true }); }
});

test('measure: the window opens at the first command before the brief; lanes and hits by the window', () => {
  const { dir, write } = fixture();
  const cmd = (at) => user(at, '<command-args>plan ab12</command-args>');
  const u = use('Bash', { command: 'sleep 999' });
  write(`${session}.jsonl`, [cmd(10), asst(11, u), result(12, u, { toolUseResult: { timedOutAfterMs: 1 } }), cmd(40), asst(41), cmd(90)]);
  write(`${session}/subagents/agent-in.jsonl`, [user(20, 'p', { isSidechain: true }), asst(21, u), result(22, u, { toolUseResult: { timedOutAfterMs: 1 } })]);
  write(`${session}/subagents/agent-late.jsonl`, [user(85, 'p', { isSidechain: true }), '{bad', asst(86)]);
  write(`${session}/subagents/agent-stray.jsonl`, [user(-600, 'p', { isSidechain: true }), user(30, 'p', { isSidechain: true }), asst(35)]);
  const [first] = measure(dir, plans(`ab12 abcd0001 ${T(80)}\n`), rx).data;
  assert.equal(first.wallMs, 70 * M, 'the first command');
  assert.equal(first.planCommands, 2, 'the command after the brief is not counted');
  assert.equal(first.lanes, 2, 'a lane starting after the brief is not one; a lane with a record in the window is');
  assert.equal(first.unreadableRecords, 0, 'a lane outside the window adds no unread records');
  assert.equal(first.laneBuckets.model, 6 * M);
  assert.equal(first.timeLimitHits, 2, 'the same call in the session and a lane: two files, two');
  const [late] = measure(dir, plans(`ab12 abcd0001 ${T(80)} ${T(30)}\n`), rx).data;
  assert.equal(late.planCommands, 1, 'a command before a given start is not in the window');
  write('beef0001.jsonl', [cmd(90), asst(91)]);
  assert.deepEqual(measure(dir, plans(`ab12 beef0001 ${T(80)}\n`), rx).data, [{ ticket: 'ab12', notRun: 'no `plan ab12` command before the brief time' }]);
  write('cafe0001.jsonl', ['{bad', '{bad']);
  assert.deepEqual(measure(dir, plans(`ab12 cafe0001 ${T(80)}\n`), rx).data, [{ ticket: 'ab12', notRun: 'no `plan ab12` command before the brief time (records not read: 2)' }]);
  rmSync(dir, { recursive: true });
});

test('split: a compaction between owner records joins the turn; a turn after the window is not counted', () => {
  const joined = split([asst(0), human(10), compact(11), human(12), asst(13)], Date.parse(T(0)), Date.parse(T(20)), rx);
  assert.equal(joined.turns, 1);
  const after = split([asst(0), human(5), asst(6), human(15), asst(16)], Date.parse(T(0)), Date.parse(T(10)), rx);
  assert.equal(after.turns, 1);
});

test('lanes: a subagents entry that is a file, and a folder that cannot be read, are counted', () => {
  const { dir, write } = fixture();
  write(`${session}.jsonl`, [user(0, '<command-args>plan ab12</command-args>'), asst(1)]);
  write(`${session}/subagents`, ['x']);
  assert.equal(measure(dir, plans(`ab12 abcd0001 ${T(10)}\n`), rx).data[0].lanesSkipped, 1);
  rmSync(join(dir, session), { recursive: true });
  write(`${session}/subagents/locked/agent-a.jsonl`, [user(1, 'p', { isSidechain: true }), asst(2)]);
  chmodSync(join(dir, session, 'subagents', 'locked'), 0o000);
  try {
    assert.equal(measure(dir, plans(`ab12 abcd0001 ${T(10)}\n`), rx).data[0].lanesSkipped, 1);
  } finally { chmodSync(join(dir, session, 'subagents', 'locked'), 0o700); rmSync(dir, { recursive: true }); }
});
