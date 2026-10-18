#!/usr/bin/env node
/**
 * Where a shawarma plan's wall-clock goes, read from Claude Code transcripts.
 * Prints durations and counts only, never message content: transcripts may hold private data.
 *
 *   node scripts/plantime.mjs <transcripts dir> <plans file> [--json] [--suite|--probe|--lint|--vcs <regex>]
 *
 * <transcripts dir> is one project's folder under the Claude Code config dir's `projects/`: one
 * `<session id>.jsonl` per session, its subagents under `<session id>/subagents/`.
 * <plans file> has one plan per line, fields separated by whitespace; a line or field starting with `#` starts a comment:
 *   <ticket> <session id or unique prefix> <brief commit time> [<start time>]
 * <ticket> as typed in the plan command. The session prefix is 4+ characters of 0-9, a-f and `-`.
 * Times are ISO 8601 date-times with an offset or `Z`; the brief commit's is `git log -1 --format=%cI <commit>`.
 * The window starts at the first `plan <ticket>` command in the session before the brief time unless a
 * start time is given; only a command the owner gave counts (no origin or the owner's, its text opening
 * with the command's tag, or a typed `/…shawarma plan <ticket>`), never one a record quotes.
 * Owner turns count the owner's turns whose wait lies inside the window. Records at the opener's own
 * instant are part of the opener; the first owner record after that instant starts a turn even with
 * nothing between, and later owner records with only accompanying records (meta, reminders,
 * compactions) between join the turn before. A turn's wait runs from the last record before it that is
 * not an accompanying one, or with none, from the file's first record; a turn whose wait crosses the
 * window's start is not counted, nor are the owner records that join it. An AskUserQuestion answer is
 * an owner turn; an interrupt (the harness's record, which has no origin) is not. The median of an
 * even count is the lower middle. `timeLimitHits` counts tool calls the harness stopped or moved to the
 * background at their time limit, and background commands it stopped at their background time limit
 * (its notice of it, each notice in a record read alone; only the harness's part of a notice, before the
 * `<result>` a lane wrote, is read). Each call counts
 * once per transcript file, so a call moved at its limit and later stopped at the next is one, whether
 * the notice names it by its call id or by the task id its result carried; a call in the session and
 * its notice in a lane are two files, so two. A call the file does not hold is known by the id the
 * record names, and by the task id once a record has named both; a record naming no id is a call of its
 * own. `unreadableRecords` counts lines that are not JSON and turn records with no real timestamp, in the
 * whole session file and in each lane with a record in the window. A lane file with bad lines and no
 * turn record is a skipped lane; one with no turn record and no bad line (empty, blank, or other record
 * types only) is no lane. Claude Code deletes transcripts after `cleanupPeriodDays` (30 by default), so
 * a plan older than that reads NOT RUN. A plan the meter could not measure for any other reason reads
 * NOT RUN with the error's name, and the other plans still run.
 *
 * Each gap between two consecutive records is charged to the record that ends it (`bucket`).
 * A gap that crosses the window's start or end is dropped, so `attributed` can be less than `wall`.
 * Lane transcripts (subagents with a record in the window) are split the same way and summed; lanes
 * that overlap are counted twice. Symbolic links, and anything named `*.jsonl` that is not a regular
 * file, under `subagents/` are skipped and counted in `lanesSkipped`, as is a session folder that is a
 * link; links are never followed. The plans file is a regular file or a pipe; a pipe that stays empty
 * past 10 s is refused. Errors name no path.
 */
