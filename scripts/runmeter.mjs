#!/usr/bin/env node
/**
 * runmeter: what each Claude Code session that started lanes cost, and which model each lane ran on, read
 * from Claude Code transcripts and, with --prs, from gh. Prints counts, durations, days and model names;
 * with --labels also the first two words of the command that opened each session. Transcripts may hold
 * private data: no other message text is printed, and --prompts writes prompts to a folder, never to stdout.
 *
 *   node scripts/runmeter.mjs <projects dir> <project key> [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--json] [--labels] [--prs <repo dir>] [--prompts <out dir>] [--plans|--retro|--replay <regex>]
 *
 * <projects dir>: Claude Code's `projects/` folder.
 * <project key>: a substring; every project folder whose name holds it is read (a main checkout and its worktrees,
 *   and also a sibling project whose folder name holds it).
 *
 * Full reference (figures, lane kinds, privacy rules, limits): scripts/runmeter.md.
 */
import { readFileSync, readdirSync, lstatSync, statSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { DEFAULTS as PLANTIME_DEFAULTS, classify, records, ts } from './plantime.mjs';

export const USAGE = 'node scripts/runmeter.mjs <projects dir> <project key> [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--json] [--labels] [--prs <repo dir>] [--prompts <out dir>] [--plans|--retro|--replay <regex>]';

// The lane-kind patterns, tried in this order on a lane's prompt, ignoring case.
export const DEFAULTS = {
  replay: String.raw`\breplay(s|ed|ing)?\b.{0,40}\b(plan|planning|method|ticket)|\b(scorer|proxy)\b.{0,60}\b(rubric|trap|rulings?)\b`,
  retro: String.raw`docs/retros/`,
  plans: String.raw`docs/plans/`,
};
export const KINDS = ['plan/run', 'retro', 'replay', 'other'];
export const CLASSES = ['opus', 'sonnet', 'haiku', 'other', 'unknown'];
export const GH_ARGS = ['pr', 'list', '--state', 'merged', '--limit', '1000', '--json', 'number,createdAt,mergedAt,reviews,comments,statusCheckRollup'];

/** Unusable input: the CLI prints the message and exits 2. A message never names a path. */
export class Unusable extends Error {}

// --- small helpers ----------------------------------------------------------------------------

/** An fs error as its code alone: the message would name the path. */
const why = (e) => (e && typeof e.code === 'string' ? e.code : 'unreadable');
const isA = (path, kind) => {
  try { const st = lstatSync(path); return kind === 'dir' ? st.isDirectory() : st.isFile(); } catch { return false; } // a link is neither
};
/** A folder the owner named on the command line: a link to a folder is one. */
const isFolder = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };
const listing = (dir, what) => {
  try { return readdirSync(dir).sort(); } catch (e) { throw new Unusable(`${what} not readable: ${why(e)}`); }
};
const round1 = (v) => Math.round(v * 10) / 10;
const minutes = (ms) => round1(ms / 60000);

const WORD = /^(?=.{1,60}$)[\w.:@[\]-]+(\/[\w.:@[\]-]+)?$/;
/** A value from a record or a meta file, printed only when it is one plain word; anything else is `?`. A word holds
 *  one slash at most, never first or last: a model id such as `vendor/model` prints, a path of more parts does not. */
export const word = (v) => (typeof v === 'string' && WORD.test(v) ? v : '?');
/** The first 8 characters of an id, kept to letters, digits, `_` and `-`: safe to print and to name a folder. */
export const short = (id) => String(id).slice(0, 8).replace(/[^A-Za-z0-9_-]/g, '_');

export const dayOf = (t) => new Date(t).toISOString().slice(0, 10); // a UTC day
export const halfMonth = (day) => `${day.slice(0, 7)} ${Number(day.slice(8)) <= 15 ? 'first' : 'second'} half`;
export const isDay = (s) => /^\d{4}-\d\d-\d\d$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && dayOf(Date.parse(`${s}T00:00:00Z`)) === s;
const inWindow = (day, since, until) => (since === null || day >= since) && (until === null || day <= until);

