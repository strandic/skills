/**
 * Tests for the mods' own test files: no line starts with the word `void`.
 *
 * A mod test that starts a call with `void` and leaves it running past the
 * test's end has it let go by the test kit about 5 s later; the call then
 * rejects, nothing handles it, and the file fails on "a rejection nothing
 * handled" (skills-ob78). The companion's tests hand such a call to `drop`,
 * which handles the rejection. `claude plugin test` cannot read a test's
 * source, so the check runs here.
 *
 * It reads lines, not code: a line whose text, after leading whitespace, starts
 * with the word `void` fails, inside a string or a comment too. Other ways to
 * leave a call unawaited (a bare call, `x; void y` on one line, a promise kept
 * in an array) are not seen here; they fail under the kit the same way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)); // not URL.pathname: a checkout path may hold a space

/** The `mods/<mod>/tests/*.test.ts(x)` files, a linked mod folder followed, relative to the repository root. */
async function modTests() {
  const out = [];
  for (const mod of await readdir(join(ROOT, 'mods'))) {
    if (!(await stat(join(ROOT, 'mods', mod)).catch(() => null))?.isDirectory()) continue;
    const dir = join('mods', mod, 'tests');
    const names = await readdir(join(ROOT, dir)).catch(() => []);
    for (const name of names) if (/\.test\.tsx?$/.test(name)) out.push(join(dir, name));
  }
  return out.sort();
}

test('the mods have test files to read', async () => {
  assert.ok((await modTests()).length > 0);
});

test('no line of a mod test starts with void (a dropped call\'s rejection ends the file): use drop()', async () => {
  const found = [];
  for (const path of await modTests()) {
    const lines = (await readFile(join(ROOT, path), 'utf8')).split('\n');
    lines.forEach((line, i) => { if (/^\s*void\b/.test(line)) found.push(`${path}:${i + 1}: ${line.trim()}`); });
  }
  assert.deepEqual(found, []);
});