import { readFileSync, readdirSync, lstatSync, realpathSync, statSync, openSync, readSync, closeSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = {
  suite: String.raw`\b(pytest|node --test|npm (run )?test|go test|cargo test)\b`,
  probe: String.raw`uv run[^|;&]*\bpython|python3? [^|;&]*\.py|\bpython3? -c|\bnode -e`,
  lint: String.raw`\b(ruff|eslint|mypy|tsc)\b`,
  vcs: String.raw`^\s*(cd [^&]*&&\s*)?(git|gh|beans)\b`,
};

// The records that wake a waiting session. A record that only accompanies one (isMeta, a
// system reminder) passes its gap on to the next record when that record is one of these.
const WAKE = new Set(['human', 'lane-wait', 'exec-wait', 'other-session-wait', 'idle-for-coordinator', 'scheduled', 'external']);
// origin.kind values typed by the owner; task-notification, peer and coordinator are read below;
// any other kind (a channel, a plugin, a Slack ping, an auto-continuation) is `external`.
const OWNER_ORIGINS = new Set(['human', 'person', 'composer', 'suggestion']);
const READ_ORIGINS = new Set(['task-notification', 'peer', 'coordinator']);
// Leading tags of text the owner typed; any other leading tag with no origin is `external`.
const OWNER_TAGS = /^\s*<(command-name|command-message|command-args|bash-input)>/;
const ACCOMPANYING_TAGS = /^\s*<(system-reminder|local-command-caveat|local-command-stdout|bash-stdout|bash-stderr|fetched-web-content)[\s>]/;
const DEFER = 'defer';
// The harness's words in a background shell's or Monitor's notification (CLI 2.1.302).
const BACKGROUND_TEXT = /Background command "|Monitor event: "|<summary>Monitor/;

export const ts = (s) => Date.parse(s);

/** DEFAULTS.probe without its backtracking: the regex retries `[^|;&]*` from every `uv run` and
 *  `python `, quadratic in a long command. Per separator-free run: the first opener, then a later word. */
export function isProbe(c) {
  for (const seg of c.split(/[|;&]/)) {
    const uv = seg.indexOf('uv run');
    if (uv >= 0) { const r = /\bpython/g; r.lastIndex = uv + 6; if (r.test(seg)) return true; }
    const py = /python3? /.exec(seg);
    if (py && seg.indexOf('.py', py.index + py[0].length) >= 0) return true;
    if (/\bpython3? -c|\bnode -e/.test(seg)) return true;
  }
  return false;
}

export function bashKind(cmd, rx) {
  const c = typeof cmd === 'string' ? cmd : ''; // a command that is not text is no known kind
  if (rx.suite.test(c)) return 'exec:suite';
  if (rx.probe.source === DEFAULTS.probe ? isProbe(c) : rx.probe.test(c)) return 'exec:probe';
  if (rx.vcs.test(c)) return 'vcs/tracker';
  if (rx.lint.test(c)) return 'exec:lint';
  return 'exec:other-shell';
}

export function toolKind(name, input, rx) {
  if (name === 'Bash') return bashKind(input.command, rx);
  if (name === 'WebFetch' || name === 'WebSearch') return 'web';
  if (name === 'Agent' || name === 'Task') return input.run_in_background ? 'lane-launch' : 'lane-fg';
  if (name === 'Workflow') return 'lane-launch';
  if (['Read', 'Grep', 'Glob', 'Edit', 'Write', 'NotebookEdit'].includes(name)) return 'file-io';
  if (name === 'AskUserQuestion') return 'human';
  return 'tool:other';
}

// Text blocks only, and only text: a block whose `text` is not a string reads as empty.
const textOf = (c) =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => (typeof b.text === 'string' ? b.text : '')).join(' ') : '';

// Task ids, per transcript: the call whose result carried each, or the key of a call the transcript
// does not hold. Kept apart from the call ids, so a call id can never be taken for a task id.
const TASKS = new WeakMap();
const tasksOf = (kinds) => { let m = TASKS.get(kinds); if (!m) TASKS.set(kinds, (m = new Map())); return m; };

/** A record's task notifications, each read alone: the text after each `<task-notification>` up to its
 *  close; a record that is one by its origin and holds no tag is one notification. */
const notices = (text) => {
  const parts = text.split('<task-notification>');
  return parts.length > 1 ? parts.slice(1).map((n) => { const e = n.indexOf('</task-notification>'); return e >= 0 ? n.slice(0, e) : n; }) : [text];
};
/** The harness's part of a notification: all before the `<result>`, which a lane's model wrote. */
const head = (n) => { const i = n.indexOf('<result>'); return i >= 0 ? n.slice(0, i) : n; };
const noticeIds = (n) => { const h = head(n); return [h.match(/<tool-use-id>([^<]+)<\/tool-use-id>/)?.[1], h.match(/<task-id>([^<]+)<\/task-id>/)?.[1]]; };

