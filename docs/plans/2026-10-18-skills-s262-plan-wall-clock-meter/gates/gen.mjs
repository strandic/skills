// node gen.mjs <dir> <records> <command length>: one session of alternating Bash calls and results, a plan command first.
import { mkdirSync, writeFileSync } from 'node:fs';
const [, , dir, n, L] = process.argv; mkdirSync(dir, { recursive: true });
const T = (s) => new Date(Date.UTC(2026, 0, 1) + s * 1000).toISOString();
const cmd = ('python3 x ' + 'a'.repeat(Number(L))); // a long command with "python3 " and no .py: the probe regex's worst case
const lines = [JSON.stringify({ type: 'user', timestamp: T(0), message: { content: '<command-args>plan ab12</command-args>' } })];
for (let i = 1; i < Number(n); i += 2) {
  lines.push(JSON.stringify({ type: 'assistant', timestamp: T(i), message: { content: [{ type: 'tool_use', id: 't' + i, name: 'Bash', input: { command: cmd } }] } }));
  lines.push(JSON.stringify({ type: 'user', timestamp: T(i + 1), message: { content: [{ type: 'tool_result', tool_use_id: 't' + i, content: 'x' }] } }));
}
writeFileSync(`${dir}/abcd0001.jsonl`, lines.join('\n') + '\n');
writeFileSync(`${dir}/plans.txt`, `ab12 abcd0001 ${T(Number(n) + 10)}\n`);
