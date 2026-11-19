#!/usr/bin/env node
/**
 * leakscan: refuses a commit or a push that holds a term from a private list. The list is kept
 * outside the repository. The scan reads added lines, file paths, commit messages and identities.
 *
 *   node scripts/leakscan.mjs (--staged | --message <file> | --range <revs> | --pre-push <remote> | --history | --tree | --files <file>...) [--terms <file>] [--show]
 *
 * Exit 0: no hit. Exit 1: a hit. Exit 2: the scan could not run.
 *
 * Full reference (the list's format, what each mode reads, the hooks, limits): scripts/leakscan.md.
 */
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const USAGE = 'node scripts/leakscan.mjs (--staged | --message <file> | --range <revs> | --pre-push <remote> | --history | --tree | --files <file>...) [--terms <file>] [--show]';

// Where the list is looked for when neither --terms nor LEAKSCAN_TERMS names it.
export const DEFAULT_TERMS = join('.config', 'leakscan', 'terms.txt');
// A plain term shorter than this, once squashed, is matched as written only.
export const SQUASH_MIN = 6;
const MODES = ['--staged', '--message', '--range', '--pre-push', '--history', '--tree', '--files'];

export class Unusable extends Error {}

/** Lower case, with spaces, dots, dashes and underscores dropped. */
export const squash = s => s.toLowerCase().replace(/[\s._-]+/g, '');

/** The list's lines as terms. `repo:` lines are returned unread; loadRepos() reads them. */
export function parseTerms(text, file) {
  const list = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const s = raw.trim();
    if (!s || s.startsWith('#')) return;
    const line = i + 1;
    if (s.startsWith('re:')) {
      try {
        list.push({ line, kind: 're', re: new RegExp(s.slice(3), 'i') });
      } catch (e) {
        throw new Unusable(`${file}:${line}: the regex does not compile (${e.message})`);
      }
    } else if (s.startsWith('cs:')) {
      if (s.length > 3) list.push({ line, kind: 'cs', text: s.slice(3) });
    } else if (s.startsWith('repo:')) {
      list.push({ line, kind: 'repo', path: s.slice(5).trim(), ids: null });
    } else {
      const sq = squash(s);
      list.push({ line, kind: 'text', lower: s.toLowerCase(), squashed: sq.length >= SQUASH_MIN ? sq : null });
    }
  });
  if (!list.length) throw new Unusable(`${file}: the list holds no term`);
  return list;
}

function git(cwd, args, { input, allow = [0] } = {}) {
  const r = spawnSync('git', args, { cwd, input, encoding: 'latin1', maxBuffer: 1 << 30 });
  if (r.error) throw new Unusable(`git ${args[0]}: ${r.error.message}`);
  if (!allow.includes(r.status)) throw new Unusable(`git ${args.join(' ')} failed: ${(r.stderr || '').trim().split('\n')[0]}`);
  return r.stdout;
}

/** Reads the commit ids of every `repo:` line. A folder that is no repository is unusable input. */
export function loadRepos(list, file) {
  for (const t of list) {
    if (t.kind !== 'repo') continue;
    const dir = t.path.startsWith('~') ? join(homedir(), t.path.slice(1)) : t.path;
    if (!existsSync(dir)) throw new Unusable(`${file}:${t.line}: the repo: folder does not exist`);
    const r = spawnSync('git', ['rev-list', '--all'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 30 });
    if (r.error || r.status !== 0) throw new Unusable(`${file}:${t.line}: the repo: folder is not a git repository`);
    const ids = r.stdout.split('\n').filter(Boolean);
    t.ids = ids;
    t.heads = new Map();
    for (const id of ids) {
      const k = id.slice(0, 7);
      if (!t.heads.has(k)) t.heads.set(k, []);
      t.heads.get(k).push(id);
    }
  }
  return list;
}

/** The terms that one line of text holds. */
export function matchLine(text, list) {
  const hits = [];
  let lower = null;
  let squashed = null;
  let hexes = null;
  for (const t of list) {
    let found = null;
    if (t.kind === 're') {
      const m = t.re.exec(text);
      if (m) found = m[0];
    } else if (t.kind === 'cs') {
      if (text.includes(t.text)) found = t.text;
    } else if (t.kind === 'text') {
      lower ??= text.toLowerCase();
      if (lower.includes(t.lower)) found = t.lower;
      else if (t.squashed) {
        squashed ??= squash(text);
        if (squashed.includes(t.squashed)) found = t.squashed;
      }
    } else if (t.kind === 'repo' && t.heads) {
      hexes ??= (text.match(/(?<![0-9a-fA-F])[0-9a-fA-F]{7,40}(?![0-9a-fA-F])/g) || []).map(h => h.toLowerCase());
      for (const h of hexes) {
        if ((t.heads.get(h.slice(0, 7)) || []).some(id => id.startsWith(h))) {
          found = h;
          break;
        }
      }
    }
    if (found !== null) hits.push({ term: t, found });
  }
  return hits;
}