/** The call a task notification reports on: by `<tool-use-id>`, or by the task id its result carried. */
function noticeCall(n, kinds) {
  const [id, task] = noticeIds(n);
  return (id !== undefined && kinds.get(id)) || (task !== undefined && tasksOf(kinds).get(task)?.call) || undefined;
}

/** A task notification's bucket: a background shell or Monitor reports here too, and that wait is on
 *  the command, not a lane. A call this transcript does not hold (another session's, before a resume)
 *  is told by the harness's words. */
function noticeKind(n, kinds) {
  const call = noticeCall(n, kinds);
  if (call) return call.name === 'Bash' || call.name === 'Monitor' ? 'exec-wait' : 'lane-wait';
  return BACKGROUND_TEXT.test(head(n)) ? 'exec-wait' : 'lane-wait';
}

// A tool result's key when its call is not in the transcript; a result naming no call is its own.
const resultKey = (r) => (r.tool_use_id !== undefined ? `id:${r.tool_use_id}` : {});
// The harness's words for a call moved to the background at its limit, with the task id it got.
const MOVED_ID = /^(?:<error>)?Command did not complete within its \d+s timeout and was moved to the background \(ID: ([^)\s]+)\)/;
/** The task id a tool result carries: on its record, or in the harness's moved-to-the-background words. */
function resultTask(d, r, call) {
  const tr = d.toolUseResult && typeof d.toolUseResult === 'object' ? d.toolUseResult : {};
  const moved = call?.name === 'Bash' ? MOVED_ID.exec(typeof r.content === 'string' ? r.content : textOf(r.content))?.[1] : undefined;
  return [tr.taskId, tr.backgroundTaskId, moved].find((v) => typeof v === 'string');
}

/** A record that is the harness's task notification: by its origin, or with no origin, opening with the tag. */
const isNotice = (d, origin, text) => origin === 'task-notification' || (origin === undefined && text.trimStart().startsWith('<task-notification>'));