// The text of a record's content, text blocks only (plantime.mjs has one, not exported).
const textOf = (c) =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n') : '';

// --- models and tokens ------------------------------------------------------------------------

const SYNTHETIC = '<synthetic>';
/** The class of a resolved model id: by the family name it holds. A missing id, or one that is not one plain word, is `unknown`. */
export function modelClass(id) {
  const s = word(id).toLowerCase();
  if (s === '?') return 'unknown';
  return ['opus', 'sonnet', 'haiku'].find((c) => s.includes(c)) ?? 'other';
}

// The four token figures, and the usage field each one reads.
const FIELDS = { input: 'input_tokens', output: 'output_tokens', cacheWrite: 'cache_creation_input_tokens', cacheRead: 'cache_read_input_tokens' };
export const zero = () => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
const addTokens = (into, from) => { for (const k of Object.keys(FIELDS)) into[k] += from[k]; return into; };

/**
 * What a transcript's assistant records say: messages, tokens, models, requested models and effort values.
 * A message id is counted once. Its records repeat its usage, with the output count growing, so the highest
 * value of each field is kept. A record with no message id is a message of its own. A record whose model is
 * `<synthetic>` was written by the harness, not by a model: it is not counted.
 */
export function usage(recs) {
  const messages = new Map(); // message id -> its four token counts
  const models = new Map(); // model id -> messages
  const requested = new Set(), effort = new Set();
  for (const d of recs) {
    const m = d.type === 'assistant' && d.message && typeof d.message === 'object' ? d.message : null;
    if (!m || m.model === SYNTHETIC) continue;
    const id = typeof m.id === 'string' ? m.id : {};
    if (!messages.has(id)) {
      messages.set(id, zero());
      models.set(word(m.model), (models.get(word(m.model)) ?? 0) + 1);
    }
    const kept = messages.get(id);
    for (const [k, field] of Object.entries(FIELDS)) {
      const v = m.usage?.[field];
      if (Number.isFinite(v) && v > kept[k]) kept[k] = v;
    }
    if (d.requestedModel !== undefined) requested.add(word(d.requestedModel));
    if (d.effort !== undefined) effort.add(word(d.effort));
  }
  const tokens = [...messages.values()].reduce(addTokens, zero());
  const byMessages = [...models.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id); // most messages first
  return { messages: messages.size, tokens, models: byMessages, requested: [...requested], effort: [...effort] };
}

// --- the owner --------------------------------------------------------------------------------

const PLANTIME_RX = Object.fromEntries(Object.entries(PLANTIME_DEFAULTS).map(([k, v]) => [k, new RegExp(v)]));
const LABEL_WORD = /^[A-Za-z0-9._-]{1,24}$/;
/** A label: the first two words of a command's arguments, read up to the first word that is not 1 to 24 of
 *  `[A-Za-z0-9._-]`. No slash, so no path. '' when the first word already fails. Printed only with --labels. */
export function cleanLabel(text) {
  const words = (typeof text === 'string' ? text.trim() : '').split(/\s+/).slice(0, 2);
  const stop = words.findIndex((w) => !LABEL_WORD.test(w));
  return (stop < 0 ? words : words.slice(0, stop)).join(' ');
}

// A skill command as the harness writes it (CLI 2.1.3xx): the record opens with `<command-message>`.
// A built-in command (`/clear`, `/add-dir <path>`) opens with `<command-name>` and is not read.
const SKILL_COMMAND = /^\s*<command-message>/;
const COMMAND_ARGS = /<command-args>([^<]*)<\/command-args>/;
/** The words after the command name in a skill-command record; '' for any other record. */
export function commandWords(d) {
  const text = textOf(d.message?.content);
  return SKILL_COMMAND.test(text) ? (COMMAND_ARGS.exec(text)?.[1] ?? '').trim() : '';
}

