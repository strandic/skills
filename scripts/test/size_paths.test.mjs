/**
 * Tests for scripts/size_paths.py: it replaces only an output folder that is its own.
 *
 * The script used to delete whatever folder its second argument named.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../size_paths.py', import.meta.url));
const PATHS = ['interview-brief', 'plan-brief', 'plan-questions', 'retro', 'run'];

/** A temporary folder holding a small skill; removed when the test ends. */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'szp-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const src = join(root, 'skill');
  mkdirSync(src);
  writeFileSync(join(src, 'SKILL.md'), '---\nname: stew\ndescription: x\n---\nStir the stew.\n');
  for (const f of ['plan.md', 'run.md', 'retro.md']) writeFileSync(join(src, f), `# ${f}\nOne line.\n`);
  return { root, src };
}

const run = (...args) => spawnSync('python3', ['-B', SCRIPT, ...args], { encoding: 'utf8' });

function refused(r, what) {
  assert.equal(r.status, 2, `${what}: ${r.stdout}${r.stderr}`);
  assert.doesNotMatch(r.stderr, /Traceback/, what);
}

test('writes one throwaway skill per load path into a new folder', (t) => {
  const { root, src } = fixture(t);
  const out = join(root, 'out');
  const r = run(src, out);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(join(out, 'skills')).sort(), PATHS);
  assert.match(r.stdout, /plan-brief \d+ words/);
});

test('replaces its own earlier output, and fills an existing empty folder', (t) => {
  const { root, src } = fixture(t);
  const out = join(root, 'out');
  assert.equal(run(src, out).status, 0);
  assert.equal(run(src, out).status, 0, 'a second run into its own output');
  assert.equal(run(src, `${out}/`).status, 0, 'the same folder with a trailing slash');
  const empty = join(root, 'empty');
  mkdirSync(empty);
  assert.equal(run(src, empty).status, 0, 'an existing empty folder');
});

test('refuses a folder it did not make, and leaves it as it was', (t) => {
  const { root, src } = fixture(t);
  const kept = join(root, 'kept');
  mkdirSync(kept);
  writeFileSync(join(kept, 'notes.txt'), 'keep me\n');
  const r = run(src, kept);
  refused(r, 'a folder with a file');
  assert.match(r.stderr, /refusing/);
  assert.equal(readFileSync(join(kept, 'notes.txt'), 'utf8'), 'keep me\n');
  assert.ok(!existsSync(join(kept, 'skills')));
});

test('refuses another plugin, whatever its manifest or its skills are named', (t) => {
  const { root, src } = fixture(t);
  // [the manifest's name, a skill's name]: each pair breaks one clause of "this is my own output".
  for (const [name, skill] of [['strandic', 'cooking'], ['szp', 'cooking'], ['strandic', 'run']]) {
    const plugin = join(root, `plugin-${name}-${skill}`);
    mkdirSync(join(plugin, '.claude-plugin'), { recursive: true });
    mkdirSync(join(plugin, 'skills', skill), { recursive: true });
    writeFileSync(join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name }));
    writeFileSync(join(plugin, 'skills', skill, 'SKILL.md'), 'mine\n');
    refused(run(src, plugin), `a plugin named ${name} holding a skill named ${skill}`);
    assert.equal(readFileSync(join(plugin, 'skills', skill, 'SKILL.md'), 'utf8'), 'mine\n');
  }
});

test('refuses its own earlier output once it holds anything the script does not write', (t) => {
  const { root, src } = fixture(t);
  const cases = {
    'a file beside the manifest': (out) => writeFileSync(join(out, '.claude-plugin', 'notes.txt'), 'x\n'),
    'a file beside a SKILL.md': (out) => writeFileSync(join(out, 'skills', 'run', 'notes.txt'), 'x\n'),
    'a folder where a SKILL.md should be': (out) => {
      rmSync(join(out, 'skills', 'run', 'SKILL.md'));
      mkdirSync(join(out, 'skills', 'run', 'SKILL.md'));
      writeFileSync(join(out, 'skills', 'run', 'SKILL.md', 'kept.txt'), 'keep me\n');
    },
  };
  for (const [what, change] of Object.entries(cases)) {
    const out = join(root, what.replace(/[^a-z]/g, '-'));
    assert.equal(run(src, out).status, 0);
    change(out);
    const before = readdirSync(out, { recursive: true }).sort();
    refused(run(src, out), what);
    assert.deepEqual(readdirSync(out, { recursive: true }).sort(), before, `${what}: unchanged`);
  }
});

test('refuses its own earlier output once anything was added to it', (t) => {
  const { root, src } = fixture(t);
  const out = join(root, 'out');
  assert.equal(run(src, out).status, 0);
  writeFileSync(join(out, 'notes.txt'), 'added later\n');
  refused(run(src, out), 'an earlier output with an added file');
  assert.equal(readFileSync(join(out, 'notes.txt'), 'utf8'), 'added later\n');
});

test('refuses a link, a file, an empty argument and a missing argument', (t) => {
  const { root, src } = fixture(t);
  const out = join(root, 'out');
  assert.equal(run(src, out).status, 0);
  const link = join(root, 'link');
  symlinkSync(out, link);
  refused(run(src, link), 'a link to an earlier output');
  refused(run(src, `${link}/`), 'the same link with a trailing slash');
  assert.deepEqual(readdirSync(join(out, 'skills')).sort(), PATHS, 'the linked output is intact');
  const dangling = join(root, 'dangling');
  symlinkSync(join(root, 'nowhere'), dangling);
  refused(run(src, dangling), 'a dangling link');
  assert.ok(!existsSync(join(root, 'nowhere')));
  const file = join(root, 'a-file');
  writeFileSync(file, 'x\n');
  refused(run(src, file), 'a file');
  assert.equal(readFileSync(file, 'utf8'), 'x\n');
  for (const r of [run(src, ''), run('', join(root, 'new')), run(src)]) {
    refused(r, 'an empty or missing argument');
    assert.match(r.stderr, /size_paths\.py <skill dir> <out dir>/);
  }
  assert.ok(!existsSync(join(root, 'new')));
});

test('refuses a skill folder with no SKILL.md, before it replaces anything', (t) => {
  const { root, src } = fixture(t);
  const out = join(root, 'out');
  assert.equal(run(src, out).status, 0);
  const before = readFileSync(join(out, 'skills', 'run', 'SKILL.md'), 'utf8');
  refused(run(join(root, 'no-such-skill'), out), 'a skill folder that does not exist');
  assert.equal(readFileSync(join(out, 'skills', 'run', 'SKILL.md'), 'utf8'), before);
  // A SKILL.md that cannot be read as one is found out before anything is replaced, too.
  const bad = join(root, 'bad-skill');
  mkdirSync(bad);
  writeFileSync(join(bad, 'SKILL.md'), 'no front matter here\n');
  refused(run(bad, out), 'a SKILL.md with no front matter');
  writeFileSync(join(bad, 'SKILL.md'), Buffer.from([0x2d, 0x2d, 0x2d, 0x0a, 0xff, 0xfe, 0x0a, 0x2d, 0x2d, 0x2d, 0x0a]));
  refused(run(bad, out), 'a SKILL.md that is not UTF-8');
  assert.equal(readFileSync(join(out, 'skills', 'run', 'SKILL.md'), 'utf8'), before);
});
