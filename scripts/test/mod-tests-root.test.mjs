/**
 * Tests that mod-tests.test.mjs finds the repository from a checkout path
 * holding a space (skills-ob78 review F3).
 *
 * Usage: node --test scripts/test/mod-tests-root.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAN = fileURLToPath(new URL('./mod-tests.test.mjs', import.meta.url));

test('the scan reads the mods from a checkout whose path holds a space', () => {
  const root = join(mkdtempSync(join(tmpdir(), 'ob78-')), 'sp ace');
  try {
    mkdirSync(join(root, 'scripts', 'test'), { recursive: true });
    mkdirSync(join(root, 'mods', 'm', 'tests'), { recursive: true });
    cpSync(SCAN, join(root, 'scripts', 'test', 'mod-tests.test.mjs'));
    writeFileSync(join(root, 'mods', 'm', 'tests', 'a.test.ts'), 'await call()\n');
    // NODE_TEST_CONTEXT unset: with it, the inner node --test skips its files as a recursive run.
    const run = spawnSync(process.execPath, ['--test', 'scripts/test/mod-tests.test.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
    assert.match(run.stdout, /ℹ pass 2\b/, run.stdout + run.stderr);
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    rmSync(join(root, '..'), { recursive: true, force: true });
  }
});