/**
 * One session's owner turns, and the label of the skill command that opened it. An owner record is one that
 * plantime's `classify` reads as `human`. A run of owner records is one turn. Records that only accompany
 * (`defer`, `compaction`) neither start nor end a turn.
 */
export function owner(recs) {
  const kinds = new Map();
  let turns = 0, inTurn = false, label = '';
  for (const d of recs) {
    const k = classify(d, kinds, PLANTIME_RX);
    if (k === 'defer' || k === 'compaction') continue;
    if (k === 'human') {
      if (!inTurn) turns++;
      if (!label) label = cleanLabel(commandWords(d));
    }
    inTurn = k === 'human';
  }
  return { turns, label };
}

// --- lanes and sessions -----------------------------------------------------------------------

/** A lane's kind: a guess from its prompt. The first pattern that matches decides. */
export function laneKind(prompt, rx) {
  if (rx.replay.test(prompt)) return 'replay';
  if (rx.retro.test(prompt)) return 'retro';
  if (rx.plans.test(prompt)) return 'plan/run';
  return 'other';
}

const LANE_FILE = /^agent-.+\.jsonl$/;
/** Regular `agent-*.jsonl` files under the session's `subagents/`, at any depth. A link is never followed.
 *  (plantime.mjs has a walker, not exported, that takes every `*.jsonl`; a workflow's journal is not a lane.) */
export function agentFiles(sessionPath) {
  const out = [];
  const walk = (dir) => {
    let names;
    try { names = readdirSync(dir).sort(); } catch { return; }
    for (const f of names) {
      const p = join(dir, f);
      if (isA(p, 'dir')) walk(p);
      else if (LANE_FILE.test(f) && isA(p, 'file')) out.push(p);
    }
  };
  const folder = sessionPath.replace(/\.jsonl$/, '');
  if (isA(folder, 'dir') && isA(join(folder, 'subagents'), 'dir')) walk(join(folder, 'subagents'));
  return out;
}

/** The lane's meta file, beside its transcript; `{}` when it is absent or unreadable. */
function readMeta(lanePath) {
  const p = lanePath.replace(/\.jsonl$/, '.meta.json');
  try {
    const m = isA(p, 'file') ? JSON.parse(readFileSync(p, 'utf8')) : null;
    return m && typeof m === 'object' ? m : {};
  } catch { return {}; }
}

/** The lane's prompt: its user records before its first answer, joined with a blank line. A meta record is left out.
 *  A lane started by a workflow tool has two such records: a relay of the owner's request, then the lane's own task. */
export function lanePrompt(recs) {
  const answer = recs.findIndex((d) => d.type === 'assistant');
  const before = recs.slice(0, answer < 0 ? recs.length : answer).filter((d) => d.type === 'user' && !d.isMeta);
  return before.map((d) => textOf(d.message?.content)).filter(Boolean).join('\n\n');
}

/** One lane's figures, with its prompt kept apart: the prompt is never part of the figures. */
export function readLane(path, rx) {
  const { recs, bad } = records(path);
  if (!recs.length) return null;
  const meta = readMeta(path);
  const prompt = lanePrompt(recs);
  const u = usage(recs);
  const t0 = ts(recs[0].timestamp);
  const lane = {
    agent: short(basename(path).slice('agent-'.length)),
    kind: laneKind(prompt, rx),
    agentType: word(meta.agentType),
    launchModel: word(meta.model),
    requested: u.requested,
    resolved: u.models,
    modelClass: modelClass(u.models[0]),
    effort: u.effort,
    day: dayOf(t0),
    minutes: minutes(ts(recs[recs.length - 1].timestamp) - t0),
    messages: u.messages,
    tokens: u.tokens,
    launchedWithDefaults: typeof meta.launchedWithDefaults === 'boolean' ? meta.launchedWithDefaults : null,
    recordsNotRead: bad,
  };
  return { lane, prompt, t0 };
}

