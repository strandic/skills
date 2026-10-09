/**
 * Tests that every skill's SKILL.md frontmatter parses as YAML.
 *
 * The skills CLI skips a skill whose frontmatter fails to parse, and `npx skills update`
 * reports only "Failed to update" with no reason. The usual cause is an unquoted value
 * holding ": ", which YAML reads as a new key. v0.6.0 shipped with one.
 *
 * There is no YAML dependency here, so the check is the rule itself: a plain (unquoted)
 * value must not contain ": " or end in ":", and must not start with a YAML indicator.
 *
 * `node --test scripts/test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const skillsDir = new URL('../../skills/', import.meta.url).pathname;
const skills = readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, 'SKILL.md')));

test('there are skills to check', () => {
  assert.ok(skills.length > 0);
});

for (const skill of skills) {
  test(`${skill}: frontmatter values are valid YAML scalars`, () => {
    const text = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(match, 'SKILL.md must open with a --- frontmatter block');
    const keys = [];
    for (const line of match[1].split('\n')) {
      const kv = line.match(/^([A-Za-z][\w-]*): (.*)$/);
      assert.ok(kv, `not a "key: value" line: ${line}`);
      const [, key, value] = kv;
      keys.push(key);
      if (/^["']/.test(value)) {
        const q = value[0];
        assert.ok(value.length > 1 && value.endsWith(q), `${key}: quoted value is not closed`);
        continue;
      }
      assert.ok(!value.includes(': ') && !value.endsWith(':'),
        `${key}: unquoted value contains ": " — wrap it in double quotes`);
      assert.ok(!/^[-?:,\[\]{}#&*!|>%@`]/.test(value),
        `${key}: unquoted value starts with a YAML indicator — wrap it in double quotes`);
    }
    assert.ok(keys.includes('name') && keys.includes('description'), 'name and description are required');
  });
}
