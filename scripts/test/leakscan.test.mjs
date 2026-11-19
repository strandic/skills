/**
 * Tests for scripts/leakscan.mjs, the scan that refuses a commit or a push that holds a listed term.
 *
 * Every repository, term list and commit here is synthetic, built in a temporary folder. The terms
 * are made up ("acme", "ACME-12"): no test borrows a real name.
 *
 * `node --test scripts/test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { USAGE, Unusable, squash, parseTerms, matchLine, addedLines, scan, main } from '../leakscan.mjs';

const SCRIPT = fileURLToPath(new URL('../leakscan.mjs', import.meta.url));
const HOOKS = fileURLToPath(new URL('../hooks/', import.meta.url));
const MOVERS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_NAMESPACE', 'GIT_PREFIX'];
for (const k of MOVERS) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test Author', GIT_AUTHOR_EMAIL: 'author@example.invalid',
  GIT_COMMITTER_NAME: 'Test Author', GIT_COMMITTER_EMAIL: 'author@example.invalid',
});
delete process.env.LEAKSCAN_TERMS;

const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), 'leakscan-')));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function repo(files = { 'README.md': 'hello\n' }) {
  const dir = tmp();
  git(dir, 'init', '-q', '-b', 'main');
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

function terms(text) {
  const file = join(tmp(), 'terms.txt');
  writeFileSync(file, text);
  return file;
}

// Runs main() and collects what it would print.
function run(args, { cwd, stdin = '' } = {}) {
  const out = [];
  const err = [];
  const code = main(args, { cwd, stdin, out: s => out.push(s), err: s => err.push(s), env: {} });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('squash drops separators and case', () => {
  assert.equal(squash('Acme-Corp_ware house.io'), 'acmecorpwarehouseio');
});

test('parseTerms: comments, blank lines and the four kinds', () => {
  const list = parseTerms('# a comment\n\nAcme Corp\nre:\\bACME-\\d+\\b\ncs:WidgetCo\n', '/x/terms.txt');
  assert.deepEqual(list.map(t => [t.line, t.kind]), [[3, 'text'], [4, 're'], [5, 'cs']]);
});

test('parseTerms refuses a regex that does not compile, and an empty list', () => {
  assert.throws(() => parseTerms('re:(\n', '/x/t'), Unusable);
  assert.throws(() => parseTerms('# nothing\n\n', '/x/t'), Unusable);
});

test('a plain term is found whatever the case and the separators', () => {
  const list = parseTerms('Acme Corp\n', '/x/t');
  for (const line of ['see acme corp here', 'ACME-CORP', 'acme_corp.io', 'AcmeCorp']) {
    assert.equal(matchLine(line, list).length, 1, line);
  }
  assert.equal(matchLine('a cme co rp', list).length, 1, 'separators are dropped on both sides');
  assert.equal(matchLine('acme and corp', list).length, 0);
});

test('a short plain term is matched as written only, not squashed', () => {
  const list = parseTerms('abc\n', '/x/t');
  assert.equal(matchLine('the ABC of it', list).length, 1);
  assert.equal(matchLine('a-b-c', list).length, 0);
});

test('re: is a regex without case, cs: is exact', () => {
  const list = parseTerms('re:\\bACME-\\d+\\b\ncs:WidgetCo\n', '/x/t');
  assert.equal(matchLine('fixes acme-12', list).length, 1);
  assert.equal(matchLine('fixes ACME-x', list).length, 0);
  assert.equal(matchLine('WidgetCo', list).length, 1);
  assert.equal(matchLine('widgetco', list).length, 0);
});

test('addedLines reads the added lines of a diff with their file and line', () => {
  const diff = [
    'diff --git a/a.txt b/a.txt', '--- a/a.txt', '+++ b/a.txt', '@@ -1,0 +2,2 @@', '+two', '+three',
    '@@ -9 +11 @@', '-old', '+new',
    'diff --git a/b c.txt b/b c.txt', 'new file mode 100644', '--- /dev/null', '+++ b/b c.txt', '@@ -0,0 +1 @@', '+++ plus',
  ].join('\n');
  assert.deepEqual(addedLines(diff), [
    { where: 'a.txt', line: 2, text: 'two' }, { where: 'a.txt', line: 3, text: 'three' }, { where: 'a.txt', line: 11, text: 'new' },
    { where: 'b c.txt', line: 1, text: '++ plus' },
  ]);
});

test('--staged: a clean change passes, a listed term in an added line is refused', () => {
  const dir = repo();
  const list = terms('Acme Corp\n');
  writeFileSync(join(dir, 'notes.md'), 'nothing here\n');
  git(dir, 'add', '-A');
  assert.equal(run(['--staged', '--terms', list], { cwd: dir }).code, 0);
  writeFileSync(join(dir, 'notes.md'), 'nothing here\nseen at acme-corp last week\n');
  git(dir, 'add', '-A');
  const r = run(['--staged', '--terms', list], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /notes\.md:2: term of line 1/);
  assert.ok(!/acme/i.test(r.out), 'the matched text is not printed without --show');
  assert.match(run(['--staged', '--show', '--terms', list], { cwd: dir }).out, /acmecorp/);
});

test('--staged reads added lines only: a term already in the file does not refuse a later change', () => {
  const dir = repo({ 'old.md': 'acme corp was here\nsecond\n' });
  const list = terms('Acme Corp\n');
  writeFileSync(join(dir, 'old.md'), 'acme corp was here\nsecond, changed\n');
  git(dir, 'add', '-A');
  assert.equal(run(['--staged', '--terms', list], { cwd: dir }).code, 0);
});

test('--staged reads the path of a staged file, and a file git takes for binary', () => {
  const dir = repo();
  const list = terms('Acme Corp\n');
  mkdirSync(join(dir, 'acme-corp'));
  writeFileSync(join(dir, 'acme-corp', 'x.md'), 'fine\n');
  git(dir, 'add', '-A');
  const r = run(['--staged', '--terms', list], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /path/);
  git(dir, 'reset', '-q', '--hard');
  writeFileSync(join(dir, 'blob.bin'), Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from('xx acme corp xx\n')]));
  git(dir, 'add', '-A');
  assert.equal(run(['--staged', '--terms', list], { cwd: dir }).code, 1);
});

test('--staged reads the identity the commit would carry', () => {
  const dir = repo();
  const list = terms('re:@acme\\.example\n');
  writeFileSync(join(dir, 'a.md'), 'fine\n');
  git(dir, 'add', '-A');
  git(dir, 'config', 'user.email', 'me@acme.example');
  const saved = { a: process.env.GIT_AUTHOR_EMAIL, c: process.env.GIT_COMMITTER_EMAIL };
  delete process.env.GIT_AUTHOR_EMAIL;
  delete process.env.GIT_COMMITTER_EMAIL;
  try {
    const r = run(['--staged', '--terms', list], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.out, /identity/);
  } finally {
    process.env.GIT_AUTHOR_EMAIL = saved.a;
    process.env.GIT_COMMITTER_EMAIL = saved.c;
  }
});

test('--message reads a commit message file, its comment lines too, up to a scissors line', () => {
  const dir = repo();
  const list = terms('re:\\bACME-\\d+\\b\n');
  const msg = join(tmp(), 'MSG');
  writeFileSync(msg, 'fix the thing\n\n# ------------------------ >8 ------------------------\ndiff --git a/x b/x\n-ACME-3 in the diff that commit -v shows\n');
  assert.equal(run(['--message', msg, '--terms', list], { cwd: dir }).code, 0);
  // git keeps a line that starts with # when the message comes from -m, so the line is read.
  writeFileSync(msg, 'fix the thing\n\n#ACME-1 follow-up\n');
  assert.equal(run(['--message', msg, '--terms', list], { cwd: dir }).code, 1);
  writeFileSync(msg, '# a comment\nfix the thing (ACME-12)\n');
  const r = run(['--message', msg, '--terms', list], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /message:2/);
});

test('--range reads each commit: its added lines, its paths, its message and its identity', () => {
  const dir = repo();
  const list = terms('Acme Corp\n');
  const base = git(dir, 'rev-parse', 'HEAD');
  writeFileSync(join(dir, 'a.md'), 'acme corp\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'second');
  git(dir, 'rm', '-q', 'a.md');
  git(dir, 'commit', '-q', '-m', 'remove it, for Acme-Corp');
  const r = run(['--range', `${base}..HEAD`, '--terms', list], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /a\.md:1/, 'a line added by one commit and removed by the next is still in the history');
  assert.match(r.out, /message:1/);
  assert.equal(run(['--range', `${base}..${base}`, '--terms', list], { cwd: dir }).code, 0);
});

test('--history reads every commit of every branch', () => {
  const dir = repo();
  const list = terms('Acme Corp\n');
  git(dir, 'checkout', '-q', '-b', 'side');
  writeFileSync(join(dir, 'a.md'), 'acme corp\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'on a side branch');
  git(dir, 'checkout', '-q', 'main');
  assert.equal(run(['--history', '--terms', list], { cwd: dir }).code, 1);
});

test('--tree reads every tracked file and its path', () => {
  const dir = repo({ 'docs/a.md': 'one\ntwo acme corp\n' });
  const r = run(['--tree', '--terms', terms('Acme Corp\n')], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /docs\/a\.md:2/);
});

test('--files reads the files named, tracked or not', () => {
  const dir = repo();
  const f = join(tmp(), 'draft.md');
  writeFileSync(f, 'acme corp\n');
  assert.equal(run(['--files', f, '--terms', terms('Acme Corp\n')], { cwd: dir }).code, 1);
});

test('a file of several hundred thousand lines is read, in every mode that reads whole files or whole diffs', () => {
  const big = 'fine\n'.repeat(400000) + 'acme corp\n';
  const dir = repo({ 'big.txt': big });
  const list = terms('Acme Corp\n');
  const tree = run(['--tree', '--terms', list], { cwd: dir });
  assert.equal(tree.code, 1);
  assert.match(tree.out, /big\.txt:400001/);
  assert.equal(run(['--files', join(dir, 'big.txt'), '--terms', list], { cwd: dir }).code, 1);
  assert.equal(run(['--history', '--terms', list], { cwd: dir }).code, 1);
  writeFileSync(join(dir, 'big2.txt'), big);
  git(dir, 'add', '-A');
  assert.equal(run(['--staged', '--terms', list], { cwd: dir }).code, 1);
});

test('repo: flags a commit id of that repository, in full or cut to 7 or more characters', () => {
  const other = repo({ 'x.md': 'private\n' });
  const id = git(other, 'rev-parse', 'HEAD');
  const dir = repo();
  const list = terms(`repo:${other}\n`);
  const own = git(dir, 'rev-parse', 'HEAD');
  for (const [text, code] of [[`see ${id}`, 1], [`see ${id.slice(0, 7)}.`, 1], [`see ${id.slice(0, 12).toUpperCase()}`, 1], [`see ${id.slice(0, 6)}`, 0], [`see ${own}`, 0], ['see deadbeefcafe', 0]]) {
    const f = join(tmp(), 'd.md');
    writeFileSync(f, text + '\n');
    assert.equal(run(['--files', f, '--terms', list], { cwd: dir }).code, code, text);
  }
});

test('unusable input stops with exit 2: no list, a list inside the repository, a missing repo: folder, no mode', () => {
  const dir = repo();
  assert.equal(run(['--staged', '--terms', join(dir, 'nope.txt')], { cwd: dir }).code, 2);
  writeFileSync(join(dir, 'terms.txt'), 'Acme Corp\n');
  const inside = run(['--staged', '--terms', join(dir, 'terms.txt')], { cwd: dir });
  assert.equal(inside.code, 2);
  assert.match(inside.err, /inside the repository/);
  assert.equal(run(['--staged', '--terms', terms(`repo:${join(dir, 'missing')}\n`)], { cwd: dir }).code, 2);
  assert.equal(run(['--terms', terms('x-term\n')], { cwd: dir }).code, 2);
  assert.equal(run(['--staged', '--tree', '--terms', terms('x-term\n')], { cwd: dir }).code, 2);
  assert.equal(run(['--staged', '--terms', terms('x-term\n')], { cwd: tmp() }).code, 2, 'not a git repository');
});

test('the list is taken from LEAKSCAN_TERMS when --terms is not given', () => {
  const dir = repo();
  const f = join(tmp(), 'd.md');
  writeFileSync(f, 'acme corp\n');
  const out = [];
  const code = main(['--files', f], { cwd: dir, stdin: '', out: s => out.push(s), err: () => {}, env: { LEAKSCAN_TERMS: terms('Acme Corp\n') } });
  assert.equal(code, 1);
});

test('--pre-push reads the pushed refs from stdin: a new branch, an update and a deletion', () => {
  const remote = tmp();
  git(remote, 'init', '-q', '--bare');
  const dir = repo();
  git(dir, 'remote', 'add', 'origin', remote);
  git(dir, 'push', '-q', 'origin', 'main');
  const list = terms('Acme Corp\n');
  const zero = '0'.repeat(40);
  const base = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-q', '-b', 'topic');
  writeFileSync(join(dir, 'a.md'), 'acme corp\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'bad');
  const bad = git(dir, 'rev-parse', 'HEAD');
  assert.equal(run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: `refs/heads/topic ${bad} refs/heads/topic ${zero}\n` }).code, 1, 'a new branch');
  assert.equal(run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: `refs/heads/main ${bad} refs/heads/main ${base}\n` }).code, 1, 'an update');
  assert.equal(run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: `(delete) ${zero} refs/heads/topic ${base}\n` }).code, 0, 'a deletion');
  assert.equal(run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: '' }).code, 0, 'nothing pushed');
});

test('the three hooks refuse a commit and a push through git itself', () => {
  const remote = tmp();
  git(remote, 'init', '-q', '--bare');
  const dir = repo();
  git(dir, 'remote', 'add', 'origin', remote);
  git(dir, 'config', 'core.hooksPath', HOOKS);
  const env = { ...process.env, LEAKSCAN_TERMS: terms('Acme Corp\nre:\\bACME-\\d+\\b\n') };
  const g = (...args) => spawnSync('git', args, { cwd: dir, env, encoding: 'utf8' });
  writeFileSync(join(dir, 'a.md'), 'acme corp\n');
  g('add', '-A');
  const c1 = g('commit', '-q', '-m', 'bad content');
  assert.notEqual(c1.status, 0, c1.stderr);
  writeFileSync(join(dir, 'a.md'), 'fine\n');
  g('add', '-A');
  assert.notEqual(g('commit', '-q', '-m', 'closes ACME-7').status, 0);
  assert.equal(g('commit', '-q', '-m', 'fine').status, 0);
  assert.equal(g('push', '-q', 'origin', 'main').status, 0);
  writeFileSync(join(dir, 'b.md'), 'acme corp\n');
  g('add', '-A');
  assert.equal(g('commit', '-q', '--no-verify', '-m', 'hooks skipped').status, 0);
  const p = g('push', '-q', 'origin', 'main');
  assert.notEqual(p.status, 0, 'the push hook catches what a skipped commit hook let through');
  assert.equal(spawnSync('git', ['ls-remote', remote, 'refs/heads/main'], { encoding: 'utf8' }).stdout.slice(0, 40), git(dir, 'rev-parse', 'HEAD~1'));
});

test('the script run as a program gives the same exit codes', () => {
  const dir = repo();
  const f = join(tmp(), 'd.md');
  writeFileSync(f, 'acme corp\n');
  const list = terms('Acme Corp\n');
  assert.equal(spawnSync('node', [SCRIPT, '--files', f, '--terms', list], { cwd: dir }).status, 1);
  assert.equal(spawnSync('node', [SCRIPT, '--tree', '--terms', list], { cwd: dir }).status, 0);
  assert.equal(spawnSync('node', [SCRIPT], { cwd: dir }).status, 2);
});

test('scan() returns hits with the place, the line and the list line', () => {
  const list = parseTerms('Acme Corp\n', '/x/t');
  assert.deepEqual(scan([{ where: 'a.md', line: 4, text: 'acme corp' }, { where: 'a.md', line: 5, text: 'fine' }], list).map(h => [h.where, h.line, h.term.line]), [['a.md', 4, 1]]);
});


// ---- what the review of 2026-11-19 found ----

test('a term with an accent is found, in a file, a staged change and a message', () => {
  const dir = repo();
  const list = terms('Café Acme\n');
  const f = join(tmp(), 'd.md');
  writeFileSync(f, 'chez café acme hier\n');
  assert.equal(run(['--files', f, '--terms', list], { cwd: dir }).code, 1);
  writeFileSync(join(dir, 'n.md'), 'chez CAFÉ-ACME\n');
  git(dir, 'add', '-A');
  assert.equal(run(['--staged', '--terms', list], { cwd: dir }).code, 1);
  writeFileSync(f, 'pour Café Acme\n');
  assert.equal(run(['--message', f, '--terms', list], { cwd: dir }).code, 1, 'the accent written as a separate mark');
});

test('a plain term is found through the separators people really write', () => {
  const list = parseTerms('Acme Corp\nAcme Co\n', '/x/t');
  for (const line of ['acme corp', 'acme–corp', 'acme/corp', "acme'corp", "Acme Corp's", 'acme%20corp', 'acme+corp', 'acme, corp', 'acme & corp'.replace(' & ', '&'), 'me@acme-corp.example', 'AcmeCo']) {
    assert.ok(matchLine(line, list).length >= 1, line);
  }
  assert.equal(matchLine('acme and corp', list).length, 0);
});

test('a file in UTF-16 is read', () => {
  const dir = repo();
  const f = join(tmp(), 'd.txt');
  writeFileSync(f, Buffer.from('﻿see acme corp and ACME-12\n', 'utf16le'));
  const r = run(['--files', f, '--show', '--terms', terms('Acme Corp\nre:\\bACME-\\d+\\b\n')], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /line 1 of the list/);
  assert.match(r.out, /line 2 of the list/);
});

// A repository with a bare remote, and what a pre-push hook would be given for one ref.
function pushed() {
  const remote = tmp();
  git(remote, 'init', '-q', '--bare');
  const dir = repo();
  git(dir, 'remote', 'add', 'origin', remote);
  git(dir, 'push', '-q', 'origin', 'main');
  git(dir, 'fetch', '-q', 'origin');
  return { dir, remote, zero: '0'.repeat(40) };
}

test('a tag is read: its message, its tagger, and a file or a folder it points at', () => {
  const { dir, zero } = pushed();
  const list = terms('Acme Corp\n');
  git(dir, 'tag', '-a', 'v1', '-m', 'release for acme corp');
  const tag = git(dir, 'rev-parse', 'refs/tags/v1');
  const push = (ref, id) => run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: `${ref} ${id} ${ref} ${zero}\n` });
  const r = push('refs/tags/v1', tag);
  assert.equal(r.code, 1);
  assert.match(r.out, /v1 tag/);
  assert.equal(run(['--history', '--terms', list], { cwd: dir }).code, 1);
  git(dir, 'tag', '-d', 'v1');
  assert.equal(run(['--history', '--terms', list], { cwd: dir }).code, 0);
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: dir, input: 'acme corp in a file\n', encoding: 'utf8' }).trim();
  git(dir, 'tag', 'b1', blob);
  assert.equal(push('refs/tags/b1', blob).code, 1);
  assert.equal(run(['--history', '--terms', list], { cwd: dir }).code, 1);
  git(dir, 'tag', '-d', 'b1');
  writeFileSync(join(dir, 'tf.md'), 'acme corp in a folder\n');
  git(dir, 'add', '-A');
  const tree = git(dir, 'write-tree');
  git(dir, 'reset', '-q', '--hard');
  git(dir, 'tag', 't1', tree);
  assert.equal(push('refs/tags/t1', tree).code, 1);
});

test('the name of a pushed branch or tag is read, and so is every ref name in --history', () => {
  const { dir, zero } = pushed();
  const list = terms('Acme Corp\n');
  const head = git(dir, 'rev-parse', 'HEAD');
  const r = run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: `refs/heads/topic ${head} refs/heads/acme-corp-pilot ${zero}\n` });
  assert.equal(r.code, 1);
  assert.match(r.out, /ref name/);
  assert.ok(!/acme/i.test(r.out), 'the name is not printed without --show');
  git(dir, 'branch', 'acme-corp-pilot');
  assert.equal(run(['--history', '--terms', list], { cwd: dir }).code, 1);
});

test('a push reads every commit when the tracking refs do not describe where it goes', () => {
  const { dir, remote, zero } = pushed();
  const list = terms('Acme Corp\n');
  // The commit is known to origin's tracking refs, as when it was fetched from a private place.
  writeFileSync(join(dir, 'a.md'), 'acme corp\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'private work');
  const id = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'update-ref', 'refs/remotes/origin/feat', id);
  const line = `refs/heads/feat ${id} refs/heads/feat ${zero}\n`;
  assert.equal(run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: line }).code, 0, 'one address: the tracking refs are trusted');
  git(dir, 'config', 'remote.origin.pushurl', join(remote, '..', 'elsewhere.git'));
  assert.equal(run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: line }).code, 1, 'pushed to another address than it is fetched from');
  git(dir, 'config', '--unset', 'remote.origin.pushurl');
  assert.equal(run(['--pre-push', remote, '--terms', list], { cwd: dir, stdin: line }).code, 1, 'pushed to a bare address');
});

test('a forced push over a commit this repository does not hold is read, not refused as unusable', () => {
  const { dir } = pushed();
  const list = terms('Acme Corp\n');
  writeFileSync(join(dir, 'a.md'), 'fine\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'mine');
  const id = git(dir, 'rev-parse', 'HEAD');
  assert.equal(run(['--pre-push', 'origin', '--terms', list], { cwd: dir, stdin: `refs/heads/main ${id} refs/heads/main ${'1234567890'.repeat(4)}\n` }).code, 0);
});

test('--range reads the identity, a path with clean content, and what a merge adds', () => {
  const dir = repo();
  const base = git(dir, 'rev-parse', 'HEAD');
  mkdirSync(join(dir, 'acme-corp'));
  writeFileSync(join(dir, 'acme-corp', 'x.md'), 'fine\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'a path');
  const pathHit = run(['--range', `${base}..HEAD`, '--terms', terms('Acme Corp\n')], { cwd: dir });
  assert.equal(pathHit.code, 1);
  assert.match(pathHit.out, /path/);
  assert.equal(run(['--range', `${base}..HEAD`, '--terms', terms('re:@example\\.invalid\n')], { cwd: dir }).code, 1, 'the identity');
  // A merge whose resolution adds a line that neither side holds.
  git(dir, 'checkout', '-q', '-b', 'side', base);
  writeFileSync(join(dir, 's.md'), 'side\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'side');
  git(dir, 'checkout', '-q', 'main');
  git(dir, 'merge', '-q', '--no-commit', '--no-ff', 'side');
  writeFileSync(join(dir, 'm.md'), 'widgetco only in the merge\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'merge');
  const m = run(['--range', 'HEAD^1..HEAD', '--terms', terms('widgetco\n')], { cwd: dir });
  assert.equal(m.code, 1);
  assert.match(m.out, /m\.md:1/);
});

test('--tree reads what is tracked: a link, a file missing from the folder, a name with an accent, a path', () => {
  const dir = repo({ 'café.txt': 'acme corp\n' });
  const list = terms('Acme Corp\n');
  assert.match(run(['--tree', '--terms', list], { cwd: dir }).out, /café\.txt:1/);
  const d2 = repo({ 'gone.md': 'acme corp\n' });
  rmSync(join(d2, 'gone.md'));
  assert.equal(run(['--tree', '--terms', list], { cwd: d2 }).code, 1);
  const d3 = repo();
  symlinkSync('acme corp target', join(d3, 'lnk'));
  git(d3, 'add', '-A');
  assert.equal(run(['--tree', '--terms', list], { cwd: d3 }).code, 1);
  const d4 = repo({ 'acme-corp/a.md': 'fine\n' });
  const r = run(['--tree', '--terms', list], { cwd: d4 });
  assert.equal(r.code, 1);
  assert.ok(!/acme/i.test(r.out), 'a path that holds the term is not printed without --show');
  assert.match(run(['--tree', '--show', '--terms', list], { cwd: d4 }).out, /acme-corp\/a\.md/);
});

test('--files reads the name of the file, and refuses a folder', () => {
  const dir = repo();
  const list = terms('Acme Corp\n');
  const d = tmp();
  writeFileSync(join(d, 'acme-corp.md'), 'fine\n');
  assert.equal(run(['--files', join(d, 'acme-corp.md'), '--terms', list], { cwd: dir }).code, 1);
  assert.equal(run(['--files', d, '--terms', list], { cwd: dir }).code, 2);
});

test('--staged reads the committer as well as the author', () => {
  const dir = repo();
  writeFileSync(join(dir, 'a.md'), 'fine\n');
  git(dir, 'add', '-A');
  const saved = process.env.GIT_COMMITTER_EMAIL;
  process.env.GIT_COMMITTER_EMAIL = 'me@acme.example';
  try {
    assert.equal(run(['--staged', '--terms', terms('re:@acme\\.example\n')], { cwd: dir }).code, 1);
  } finally {
    process.env.GIT_COMMITTER_EMAIL = saved;
  }
});

test('--terms wins over LEAKSCAN_TERMS, and a list that is a folder is unusable', () => {
  const dir = repo();
  const f = join(tmp(), 'd.md');
  writeFileSync(f, 'acme corp\n');
  const code = main(['--files', f, '--terms', terms('widgetco\n')], { cwd: dir, stdin: '', out: () => {}, err: () => {}, env: { LEAKSCAN_TERMS: terms('Acme Corp\n') } });
  assert.equal(code, 0);
  assert.equal(run(['--files', f, '--terms', tmp()], { cwd: dir }).code, 2);
});

test('a repo: line that names the scanned repository is skipped from a worktree of it too', () => {
  const dir = repo();
  const id = git(dir, 'rev-parse', 'HEAD');
  const wt = join(tmp(), 'wt');
  git(dir, 'worktree', 'add', '-q', wt, '-b', 'side');
  const f = join(tmp(), 'd.md');
  writeFileSync(f, `follow-up to ${id.slice(0, 9)}\n`);
  assert.equal(run(['--files', f, '--terms', terms(`repo:${dir}\nwidgetco\n`)], { cwd: wt }).code, 0);
});

test('a repository in a folder with an accent in its name is scanned', () => {
  const dir = join(tmp(), 'été');
  mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'a.md'), 'acme corp\n');
  git(dir, 'add', '-A');
  assert.equal(run(['--staged', '--terms', terms('Acme Corp\n')], { cwd: dir }).code, 1);
  assert.equal(run(['--tree', '--terms', terms('Acme Corp\n')], { cwd: dir }).code, 1);
});

test('hooks copied outside the repository work in a worktree of a branch that has no scripts folder', () => {
  const home = tmp();
  mkdirSync(join(home, 'hooks'));
  writeFileSync(join(home, 'leakscan.mjs'), readFileSync(SCRIPT));
  for (const h of ['pre-commit', 'commit-msg', 'pre-push']) {
    writeFileSync(join(home, 'hooks', h), readFileSync(join(HOOKS, h)));
    chmodSync(join(home, 'hooks', h), 0o755);
  }
  const dir = repo();
  git(dir, 'config', 'core.hooksPath', join(home, 'hooks'));
  const wt = join(tmp(), 'wt');
  git(dir, 'worktree', 'add', '-q', wt, '-b', 'old');
  const env = { ...process.env, LEAKSCAN_TERMS: terms('Acme Corp\n') };
  writeFileSync(join(wt, 'a.md'), 'acme corp\n');
  spawnSync('git', ['add', '-A'], { cwd: wt, env });
  assert.notEqual(spawnSync('git', ['commit', '-q', '-m', 'bad'], { cwd: wt, env }).status, 0);
  // A partial commit uses a temporary index: the hook must read that one.
  writeFileSync(join(wt, 'b.md'), 'fine\n');
  spawnSync('git', ['add', 'b.md'], { cwd: wt, env });
  assert.equal(spawnSync('git', ['commit', '-q', '-m', 'only b', '--only', 'b.md'], { cwd: wt, env }).status, 0);
  assert.notEqual(spawnSync('git', ['commit', '-q', '-m', 'only a', '--only', 'a.md'], { cwd: wt, env }).status, 0);
});

const DOC = readFileSync(new URL('../leakscan.md', import.meta.url), 'utf8');
const SRC = readFileSync(SCRIPT, 'utf8');

test('doc: the usage line is the same in the header, the code and scripts/leakscan.md', () => {
  const header = SRC.slice(0, SRC.indexOf('*/'));
  assert.ok(header.includes(USAGE.replace(/^node /, 'node ')), 'the header holds the usage line');
  assert.ok(DOC.includes(USAGE), 'the reference holds the usage line');
  assert.ok(header.includes('Full reference') && header.includes('scripts/leakscan.md'));
});

test('doc: scripts/leakscan.md names every option, every kind of list line and every exit code', () => {
  for (const flag of USAGE.match(/--[a-z-]+/g)) assert.ok(DOC.includes('`' + flag), flag);
  for (const kind of ['`re:', '`cs:', '`repo:']) assert.ok(DOC.includes(kind), kind);
  for (const code of ['| 0 |', '| 1 |', '| 2 |']) assert.ok(DOC.includes(code), code);
});

test('doc: neither the script, its reference nor the hooks hold a home path', () => {
  for (const text of [SRC, DOC]) assert.ok(!/\/Users\/|\/home\//.test(text));
});