/**
 * One session with its lanes. Null when it has no lane file, or nothing in the window. Throws when it cannot
 * be measured. With a window (`since`, `until`: UTC days or null), the session's figures come from its records
 * dated inside the window, and a lane is kept, whole, when its first record is dated inside it.
 */
export function readSession(path, rx, since = null, until = null) {
  const files = agentFiles(path);
  if (!files.length) return null;
  const { recs: all, bad } = records(path);
  if (!all.length) throw new Error('no usable record');
  const recs = all.filter((d) => inWindow(dayOf(ts(d.timestamp)), since, until));
  const lanes = [];
  let skipped = 0;
  for (const f of files) {
    let r = null;
    try { r = readLane(f, rx); } catch { /* counted just below */ }
    if (!r) skipped++;
    else if (inWindow(r.lane.day, since, until)) lanes.push(r);
  }
  if (skipped === files.length) throw new Error('no readable lane');
  if (!lanes.length || !recs.length) return null;
  lanes.sort((a, b) => a.t0 - b.t0);
  const u = usage(recs), o = owner(recs);
  const t0 = ts(recs[0].timestamp);
  const id = short(basename(path));
  const session = {
    id,
    day: dayOf(t0),
    label: o.label || null,
    minutes: minutes(ts(recs[recs.length - 1].timestamp) - t0),
    models: u.models,
    modelClasses: [...new Set(u.models.map(modelClass))],
    effort: u.effort,
    ownerTurns: o.turns,
    messages: u.messages,
    tokens: u.tokens,
    laneTokens: lanes.reduce((sum, r) => addTokens(sum, r.lane.tokens), zero()),
    lanes: lanes.map((r) => r.lane),
    laneFilesSkipped: skipped,
    recordsNotRead: lanes.reduce((n, r) => n + r.lane.recordsNotRead, bad),
  };
  return { session, t0, prompts: lanes.map((r) => ({ session: id, agent: r.lane.agent, text: r.prompt })) };
}

/** Every session with a lane, from every project folder whose name holds the key, oldest first. A folder that cannot
 *  be listed is skipped and counted; when none can be, there is nothing to measure. */
export function collect(projectsDir, key, { rx, since = null, until = null, labels = false }) {
  if (!key) throw new Unusable('project key is empty');
  const folders = listing(projectsDir, 'projects dir').filter((n) => n.includes(key) && isA(join(projectsDir, n), 'dir'));
  if (!folders.length) throw new Unusable('no project folder matches the key');
  const files = { projectFolders: folders.length, projectFoldersSkipped: 0, sessionFiles: 0, sessionFilesSkipped: 0 };
  const found = [];
  let failure;
  for (const folder of folders) {
    let names;
    try { names = readdirSync(join(projectsDir, folder)).sort(); } catch (e) { files.projectFoldersSkipped++; failure = e; continue; } // skipped and counted
    for (const f of names) {
      const p = join(projectsDir, folder, f);
      if (!f.endsWith('.jsonl') || !isA(p, 'file')) continue;
      files.sessionFiles++;
      let r = null;
      try { r = readSession(p, rx, since, until); } catch { files.sessionFilesSkipped++; }
      if (r) found.push(r);
    }
  }
  if (files.projectFoldersSkipped === folders.length) throw new Unusable(`no matching project folder is readable: ${why(failure)}`);
  found.sort((a, b) => a.t0 - b.t0);
  if (!labels) for (const r of found) r.session.label = null;
  return { sessions: found.map((r) => r.session), prompts: found.flatMap((r) => r.prompts), files };
}

// --- the figures ------------------------------------------------------------------------------

