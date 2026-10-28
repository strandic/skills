/**
 * Tests for the marketplace manifest: every entry names a plugin that exists.
 *
 * `claude plugin validate .` reads the manifest's shape but not whether each
 * `source` holds a plugin, so a mistyped path would ship an entry that cannot
 * install. This pins the path, the name and the version, entry by entry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const readJson = async path => JSON.parse(await readFile(join(ROOT, path), 'utf8'));

test('every marketplace entry names a plugin.json with the same name and version', async () => {
  const { plugins } = await readJson('.claude-plugin/marketplace.json');
  assert.ok(plugins.length > 0);
  for (const entry of plugins) {
    const manifest = await readJson(join(entry.source, '.claude-plugin/plugin.json'));
    assert.deepEqual([manifest.name, manifest.version], [entry.name, entry.version], entry.source);
  }
});

test('the companion mod is listed beside strandic', async () => {
  const { plugins } = await readJson('.claude-plugin/marketplace.json');
  assert.deepEqual(plugins.map(p => [p.name, p.source]), [
    ['strandic', './'],
    ['shawarma-companion', './mods/shawarma-companion'],
  ]);
});