/** The bucket of the gap a record ends; tool kinds are learnt from assistant records into `kinds`. */
export function classify(d, kinds, rx) {
  const c = d.message?.content;
  if (d.type === 'assistant') {
    for (const b of Array.isArray(c) ? c : []) {
      // A call seen again keeps its first entry, so a call is one object however often it appears.
      if (b?.type === 'tool_use' && b.id !== undefined && !kinds.has(b.id)) kinds.set(b.id, { kind: toolKind(b.name, b.input ?? {}, rx), name: b.name, input: b.input ?? {} });
    }
    return 'model';
  }
  if (Array.isArray(c)) {
    const r = c.find((b) => b?.type === 'tool_result');
    if (r) {
      const call = kinds.get(r.tool_use_id);
      // A background task's later notifications name its task id, not the call.
      const task = resultTask(d, r, call);
      const tasks = tasksOf(kinds);
      if (task !== undefined && !tasks.has(task)) tasks.set(task, { call, key: call ?? resultKey(r) });
      return call?.kind ?? 'tool:other';
    }
  }
  if (d.isCompactSummary) return 'compaction';
  const text = textOf(c);
  const origin = d.origin?.kind;
  // What the owner typed is the owner's, whatever tags or harness words it quotes.
  if (OWNER_ORIGINS.has(origin) && !d.isMeta) return 'human';
  if (d.turnOrigin === 'scheduled' || d.origin?.subkind === 'scheduled-trigger' || /^\s*<tick[\s>]/.test(text)) return 'scheduled';
  if (origin !== undefined && !OWNER_ORIGINS.has(origin) && !READ_ORIGINS.has(origin)) return 'external';
  // The harness writes an interrupt with no origin.
  if (origin === undefined && /^\s*\[Request interrupted by user/.test(text)) return 'interrupt';
  // A record with a harness origin carries its tag anywhere; otherwise the owner may have typed the
  // record, or a skill's text quotes the tag, so a tag counts only opening it. The first match below
  // decides, the record's own origin included: a peer record relaying another session's message is
  // that session's.
  const has = (tag) => (READ_ORIGINS.has(origin) ? text.includes(tag) : text.trimStart().startsWith(tag));
  // A task notification is the harness's report on a call, whatever the command it quotes holds; a
  // peer or coordinator record stays its sender's, whatever the message quotes.
  if (isNotice(d, origin, text)) return noticeKind(notices(text)[0], kinds);
  if (has('<cross-session-message') || has('<teammate-message')) return 'other-session-wait';
  if (origin === 'peer' || has('<agent-message') || /^\s*<remote-review[\w-]*[\s>]/.test(text)) return 'lane-wait';
  if (origin === 'coordinator' || has('<coordinator-relay') || text.trimStart().startsWith('The coordinator sent a message')) return 'idle-for-coordinator';
  if (d.isMeta || ACCOMPANYING_TAGS.test(text)) return DEFER;
  if (OWNER_TAGS.test(text)) return 'human';
  if (/^\s*<[a-zA-Z][\w-]*[\s>]/.test(text)) return 'external';
  if (!text.trim()) return DEFER;
  // In a lane, later plain text is the orchestrator writing to it.
  return d.isSidechain ? 'idle-for-coordinator' : 'human';
}

const ISO_RX = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d+)?)?(Z|[+-](\d\d):(\d\d))$/;
/** An ISO 8601 date-time with an offset or `Z` whose fields name a real instant. */
export function isIso(s) {
  const m = typeof s === 'string' && s.match(ISO_RX);
  if (!m) return false;
  const [y, mo, d, h, mi, se] = m.slice(1, 7).map((v) => Number(v ?? 0));
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return mo >= 1 && mo <= 12 && d >= 1 && d <= days && h < 24 && mi < 60 && se < 60
    && (m[8] === undefined || (Number(m[8]) < 24 && Number(m[9]) < 60)) && !Number.isNaN(Date.parse(s));
}

/** user and assistant records with an ISO timestamp, in time order; unreadable lines and untimed records are counted, not read.
 *  The file is split as bytes, so a transcript past the engine's string limit still reads, up to the 2 GiB
 *  one file read allows; a larger one reads NOT RUN (ERR_FS_FILE_TOO_LARGE). */
export function records(path) {
  const out = [];
  let bad = 0;
  const buf = readFileSync(path);
  let from = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  while (from < buf.length) {
    let to = buf.indexOf(0x0a, from);
    if (to === -1) to = buf.length;
    const start = from;
    from = to + 1;
    let line, d;
    try { line = buf.toString('utf8', start, to); } catch { bad++; continue; } // past the string limit
    if (!line.trim()) continue;
    try { d = JSON.parse(line); } catch { bad++; continue; }
    if (!d || (d.type !== 'user' && d.type !== 'assistant')) continue;
    // A record with no real instant cannot be placed: counted, so its gap is not hidden.
    if (isIso(d.timestamp)) out.push(d); else bad++;
  }
  out.sort((a, b) => ts(a.timestamp) - ts(b.timestamp));
  return { recs: out, bad };
}

/**
 * Splits [t0, t1] of one transcript into buckets. Returns the buckets (ms), the owner turns,
 * the minutes of each owner wait, and the tool calls that hit their time limit.
 */