/** plan/run lanes by half-month and model class, and the last day one ran on a Sonnet- or Haiku-class model. */
export function laneTable(sessions) {
  const rows = new Map();
  const otherModels = {};
  let lastSonnetOrHaikuDay = null;
  for (const l of sessions.flatMap((s) => s.lanes)) {
    if (l.kind !== 'plan/run') continue;
    const key = halfMonth(l.day);
    if (!rows.has(key)) rows.set(key, Object.fromEntries(CLASSES.map((c) => [c, 0])));
    rows.get(key)[l.modelClass]++;
    if (l.modelClass === 'other') otherModels[l.resolved[0]] = (otherModels[l.resolved[0]] ?? 0) + 1;
    const weaker = l.modelClass === 'sonnet' || l.modelClass === 'haiku';
    if (weaker && (lastSonnetOrHaikuDay === null || l.day > lastSonnetOrHaikuDay)) lastSonnetOrHaikuDay = l.day;
  }
  const sorted = [...rows.entries()].sort(([a], [b]) => (a < b ? -1 : 1)); // "first half" sorts before "second half"
  return { rows: sorted.map(([name, counts]) => ({ halfMonth: name, ...counts })), lastSonnetOrHaikuDay, otherModels };
}

export function totals(sessions, files) {
  const t = { ...files, sessions: sessions.length, lanes: 0, lanesByKind: Object.fromEntries(KINDS.map((k) => [k, 0])), ownerTurns: 0,
    sessionMinutes: 0, laneMinutes: 0, tokens: zero(), laneTokens: zero(), laneFilesSkipped: 0, recordsNotRead: 0 };
  for (const s of sessions) {
    t.ownerTurns += s.ownerTurns;
    t.sessionMinutes += s.minutes;
    addTokens(t.tokens, s.tokens);
    addTokens(t.laneTokens, s.laneTokens);
    t.laneFilesSkipped += s.laneFilesSkipped;
    t.recordsNotRead += s.recordsNotRead;
    for (const l of s.lanes) { t.lanes++; t.lanesByKind[l.kind]++; t.laneMinutes += l.minutes; }
  }
  return { ...t, sessionMinutes: round1(t.sessionMinutes), laneMinutes: round1(t.laneMinutes) };
}

// --- pull requests ----------------------------------------------------------------------------

const size = (v) => (Array.isArray(v) ? v.length : 0);
/** The median: the middle value, or the mean of the two middle values of an even count; null of none.
 *  (plantime's `waitStats` takes the lower of the two, so it is not used here.) */
export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) : null;
}

/** Figures for merged pull requests, from gh's JSON. `since` and `until` are UTC days or null, compared with
 *  the day each pull request was opened. */
export function prStats(list, since, until) {
  const rows = [], spans = [];
  for (const p of list) {
    const opened = Date.parse(p?.createdAt), merged = Date.parse(p?.mergedAt);
    if (Number.isNaN(opened) || Number.isNaN(merged) || !inWindow(dayOf(opened), since, until)) continue;
    spans.push(merged - opened);
    rows.push({ number: Number.isInteger(p.number) ? p.number : '?', minutes: minutes(merged - opened),
      reviews: size(p.reviews), comments: size(p.comments), checks: size(p.statusCheckRollup) });
  }
  rows.sort((a, b) => a.number - b.number);
  const withAny = (k) => rows.filter((r) => r[k] > 0).length;
  return { rows, merged: rows.length, medianMinutes: spans.length ? minutes(median(spans)) : null,
    withReview: withAny('reviews'), withComment: withAny('comments'), withCheck: withAny('checks'), limitReached: list.length >= 1000 };
}

/** Runs gh in the repository folder. Any failure is a reason, never an error: the rest of the report stands. */
export function prs(repoDir, since, until, env = process.env) {
  let out;
  try {
    out = execFileSync('gh', GH_ARGS, { cwd: repoDir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28, timeout: 120000 });
  } catch (e) {
    // With no exit code and no error code, a signal ended it.
    return { notRun: e?.code === 'ENOENT' ? 'gh not found' : typeof e?.status === 'number' ? `gh exited ${e.status}` : `gh failed: ${typeof e?.code === 'string' ? e.code : 'killed'}` };
  }
  let list;
  try { list = JSON.parse(out); } catch { return { notRun: 'gh output is not JSON' }; }
  return Array.isArray(list) ? prStats(list, since, until) : { notRun: 'gh output is not a list' };
}