/** The hits of a list of items `{ where, line, text }`. */
export function scan(items, list) {
  const hits = [];
  for (const it of items) for (const h of matchLine(it.text, list)) hits.push({ where: it.where, line: it.line, term: h.term, found: h.found });
  return hits;
}

/** The lines a unified diff adds, each with its file and its line number in the new file. */
export function addedLines(diff, prefix = '') {
  const items = [];
  let file = null;
  let n = 0;
  let inHunk = false;
  for (const l of diff.split('\n')) {
    if (l.startsWith('diff --git ')) {
      file = null;
      inHunk = false;
    } else if (!inHunk && l.startsWith('+++ ')) {
      const p = l.slice(4).replace(/\t$/, '');
      file = p === '/dev/null' ? null : unquote(p).replace(/^b\//, '');
    } else if (l.startsWith('@@ ')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l);
      n = m ? Number(m[1]) : 0;
      inHunk = true;
    } else if (inHunk && l.startsWith('+')) {
      if (file !== null) items.push({ where: prefix + file, line: n, text: l.slice(1) });
      n += 1;
    } else if (inHunk && l.startsWith(' ')) {
      n += 1;
    }
  }
  return items;
}

// git quotes a path that holds special bytes: "a\303\251.txt".
function unquote(p) {
  if (!(p.startsWith('"') && p.endsWith('"'))) return p;
  return p.slice(1, -1).replace(/\\(\d{3}|.)/g, (_, c) => (c.length === 3 ? String.fromCharCode(parseInt(c, 8)) : { n: '\n', t: '\t', '\\': '\\', '"': '"' }[c] ?? c));
}

// push(...list) overflows the stack on a list of some hundred thousand lines.
function add(items, more) {
  for (const m of more) items.push(m);
}

const DIFF = ['--text', '-U0', '--no-color', '--no-ext-diff', '--no-textconv'];
const pathItems = (out, prefix = '') => out.split('\0').filter(Boolean).map(p => ({ where: `${prefix}path ${p}`, line: 0, text: p }));

function stagedItems(cwd) {
  const items = addedLines(git(cwd, ['diff', '--cached', ...DIFF]));
  add(items, pathItems(git(cwd, ['diff', '--cached', '--name-only', '-z', '--no-renames'])));
  for (const who of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    const r = spawnSync('git', ['var', who], { cwd, encoding: 'utf8' });
    if (r.status === 0) items.push({ where: 'identity', line: 0, text: r.stdout.trim().replace(/ \d+ [+-]\d{4}$/, '') });
  }
  return items;
}