export function split(recs, t0, t1, rx) {
  const b = new Map();
  const add = (k, g) => { if (g > 0) b.set(k, (b.get(k) ?? 0) + g); };
  const kinds = new Map();
  const waits = [];
  let prev = null, prevWake = null, first = null, last = null, limited = 0, counted = false;
  const limitedCalls = new Set(); // a call moved to the background at its limit, then stopped at the next, counts once
  let carried = []; // [gap, bucket if no wake-up record follows]
  for (const d of recs) {
    const t = ts(d.timestamp);
    const k = classify(d, kinds, rx);
    const inside = prev !== null && t0 <= prev && t <= t1;
    const g = inside ? t - prev : 0;
    if (k === DEFER || k === 'compaction') {
      // A compaction runs on its own while the session idles, or mid-turn; its gap is the
      // compaction's only when no wake-up record comes next.
      carried.push([g, k === DEFER ? 'other' : 'compaction']);
    } else {
      let total = g;
      for (const [cg, fallback] of carried) if (WAKE.has(k)) total += cg; else add(fallback, cg);
      add(k, total);
      // Records at the opener's own instant are part of the opener. A turn's wait runs from the last
      // record that is not an accompanying one, or with none, from the first record; a turn whose wait
      // crosses the window's start is not counted, and owner records joining it are not either.
      if (k === 'human' && t0 < t && t <= t1) {
        const from = prevWake ?? (prev !== null ? first : null);
        if (last !== 'human') { counted = from !== null && t0 <= from; if (counted) waits.push(0); }
        if (counted) waits[waits.length - 1] += total; // waits[i] is the i-th owner turn's wait
      }
      carried = [];
      if (t0 < t && t <= t1) last = k;
      prevWake = t;
    }
    if (t0 <= t && t <= t1) {
      for (const call of limitCalls(d, k, kinds)) if (!limitedCalls.has(call)) { limitedCalls.add(call); limited++; }
    }
    prev = t;
    first ??= t;
  }
  for (const [cg, fallback] of carried) add(fallback, cg);
  return { buckets: b, turns: waits.length, waits, limited };
}

// The harness's own words for a call that ran out of time (CLI 2.1.302), opening the result: moved to
// the background, or stopped (after an optional exit code line). Command output quoting them does not open it.
const LIMIT_TEXT = /^(?:<error>)?(?:Command did not complete within its \d+s timeout and was moved to the background|(?:Exit code \d+\n)?Command timed out after )/;

// The harness's notice for a background command stopped at its own time limit (CLI 2.1.285 and later):
// `<summary>Background command "<command>" was stopped after reaching its background time limit</summary>`.
// The harness does not escape the command, so the summary is read from its first `<summary>` to the last
// `</summary>` of the harness's part. Searches, not a regex: `"[\s\S]*"` would retry from every opener,
// quadratic in a long notice.
const STOPPED_OPEN = '<summary>Background command "';
const STOPPED_END = '" was stopped after reaching its background time limit';
const isStopNotice = (n) => {
  const h = head(n);
  const i = h.indexOf('<summary>');
  const j = h.lastIndexOf('</summary>');
  // The command's two quotes are two characters: one quote cannot open and close it.
  return i >= 0 && h.startsWith(STOPPED_OPEN, i) && j >= i + STOPPED_OPEN.length + STOPPED_END.length && h.startsWith(STOPPED_END, j - STOPPED_END.length);
};

/** The calls a record says ran out of time, by the harness's record of it: a tool result with
 *  `timedOutAfterMs` or its words opening the result, or each of its notices that a background command
 *  was stopped at its background limit. A call the transcript does not hold is keyed by the id the record
 *  names, or by its task id once a record has named both; a record naming none is a call of its own.
 *  Elapsed time never counts. */