// --- prompts ----------------------------------------------------------------------------------

// The variables that move git's idea of the repository: the --prompts check asks git without them, then with them.
export const GIT_REPOSITORY_VARS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_NAMESPACE', 'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM', 'GIT_PREFIX'];
// git's word that no repository is here, found by looking up to the root. Not its word for a `.git` file that leads nowhere.
const NO_REPOSITORY = /^fatal: not a git repository \(or any /mi;
const IN_REPOSITORY = '--prompts folder is inside a git repository: refused';

/** True when the folder, or a folder above it, holds an entry named `.git`: a work tree, whatever git can read of it. */
function underDotGit(real) {
  for (let at = real; ; at = dirname(at)) {
    try { lstatSync(join(at, '.git')); return true; } catch (e) {
      if (e?.code !== 'ENOENT' && e?.code !== 'ENOTDIR') throw new Unusable('--prompts folder not checked: a folder above it cannot be looked at');
    }
    if (dirname(at) === at) return false;
  }
}

/** Refuses a --prompts folder unless it is new or empty, and outside any git repository: a prompt can hold private text. */
export function checkPromptsDir(outDir) {
  const target = resolve(outDir);
  let at = target, real;
  try {
    let st = null;
    try { st = lstatSync(target); } catch (e) { if (e?.code !== 'ENOENT' && e?.code !== 'ENOTDIR') throw e; } // absent: it is new
    if (st && !(st.isDirectory() && readdirSync(target).length === 0)) throw new Unusable('--prompts folder exists and is not an empty real folder: refused'); // a link is not one
    // The nearest folder that exists, links followed: a link into a repository is checked where it leads.
    while (!isFolder(at) && dirname(at) !== at) at = dirname(at);
    real = realpathSync(at);
  } catch (e) { throw e instanceof Unusable ? e : new Unusable(`--prompts folder not usable: ${why(e)}`); }
  if (underDotGit(real)) throw new Unusable(IN_REPOSITORY);
  const ask = (env) => spawnSync('git', ['-C', real, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8', env: { ...env, LC_ALL: 'C' } });
  // First without the caller's variables, so none of them can hide a repository; git looks past a mount point.
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !GIT_REPOSITORY_VARS.includes(k)));
  const r = ask({ ...clean, GIT_DISCOVERY_ACROSS_FILESYSTEM: '1' });
  if (r.error?.code === 'ENOENT') throw new Unusable('--prompts folder not checked: git not found');
  // Any answer means a repository: `true` in a work tree, `false` in git's own folder. An ignore rule changes nothing.
  if (r.status === 0) throw new Unusable(IN_REPOSITORY);
  if (r.error || !NO_REPOSITORY.test(r.stderr)) throw new Unusable('--prompts folder not checked: git failed');
  // Then with them, when any is set: a repository that only the caller's variables name is a repository too.
  if (GIT_REPOSITORY_VARS.some((k) => process.env[k] !== undefined) && ask(process.env).status === 0) throw new Unusable(IN_REPOSITORY);
}

/** Writes each lane's prompt, as sent, to `<out dir>/<session8>/<agent8>.prompt.txt`. Prompt files are private: a folder
 *  is made with mode 0700, a file with mode 0600, and a file is only ever created (`wx`), never written over. Nothing is
 *  deleted; two lanes that share a name in one run get `-2`, `-3`. Returns the number of files written. */
export function writePrompts(outDir, prompts) {
  const taken = new Set();
  try {
    for (const p of prompts) {
      const dir = join(outDir, p.session);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      let name = `${p.agent}.prompt.txt`;
      for (let n = 2; taken.has(join(dir, name)); n++) name = `${p.agent}-${n}.prompt.txt`;
      taken.add(join(dir, name));
      writeFileSync(join(dir, name), p.text, { mode: 0o600, flag: 'wx' });
    }
  } catch (e) { throw new Unusable(`--prompts folder not writable: ${why(e)}`); }
  return taken.size;
}

// --- text output ------------------------------------------------------------------------------

const count = (v) => (v < 1000 ? String(v) : v < 999950 ? `${(v / 1e3).toFixed(1)}k` : `${(v / 1e6).toFixed(1)}M`);
const tokensText = (t) => `in ${count(t.input)} out ${count(t.output)} cache-write ${count(t.cacheWrite)} cache-read ${count(t.cacheRead)}`;
const list = (xs) => (xs.length ? xs.join('/') : '?');

function tableLines(t) {
  const cells = [['half-month', ...CLASSES], ...t.rows.map((r) => [r.halfMonth, ...CLASSES.map((c) => String(r[c]))])];
  const width = cells[0].map((_, i) => Math.max(...cells.map((row) => row[i].length)));
  const others = Object.entries(t.otherModels).map(([id, n]) => `${id} ${n}`);
  return [
    '# plan/run lanes by half-month and model class (UTC days)',
    ...cells.map((row) => row.map((c, i) => (i ? c.padStart(width[i]) : c.padEnd(width[i]))).join('  ')),
    `last day a plan/run lane ran on a Sonnet- or Haiku-class model: ${t.lastSonnetOrHaikuDay ?? 'none'}`,
    ...(others.length ? [`other models: ${others.join(', ')}`] : []),
  ];
}

function sessionLine(s) {
  return [`## ${s.id} ${s.day}${s.label ? ` [${s.label}]` : ''}`, `${s.minutes}m`, `orchestrator ${list(s.models)}`, `effort ${list(s.effort)}`, `messages ${s.messages}`,
    `owner turns ${s.ownerTurns}`, `lanes ${s.lanes.length}`, `orchestrator tokens ${tokensText(s.tokens)}`, `lane tokens ${tokensText(s.laneTokens)}`].join(' · ');
}

function laneLine(l) {
  const defaults = l.launchedWithDefaults === null ? [] : [`launched with defaults: ${l.launchedWithDefaults ? 'yes' : 'no'}`];
  return [`   ${l.agent} ${l.day} ${l.kind} ${l.agentType}`, `launch ${l.launchModel}`, `requested ${list(l.requested)}`, `resolved ${list(l.resolved)}`, `effort ${list(l.effort)}`,
    `${l.minutes}m`, `messages ${l.messages}`, `tokens ${tokensText(l.tokens)}`, ...defaults].join(' · ');
}

function totalLines(t) {
  const kinds = KINDS.map((k) => `${k} ${t.lanesByKind[k]}`).join(', ');
  const unread = [t.projectFoldersSkipped && `project folders skipped ${t.projectFoldersSkipped}`, t.sessionFilesSkipped && `session files skipped ${t.sessionFilesSkipped}`,
    t.laneFilesSkipped && `lane files skipped ${t.laneFilesSkipped}`, t.recordsNotRead && `records not read ${t.recordsNotRead}`].filter(Boolean);
  return [
    `# TOTAL: sessions with lanes ${t.sessions} (session files ${t.sessionFiles}, project folders ${t.projectFolders}) · lanes ${t.lanes} (${kinds}) · owner turns ${t.ownerTurns} · session minutes ${t.sessionMinutes} · lane minutes ${t.laneMinutes} (summed, overlap not removed)`,
    `  orchestrator tokens ${tokensText(t.tokens)}`,
    `  lane tokens ${tokensText(t.laneTokens)}`,
    ...(unread.length ? [`  ${unread.join(' · ')}`] : []),
  ];
}

function prLines(p) {
  if (p.notRun) return [`prs: NOT RUN (${p.notRun})`];
  return [
    ...p.rows.map((r) => `   #${r.number} · open to merge ${r.minutes}m · reviews ${r.reviews} · comments ${r.comments} · checks ${r.checks}`),
    `prs: ${p.merged} merged · median open to merge ${p.medianMinutes ?? '?'}m · with any review ${p.withReview} · with any comment ${p.withComment} · with any check ${p.withCheck}${p.limitReached ? ' · gh limit of 1000 reached: older ones are missing' : ''}`,
  ];
}

export function render(report) {
  return [
    ...tableLines(report.lanesByHalfMonth),
    ...report.sessions.flatMap((s) => [sessionLine(s), ...s.lanes.map(laneLine)]),
    ...totalLines(report.totals),
    ...(report.prs ? prLines(report.prs) : []),
    ...(report.promptFilesWritten === undefined ? [] : [`prompts: ${report.promptFilesWritten} files written`]),
  ];
}

// --- the command line -------------------------------------------------------------------------

const VALUE_FLAGS = ['since', 'until', 'prs', 'prompts', 'plans', 'retro', 'replay'];
export function parseArgs(args) {
  const o = { pos: [], json: false, labels: false, since: null, until: null, prs: null, prompts: null, rx: { ...DEFAULTS } };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i].startsWith('--') ? args[i].slice(2) : null;
    if (flag === null) o.pos.push(args[i]);
    else if (flag === 'json') o.json = true;
    else if (flag === 'labels') o.labels = true;
    else if (!VALUE_FLAGS.includes(flag)) throw new Unusable(`usage: ${USAGE}`);
    else if (args[i + 1] === undefined) throw new Unusable(`--${flag} needs a value`);
    else if (flag in DEFAULTS) o.rx[flag] = args[++i];
    else o[flag] = args[++i];
  }
  if (o.pos.length !== 2) throw new Unusable(`usage: ${USAGE}`);
  for (const k of ['since', 'until']) if (o[k] !== null && !isDay(o[k])) throw new Unusable(`--${k} is not a date (YYYY-MM-DD)`);
  if (o.since !== null && o.until !== null && o.since > o.until) throw new Unusable('--since is after --until');
  return o;
}

