import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { instrumentDigest, instrumentFiles } from '../instrument.mjs';

async function suite(files) {
  const root = await mkdtemp(join(tmpdir(), 'instrument-'));
  for (const [p, body] of Object.entries(files)) {
    await mkdir(join(root, p, '..'), { recursive: true });
    await writeFile(join(root, p), body);
  }
  return root;
}

test('digest is stable across calls and independent of readdir order', async () => {
  const a = await suite({ 'b/case.yaml': 'x', 'a/graders/g.md': 'y', 'conditions/treatment/SKILL.md': 'z' });
  const d1 = await instrumentDigest(a);
  const d2 = await instrumentDigest(a);
  assert.equal(d1, d2);
  assert.match(d1, /^[0-9a-f]{64}$/);
  await rm(a, { recursive: true });
});

test('a one-byte change to any instrument file changes the digest', async () => {
  const a = await suite({ 'c/graders/g.md': 'pass', 'conditions/placebo/SKILL.md': 'p' });
  const before = await instrumentDigest(a);
  await writeFile(join(a, 'c/graders/g.md'), 'pass!');
  assert.notEqual(await instrumentDigest(a), before);
  await rm(a, { recursive: true });
});

test('results/ and node_modules/ are not part of the instrument', async () => {
  const a = await suite({ 'c/case.yaml': 'x' });
  const before = await instrumentDigest(a);
  await suiteInto(a, { 'results/treatment.json': '{}', 'fixtures/node_modules/x.js': '1' });
  assert.equal(await instrumentDigest(a), before);
  assert.deepEqual((await instrumentFiles(a)).map((p) => p.slice(a.length + 1)), ['c/case.yaml']);
  await rm(a, { recursive: true });
});

test('suite-root README.md and PRE-REGISTRATION.md are prose, not instrument; nested READMEs are', async () => {
  const a = await suite({ 'c/case.yaml': 'x', 'prompt-fixtures/README.md': 'r' });
  const before = await instrumentDigest(a);
  await suiteInto(a, { 'README.md': 'prose', 'PRE-REGISTRATION.md': 'amended' });
  assert.equal(await instrumentDigest(a), before);
  await writeFile(join(a, 'prompt-fixtures/README.md'), 'r2');
  assert.notEqual(await instrumentDigest(a), before);
  await rm(a, { recursive: true });
});

test('renaming a file changes the digest even with identical bytes', async () => {
  const a = await suite({ 'c/graders/one.md': 'same' });
  const b = await suite({ 'c/graders/two.md': 'same' });
  assert.notEqual(await instrumentDigest(a), await instrumentDigest(b));
  await rm(a, { recursive: true }); await rm(b, { recursive: true });
});

async function suiteInto(root, files) {
  for (const [p, body] of Object.entries(files)) {
    await mkdir(join(root, p, '..'), { recursive: true });
    await writeFile(join(root, p), body);
  }
}