function limitCalls(d, k, kinds) {
  if (d.type !== 'user') return [];
  const c = d.message?.content;
  const r = Array.isArray(c) ? c.find((x) => x?.type === 'tool_result') : null;
  const tasks = tasksOf(kinds);
  if (r) {
    const text = typeof r.content === 'string' ? r.content : textOf(r.content);
    const call = kinds.get(r.tool_use_id);
    const hit = typeof d.toolUseResult?.timedOutAfterMs === 'number' || (call?.name === 'Bash' && LIMIT_TEXT.test(text));
    if (!hit) return [];
    const task = resultTask(d, r, call);
    return [call ?? (task !== undefined ? tasks.get(task)?.key : undefined) ?? resultKey(r)];
  }
  const text = textOf(c);
  if ((k !== 'exec-wait' && k !== 'lane-wait') || !isNotice(d, d.origin?.kind, text)) return [];
  return notices(text).filter((n) => isStopNotice(n) && noticeKind(n, kinds) === 'exec-wait').map((n) => {
    const known = noticeCall(n, kinds);
    if (known) return known;
    const [id, task] = noticeIds(n);
    const byTask = task !== undefined ? tasks.get(task)?.key : undefined;
    if (byTask !== undefined) return byTask;
    const key = id !== undefined ? `id:${id}` : task !== undefined ? `task:${task}` : {};
    if (task !== undefined) tasks.set(task, { call: undefined, key });
    return key;
  });
}

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Times of `plan <ticket>` commands in a session: a slash command's args, or a typed `/…shawarma plan <ticket>`. */
export function planStarts(recs, ticket) {
  const t = escapeRx(ticket);
  const args = new RegExp(`<command-args>\\s*plan\\s+${t}(?![\\w-])[^<]*</command-args>`);
  const typed = new RegExp(`^\\s*/(?:[\\w-]+:)?shawarma\\s+plan\\s+${t}(?![\\w-])`);
  const out = [];
  for (const d of recs) {
    if (d.type !== 'user' || d.isSidechain || d.isMeta) continue;
    // Only a command the owner gave: no origin or the owner's, the command's tags opening the text.
    const origin = d.origin?.kind;
    if (origin !== undefined && !OWNER_ORIGINS.has(origin)) continue;
    const text = textOf(d.message?.content);
    if ((OWNER_TAGS.test(text) && args.test(text)) || typed.test(text)) out.push(ts(d.timestamp));
  }
  return out;
}

export function parsePlans(text) {
  const plans = [];
  const seen = new Map();
  for (const [i, raw] of text.replace(/^\uFEFF/, '').split('\n').entries()) {
    const fields = [];
    for (const f of raw.trim().split(/\s+/)) { if (f.startsWith('#')) break; if (f) fields.push(f); }
    if (!fields.length) continue;
    const [ticket, session, brief, start, ...rest] = fields;
    const bad = (why) => { throw new Error(`plans file line ${i + 1}: ${why}`); };
    if (!session || !brief || rest.length) bad('expected <ticket> <session> <brief time> [<start time>]');
    if (!/^[0-9a-f-]{4,}$/.test(session)) bad('session is not 4+ characters of 0-9, a-f and -');
    if (!isIso(brief)) bad('brief time is not an ISO 8601 date-time with an offset');
    if (start !== undefined && !isIso(start)) bad('start time is not an ISO 8601 date-time with an offset');
    const key = `${ticket} ${session}`;
    if (seen.has(key)) bad(`same ticket and session as line ${seen.get(key)}`);
    seen.set(key, i + 1);
    plans.push({ ticket, session, brief: ts(brief), start: start === undefined ? null : ts(start) });
  }
  return plans;
}

/** An fs error as its code alone: the message would name the path. */
const why = (e) => (e && typeof e.code === 'string' ? e.code : 'unreadable');

export function sessionFile(dir, prefix) {
  let names;
  try { names = readdirSync(dir); } catch (e) { throw new Error(`transcripts dir not readable: ${why(e)}`); }
  const hits = [];
  for (const f of names) {
    if (!f.endsWith('.jsonl') || !f.startsWith(prefix)) continue;
    let st;
    try { st = lstatSync(join(dir, f)); } catch (e) { throw new Error(`session transcript not readable: ${why(e)}`); }
    if (st.isFile()) hits.push(f);
  }
  if (hits.length !== 1) throw new Error(`session ${hits.length ? 'prefix is ambiguous' : 'not found'}: ${hits.length} transcripts match`);
  return join(dir, hits[0]);
}

/** Regular `*.jsonl` files under the session's `subagents/`, at any depth; links and other `*.jsonl` skipped and counted. */
function subagentFiles(sessionPath) {
  const out = [];
  let skipped = 0;
  const walk = (d) => {
    let names;
    try { names = readdirSync(d); } catch { skipped++; return; }
    for (const f of names) {
      const p = join(d, f);
      let st;
      try { st = lstatSync(p); } catch { skipped++; continue; }
      if (st.isDirectory()) walk(p);
      else if (st.isFile() && f.endsWith('.jsonl')) out.push(p);
      else if (st.isSymbolicLink() || f.endsWith('.jsonl')) skipped++;
    }
  };
  const folder = sessionPath.replace(/\.jsonl$/, '');
  let st = null;
  try { st = lstatSync(folder); } catch { /* no lanes */ }
  if (st && !st.isDirectory()) return { files: out, skipped: 1 }; // a link is never followed
  if (st) {
    let rs = null;
    try { rs = lstatSync(join(folder, 'subagents')); } catch { /* no lanes */ }
    if (rs?.isDirectory()) walk(join(folder, 'subagents')); else if (rs) skipped++;
  }
  return { files: out, skipped };
}