function messageItems(file) {
  if (!existsSync(file)) throw new Unusable(`${file}: no such message file`);
  const items = [];
  let n = 0;
  for (const l of readFileSync(file, 'latin1').split('\n')) {
    n += 1;
    // A scissors line ends the message: what follows is the diff that `git commit -v` shows.
    if (/^# -{24} >8 -{24}$/.test(l)) break;
    if (!l.startsWith('#')) items.push({ where: 'message', line: n, text: l });
  }
  return items;
}

function commitItems(cwd, ids) {
  const items = [];
  for (const id of ids) {
    const short = id.slice(0, 10);
    const head = git(cwd, ['show', '-s', '--format=%an <%ae>%n%cn <%ce>%n%B', id]).split('\n');
    items.push({ where: `${short} identity`, line: 0, text: head[0] }, { where: `${short} identity`, line: 0, text: head[1] });
    head.slice(2).forEach((text, i) => items.push({ where: `${short} message`, line: i + 1, text }));
    // -m: a merge is read against each parent, so nothing a merge adds is missed.
    add(items, addedLines(git(cwd, ['diff-tree', '-p', '--root', '-m', '--no-renames', ...DIFF, id]), `${short} `));
    add(items, pathItems(git(cwd, ['diff-tree', '-r', '--root', '-m', '--no-commit-id', '--name-only', '-z', '--no-renames', '--diff-filter=AMCR', id]), `${short} `));
  }
  return items;
}

const revList = (cwd, args) => git(cwd, ['rev-list', ...args]).split('\n').filter(Boolean);

function prePushIds(cwd, remote, stdin) {
  const ids = new Set();
  for (const l of stdin.split('\n')) {
    const f = l.trim().split(/\s+/);
    if (f.length < 4) continue;
    const [, local, , theirs] = f;
    if (/^0+$/.test(local)) continue;
    const args = /^0+$/.test(theirs) ? [local, '--not', `--remotes=${remote}`] : [`${theirs}..${local}`];
    for (const id of revList(cwd, args)) ids.add(id);
  }
  return [...ids];
}

function treeItems(top) {
  const items = [];
  const files = git(top, ['ls-files', '-z']).split('\0').filter(Boolean);
  for (const f of files) {
    items.push({ where: `path ${f}`, line: 0, text: f });
    add(items, fileItems(join(top, f), f));
  }
  return items;
}

function fileItems(file, name = file) {
  let st;
  try {
    st = statSync(file);
  } catch {
    return [];
  }
  if (!st.isFile()) return [];
  return readFileSync(file, 'latin1').split('\n').map((text, i) => ({ where: name, line: i + 1, text }));
}

export function parseArgs(argv) {
  const o = { mode: null, value: null, files: [], terms: null, show: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (MODES.includes(a)) {
      if (o.mode) throw new Unusable('one mode at a time');
      o.mode = a;
      if (['--message', '--range', '--pre-push'].includes(a)) {
        o.value = argv[i += 1];
        if (!o.value || o.value.startsWith('--')) throw new Unusable(`${a} needs a value`);
      }
    } else if (a === '--terms') {
      o.terms = argv[i += 1];
      if (!o.terms) throw new Unusable('--terms needs a file');
    } else if (a === '--show') {
      o.show = true;
    } else if (o.mode === '--files' && !a.startsWith('--')) {
      o.files.push(a);
    } else {
      throw new Unusable(`unknown argument ${a}`);
    }
  }
  if (!o.mode) throw new Unusable('no mode given');
  if (o.mode === '--files' && !o.files.length) throw new Unusable('--files needs a file');
  return o;
}

const inside = (child, parent) => child === parent || child.startsWith(parent + sep);

export function main(argv, io = {}) {
  const cwd = io.cwd || process.cwd();
  const env = io.env || process.env;
  const out = io.out || (s => process.stdout.write(s + '\n'));
  const err = io.err || (s => process.stderr.write(s + '\n'));
  try {
    const o = parseArgs(argv);
    const top = git(cwd, ['rev-parse', '--show-toplevel']).trim();
    const file = resolve(cwd, o.terms || env.LEAKSCAN_TERMS || join(homedir(), DEFAULT_TERMS));
    if (!existsSync(file)) throw new Unusable(`no list of terms at ${file} (give --terms or set LEAKSCAN_TERMS)`);
    if (inside(realpathSync(file), realpathSync(top))) throw new Unusable('the list of terms is inside the repository: keep it outside, or it gets published');
    const list = loadRepos(parseTerms(readFileSync(file, 'utf8'), file), file);
    // A repo: line that names this repository would flag every commit id of its own.
    for (const t of list) if (t.kind === 'repo' && realpathSync(t.path.startsWith('~') ? join(homedir(), t.path.slice(1)) : t.path) === realpathSync(top)) t.heads = null;

    let items;
    if (o.mode === '--staged') items = stagedItems(cwd);
    else if (o.mode === '--message') items = messageItems(resolve(cwd, o.value));
    else if (o.mode === '--range') items = commitItems(cwd, revList(cwd, o.value.split(/\s+/).filter(Boolean)));
    else if (o.mode === '--history') items = commitItems(cwd, revList(cwd, ['--all']));
    else if (o.mode === '--pre-push') items = commitItems(cwd, prePushIds(cwd, o.value, io.stdin ?? readFileSync(0, 'utf8')));
    else if (o.mode === '--tree') items = treeItems(top);
    else {
      items = [];
      for (const f of o.files) {
        const p = resolve(cwd, f);
        if (!existsSync(p)) throw new Unusable(`${f}: no such file`);
        items.push({ where: `path ${f}`, line: 0, text: f });
        add(items, fileItems(p, f));
      }
    }

    const hits = scan(items, list);
    if (!hits.length) return 0;
    const seen = new Set();
    for (const h of hits) {
      const place = h.line ? `${h.where}:${h.line}` : h.where;
      const line = `${place}: term of line ${h.term.line} of the list${o.show ? ` (${h.found})` : ''}`;
      if (!seen.has(line)) out(line);
      seen.add(line);
    }
    err(`leakscan: ${seen.size} hit(s). The list is ${file}. Run again with --show to print what matched.`);
    return 1;
  } catch (e) {
    if (!(e instanceof Unusable)) throw e;
    err(`leakscan: ${e.message}`);
    err(`usage: ${USAGE}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
