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
import { randomBytes } from 'node:crypto';

export const USAGE = 'node scripts/leakscan.mjs (--staged | --message <file> | --range <revs> | --pre-push <remote> | --history | --tree | --files <file>...) [--terms <file>] [--show]';

// Where the list is looked for when neither --terms nor LEAKSCAN_TERMS names it.
export const DEFAULT_TERMS = join('.config', 'leakscan', 'terms.txt');
// A plain term shorter than this, once squashed, is matched as written only.
export const SQUASH_MIN = 6;
const MODES = ['--staged', '--message', '--range', '--pre-push', '--history', '--tree', '--files'];

export class Unusable extends Error {}

/** The text as it is compared: no NUL byte (UTF-16 text read as bytes holds one after each letter), one form for each letter. */
export const norm = s => (s.includes('\0') ? s.replace(/\0/g, '') : s).normalize('NFKC');

/** Lower case, with everything dropped that is no letter and no digit. A URL escape such as %20 counts as a separator. */
export const squash = s => norm(s).toLowerCase().replace(/%[0-9a-f]{2}/g, ' ').replace(/[^\p{L}\p{N}]+/gu, '');

/** The list's lines as terms. `repo:` lines are returned unread; loadRepos() reads them. */
export function parseTerms(text, file) {
  const list = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const s = raw.replace(/^\uFEFF/, '').trim().normalize('NFKC');
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

function git(cwd, args, { input, allow = [0], buffer = false } = {}) {
  const r = spawnSync('git', args, { cwd, input, encoding: buffer ? undefined : 'utf8', maxBuffer: 1 << 30 });
  if (r.error) throw new Unusable(`git ${args[0]}: ${r.error.message}`);
  if (!allow.includes(r.status)) throw new Unusable(`git ${args.join(' ')} failed: ${String(r.stderr || '').trim().split('\n')[0]}`);
  return r.stdout;
}

/** Reads the commit ids of every `repo:` line. A folder that is no repository is unusable input. */
export function loadRepos(list, file) {
  for (const t of list) {
    if (t.kind !== 'repo') continue;
    const dir = t.path.startsWith('~') ? join(homedir(), t.path.slice(1)) : t.path;
    t.dir = dir;
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
export function matchLine(raw, list) {
  const text = norm(raw);
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

const DIFF = ['--text', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/'];
// A path, a ref name and an identity are items with line 0. `secret` marks an item whose place is itself the text,
// so that the place is printed only with --show.
const pathItems = (out, prefix = '') => out.split('\0').filter(Boolean).map(p => ({ where: `${prefix}path`, line: 0, text: p, secret: true }));
const refItem = name => ({ where: 'ref name', line: 0, text: name, secret: true });
const textItems = (text, where) => text.split('\n').map((t, i) => ({ where, line: i + 1, text: t }));

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
  if (!existsSync(file) || !statSync(file).isFile()) throw new Unusable(`${file}: no such message file`);
  const items = [];
  let n = 0;
  for (const l of readFileSync(file, 'utf8').split('\n')) {
    n += 1;
    // A scissors line ends the message: what follows is the diff that `git commit -v` shows.
    if (/^. -{24} >8 -{24}$/.test(l)) break;
    // A comment line is read too: git keeps it with -m, with another comment character and with some cleanup modes.
    items.push({ where: 'message', line: n, text: l });
  }
  return items;
}

/** What the commits hold: identities, messages, added lines and paths. Two git processes for the whole list. */
function commitItems(cwd, ids) {
  const items = [];
  if (!ids.length) return items;
  const input = ids.join('\n') + '\n';
  // The mark separates the commits in git's output. It is random, so no file and no message can hold it.
  const mark = `leakscan-${randomBytes(12).toString('hex')}`;
  const walk = ['log', '--no-walk=unsorted', '--stdin', '-m', '--root', '--no-renames'];
  const out = git(cwd, [...walk, '-p', ...DIFF, `--format=${mark}%H%n%an <%ae>%n%cn <%ce>%n%B${mark}end`], { input });
  for (const chunk of out.split(new RegExp(`^${mark}(?=[0-9a-f]{40,64}\\n)`, 'm')).slice(1)) {
    const end = chunk.indexOf(`${mark}end`);
    if (end < 0) throw new Unusable('git log gave a commit this scan cannot read');
    const head = chunk.slice(0, end).split('\n');
    const short = head[0].slice(0, 10);
    items.push({ where: `${short} identity`, line: 0, text: head[1] ?? '' }, { where: `${short} identity`, line: 0, text: head[2] ?? '' });
    head.slice(3).forEach((text, i) => items.push({ where: `${short} message`, line: i + 1, text }));
    add(items, addedLines(chunk.slice(end), `${short} `));
  }
  const names = git(cwd, [...walk, '--name-only', '-z', '--diff-filter=AMCRT', `--format=${mark}%H`], { input });
  for (const chunk of names.split(mark).slice(1)) {
    const nl = chunk.search(/[\n\0]/);
    add(items, pathItems(nl < 0 ? '' : chunk.slice(nl + 1).replace(/\n/g, '\0'), `${chunk.slice(0, 10)} `));
  }
  return items;
}

const revList = (cwd, args) => git(cwd, ['rev-list', ...args]).split('\n').filter(Boolean);
const objectType = (cwd, id) => {
  const r = spawnSync('git', ['cat-file', '-t', id], { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** The contents of blobs, read with one git process. `entries` is a list of `{ id, name }`. */
function blobItems(cwd, entries) {
  const items = [];
  if (!entries.length) return items;
  const out = git(cwd, ['cat-file', '--batch'], { input: entries.map(e => e.id).join('\n') + '\n', buffer: true });
  let at = 0;
  for (const e of entries) {
    const nl = out.indexOf(10, at);
    if (nl < 0) throw new Unusable(`git cat-file gave no answer for ${e.name}`);
    const head = out.toString('utf8', at, nl).split(' ');
    if (head[1] !== 'blob') throw new Unusable(`${e.name}: not a file git can read (${head.slice(1).join(' ')})`);
    const size = Number(head[2]);
    add(items, textItems(out.toString('utf8', nl + 1, nl + 1 + size), e.name));
    at = nl + 1 + size + 1;
  }
  return items;
}

function treeEntries(cwd, args) {
  // "<mode> <type> <id>\t<path>" for ls-tree, "<mode> <id> <stage>\t<path>" for ls-files -s.
  return git(cwd, args).split('\0').filter(Boolean).map(l => {
    const [meta, name] = [l.slice(0, l.indexOf('\t')), l.slice(l.indexOf('\t') + 1)];
    const f = meta.split(' ');
    return { mode: f[0], id: f.find(x => /^[0-9a-f]{40,64}$/.test(x)), name };
  });
}

/**
 * What one pushed or listed object holds besides commits: a tag's tagger and message, and the content of a tag
 * that points at a file or a folder. Returns the commit to walk from, or null.
 */
function peel(cwd, id, items, label) {
  let at = id;
  for (let depth = 0; depth < 20; depth += 1) {
    const type = objectType(cwd, at);
    if (type === 'commit') return at;
    if (type === 'tag') {
      const body = git(cwd, ['cat-file', 'tag', at]);
      add(items, textItems(body.replace(/^(tagger .*) \d+ [+-]\d{4}$/m, '$1'), `${label} tag`));
      const m = /^object ([0-9a-f]+)$/m.exec(body);
      if (!m) throw new Unusable(`${label}: a tag this scan cannot read`);
      at = m[1];
    } else if (type === 'blob') {
      add(items, blobItems(cwd, [{ id: at, name: `${label} file` }]));
      return null;
    } else if (type === 'tree') {
      const entries = treeEntries(cwd, ['ls-tree', '-r', '-z', at]).filter(e => e.mode !== '160000');
      for (const e of entries) items.push({ where: `${label} path`, line: 0, text: e.name, secret: true });
      add(items, blobItems(cwd, entries.map(e => ({ id: e.id, name: `${label} ${e.name}` }))));
      return null;
    } else {
      throw new Unusable(`${label}: object ${at.slice(0, 10)} is not in this repository`);
    }
  }
  throw new Unusable(`${label}: tags nested too deep`);
}

/** True when the remote's tracking refs describe the place a push to it goes: a named remote with one address. */
function tracksPushTarget(cwd, remote) {
  const get = key => spawnSync('git', ['config', '--get-all', key], { cwd, encoding: 'utf8' }).stdout.trim();
  return /^[\w.-]+$/.test(remote) && get(`remote.${remote}.url`).split('\n').filter(Boolean).length === 1 && !get(`remote.${remote}.pushurl`);
}

function prePushItems(cwd, remote, stdin) {
  const items = [];
  const starts = [];
  const known = [];
  for (const l of stdin.split('\n')) {
    const f = l.trim().split(/\s+/);
    if (f.length < 4) continue;
    const [localRef, local, remoteRef, theirs] = f;
    items.push(refItem(remoteRef));
    if (/^0+$/.test(local)) continue;
    items.push(refItem(localRef));
    const commit = peel(cwd, local, items, remoteRef.replace(/^refs\/[^/]+\//, ''));
    if (commit) starts.push(commit);
    // What the other side holds at this ref is not sent again, when this repository knows the object.
    if (!/^0+$/.test(theirs) && objectType(cwd, theirs)) known.push(theirs);
  }
  if (!starts.length) return items;
  const not = known.map(k => `^${k}`);
  // The tracking refs of a named remote with one address say what that remote holds. For a bare address, or a
  // remote that is fetched from one place and pushed to another, nothing is assumed and every commit is read.
  const args = tracksPushTarget(cwd, remote) ? [...starts, ...not, '--not', `--remotes=${remote}`] : [...starts, ...not];
  add(items, commitItems(cwd, revList(cwd, args)));
  return items;
}

function historyItems(cwd) {
  const items = [];
  for (const l of git(cwd, ['for-each-ref', '--format=%(objecttype) %(objectname) %(refname)']).split('\n').filter(Boolean)) {
    const [type, id, ...name] = l.split(' ');
    items.push(refItem(name.join(' ')));
    if (type !== 'commit') peel(cwd, id, items, name.join(' ').replace(/^refs\/[^/]+\//, ''));
  }
  add(items, commitItems(cwd, revList(cwd, ['--all'])));
  return items;
}

/** Every tracked file as the index holds it. A link is read as the text it points to; a submodule is a path only. */
function treeItems(top) {
  const entries = treeEntries(top, ['ls-files', '-s', '-z']);
  const items = entries.map(e => ({ where: 'path', line: 0, text: e.name, secret: true }));
  add(items, blobItems(top, entries.filter(e => e.mode !== '160000').map(e => ({ id: e.id, name: e.name }))));
  return items;
}

function fileItems(cwd, f) {
  const p = resolve(cwd, f);
  if (!existsSync(p)) throw new Unusable(`${f}: no such file`);
  if (!statSync(p).isFile()) throw new Unusable(`${f}: not a file (name each file of a folder)`);
  return [{ where: 'file name', line: 0, text: f, secret: true }, ...textItems(readFileSync(p, 'utf8'), f)];
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
    if (!existsSync(file) || !statSync(file).isFile()) throw new Unusable(`no list of terms at ${file} (give --terms or set LEAKSCAN_TERMS)`);
    if (inside(realpathSync(file), realpathSync(top))) throw new Unusable('the list of terms is inside the repository: keep it outside, or it gets published');
    const list = loadRepos(parseTerms(readFileSync(file, 'utf8'), file), file);
    // A repo: line that names this repository, or a worktree of it, would flag every commit id of its own.
    const common = dir => {
      const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: dir, encoding: 'utf8' });
      return r.status === 0 ? realpathSync(r.stdout.trim()) : null;
    };
    const own = common(cwd);
    for (const t of list) if (t.kind === 'repo' && common(t.dir) === own) t.heads = null;

    let items;
    if (o.mode === '--staged') items = stagedItems(cwd);
    else if (o.mode === '--message') items = messageItems(resolve(cwd, o.value));
    else if (o.mode === '--range') items = commitItems(cwd, revList(cwd, o.value.split(/\s+/).filter(Boolean)));
    else if (o.mode === '--history') items = historyItems(cwd);
    else if (o.mode === '--pre-push') items = prePushItems(cwd, o.value, io.stdin ?? readFileSync(0, 'utf8'));
    else if (o.mode === '--tree') items = treeItems(top);
    else {
      items = [];
      for (const f of o.files) add(items, fileItems(cwd, f));
    }

    const seen = new Set();
    for (const it of items) {
      for (const h of matchLine(it.text, list)) {
        const place = it.secret && o.show ? `${it.where} ${it.text}` : it.line ? `${it.where}:${it.line}` : it.where;
        const line = `${place}: term of line ${h.term.line} of the list${o.show ? ` (${h.found})` : ''}`;
        if (!seen.has(line)) out(line);
        seen.add(line);
      }
    }
    if (!seen.size) return 0;
    err(`leakscan: ${seen.size} hit(s). The list is ${file}. Run again with --show to print the term and the place in full.`);
    return 1;
  } catch (e) {
    // Any failure is "the scan could not run", never "a term was found" and never a pass.
    err(`leakscan: ${e instanceof Unusable ? e.message : `stopped on an error (${e && e.message})`}`);
    if (e instanceof Unusable) err(`usage: ${USAGE}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