export function main(argv) {
  const o = parseArgs(argv.slice(2));
  const rx = Object.fromEntries(Object.entries(o.rx).map(([k, v]) => {
    try { return [k, new RegExp(v, 'i')]; } catch { throw new Unusable(`--${k} is not a valid regex`); }
  }));
  if (o.prs !== null && !isFolder(o.prs)) throw new Unusable('--prs folder not found');
  if (o.prompts !== null) checkPromptsDir(o.prompts);
  const { sessions, prompts, files } = collect(o.pos[0], o.pos[1], { rx, since: o.since, until: o.until, labels: o.labels });
  const report = { lanesByHalfMonth: laneTable(sessions), sessions, totals: totals(sessions, files) };
  if (o.prs !== null) report.prs = prs(o.prs, o.since, o.until);
  if (o.prompts !== null) {
    checkPromptsDir(o.prompts); // again, just before writing: reading and gh took time
    report.promptFilesWritten = writePrompts(o.prompts, prompts);
  }
  return o.json ? [JSON.stringify(report, null, 1)] : render(report);
}

const isMain = () => {
  try { return [realpathSync(process.argv[1]), resolve(process.argv[1])].some((p) => import.meta.url === pathToFileURL(p).href); } catch { return false; }
};
if (process.argv[1] && isMain()) {
  try { console.log(main(process.argv).join('\n')); } catch (e) {
    // Only an Unusable message is printed: any other error's message may quote a record or a path.
    console.error(e instanceof Unusable ? e.message : `runmeter failed: ${typeof e?.name === 'string' ? e.name : 'error'}`);
    process.exit(e instanceof Unusable ? 2 : 1);
  }
}