const min = (ms) => `${Math.round(ms / 60000)}m`;
export function fmt(b) {
  const total = [...b.values()].reduce((a, v) => a + v, 0) || 1;
  return [...b.entries()].sort((x, y) => y[1] - x[1]).filter(([, v]) => v >= 30000)
    .map(([k, v]) => `${k} ${min(v)} (${Math.round((100 * v) / total)}%)`).join(' · ');
}
/** Median and max of the owner waits, by one sort: no spread, so no stack limit on the count. */
export function waitStats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return { median: s.length ? s[Math.floor((s.length - 1) / 2)] : 0, max: s.length ? s[s.length - 1] : 0 };
}

export function measure(dir, plans, rx) {
  try { readdirSync(dir); } catch (e) { throw new Error(`transcripts dir not readable: ${why(e)}`); }
  const lines = [];
  const data = [];
  const all = { main: new Map(), lanes: new Map() };
  const merge = (into, from) => { for (const [k, v] of from) into.set(k, (into.get(k) ?? 0) + v); };
  for (const p of plans) {
    let path;
    const notRun = (why) => { lines.push(`## ${p.ticket}: NOT RUN (${why})`); data.push({ ticket: p.ticket, notRun: why }); };
    try { path = sessionFile(dir, p.session); } catch (e) { notRun(e.message); continue; }
    let recs, bad;
    try { ({ recs, bad } = records(path)); } catch (e) { notRun(`session transcript not readable: ${why(e)}`); continue; }
    try {
      const starts = planStarts(recs, p.ticket).filter((t) => t <= p.brief);
      const t0 = p.start ?? starts[0];
      if (t0 === undefined) { notRun(`no \`plan ${p.ticket}\` command before the brief time${bad ? ` (records not read: ${bad})` : ''}`); continue; }
      if (t0 > p.brief) { notRun('start is after the brief time'); continue; }
      const m = split(recs, t0, p.brief, rx);
      const lanes = new Map();
      let n = 0, limited = m.limited, unread = bad;
      const sub = subagentFiles(path);
      let skipped = sub.skipped;
      for (const f of sub.files) {
        let s;
        let lb;
        try { ({ recs: s, bad: lb } = records(f)); } catch { skipped++; continue; }
        if (!s.length && lb) { skipped++; continue; } // nothing readable: its window cannot be known
        // A lane with a record in the window; only its gaps inside the window are charged.
        if (!s.some((r) => { const t = ts(r.timestamp); return t0 <= t && t <= p.brief; })) continue;
        n++;
        unread += lb;
        const r = split(s, t0, p.brief, rx);
        merge(lanes, r.buckets);
        limited += r.limited;
      }
      const att = [...m.buckets.values()].reduce((a, v) => a + v, 0);
      const commands = starts.filter((t) => t >= t0).length;
      data.push({ ticket: p.ticket, wallMs: p.brief - t0, attributedMs: att, planCommands: commands, ownerTurns: m.turns, ownerWaitsMs: m.waits,
        timeLimitHits: limited, unreadableRecords: unread, lanes: n, lanesSkipped: skipped, buckets: Object.fromEntries(m.buckets), laneBuckets: Object.fromEntries(lanes) });
      const ws = waitStats(m.waits);
      lines.push(`## ${p.ticket}: wall ${min(p.brief - t0)} (attributed ${min(att)})`);
      lines.push(`  plan commands in window: ${commands} · owner turns: ${m.turns} · owner wait per turn: median ${min(ws.median)}, max ${min(ws.max)} · tool calls that hit their time limit: ${limited}${unread ? ` · records not read in the session file and its lanes (bad line or no real timestamp): ${unread}` : ''}${skipped ? ` · lane files skipped: ${skipped}` : ''}`);
      lines.push(`  orchestrator: ${fmt(m.buckets)}`);
      lines.push(`  lanes (${n} transcripts, summed, overlap not removed): ${min([...lanes.values()].reduce((a, v) => a + v, 0))} — ${fmt(lanes)}`);
      merge(all.main, m.buckets);
      merge(all.lanes, lanes);
    } catch (e) { notRun(`could not be measured: ${typeof e?.name === 'string' ? e.name : 'error'}`); } // the name only: a message may quote the record
  }
  for (const [name, g] of [['ORCHESTRATOR, all', all.main], ['LANES, all (summed)', all.lanes]]) {
    const tot = [...g.values()].reduce((a, v) => a + v, 0);
    const active = tot - (g.get('human') ?? 0);
    const ex = [...g.entries()].filter(([k]) => k.startsWith('exec:')).reduce((a, [, v]) => a + v, 0);
    lines.push(`# ${name}: ${(tot / 3600000).toFixed(1)}h; exec share of non-owner time = ${active ? ((100 * ex) / active).toFixed(1) : '0.0'}%`);
    lines.push(`  ${fmt(g)}`);
  }
  return { lines, data };
}

const PAUSE = new Int32Array(new SharedArrayBuffer(4));
/** The plans file: a regular file, or a pipe (`<(…)`), read without blocking; a pipe empty past 10 s,
 *  or anything else (a device, a socket), is refused rather than waited on. */
function readPlans(path) {
  let fd;
  try {
    const st = statSync(path);
    if (st.isDirectory()) throw Object.assign(new Error(), { code: 'EISDIR' });
    if (!st.isFile() && !st.isFIFO()) throw Object.assign(new Error(), { code: 'not a file or pipe' });
    fd = openSync(path, constants.O_RDONLY | (st.isFIFO() ? constants.O_NONBLOCK : 0));
    const parts = [], buf = Buffer.alloc(1 << 16), until = Date.now() + 10000;
    for (;;) {
      let n;
      try { n = readSync(fd, buf, 0, buf.length, null); } catch (e) {
        if (e.code !== 'EAGAIN' || Date.now() > until) throw e;
        Atomics.wait(PAUSE, 0, 0, 10);
        continue;
      }
      if (n === 0) return Buffer.concat(parts).toString('utf8');
      parts.push(Buffer.from(buf.subarray(0, n)));
    }
  } catch (e) { throw new Error(`plans file not readable: ${why(e)}`); }
  finally { if (fd !== undefined) closeSync(fd); }
}

export function main(argv) {
  const args = argv.slice(2);
  const rx = { ...DEFAULTS };
  const pos = [];
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') { json = true; continue; }
    const flag = args[i].match(/^--(suite|probe|lint|vcs)$/);
    if (flag) {
      if (args[i + 1] === undefined) throw new Error(`${args[i]} needs a regex`);
      rx[flag[1]] = args[++i];
    }
    else pos.push(args[i]);
  }
  if (pos.length !== 2) throw new Error('usage: node scripts/plantime.mjs <transcripts dir> <plans file> [--json] [--suite|--probe|--lint|--vcs <regex>]');
  const compiled = Object.fromEntries(Object.entries(rx).map(([k, v]) => {
    try { return [k, new RegExp(v)]; } catch { throw new Error(`--${k} is not a valid regex`); }
  }));
  const plans = parsePlans(readPlans(pos[1]));
  if (!plans.length) throw new Error('plans file holds no plan');
  const { lines, data } = measure(pos[0], plans, compiled);
  return json ? [JSON.stringify(data, null, 1)] : lines;
}

const isMain = () => {
  try { return [realpathSync(process.argv[1]), resolve(process.argv[1])].some((p) => import.meta.url === pathToFileURL(p).href); } catch { return false; }
};
if (process.argv[1] && isMain()) {
  try { console.log(main(process.argv).join('\n')); } catch (e) { console.error(e.message); process.exit(1); }
}
