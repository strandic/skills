// Pure parsing and layout: no `$`, so tests call these directly.

/** A marker's file name under `<tree root>/.shawarma/`: `active-<ticket>`. */
export const MARKER_PREFIX = 'active-'

/** The ticket a `.shawarma/` entry name carries, or null when it is not a marker. */
/** Q5: a marker not rewritten for this long reads `stale:`. */
export const STALE_MS = 12 * 3600 * 1000
/** Q5: a marker dated more than this past now reads `stale:`. */
export const FUTURE_MS = 60_000
/** Q6: at most this many worktrees are scanned, the own tree first. */
export const MAX_TREES = 50
/** Q6: at most this many markers are read and drawn, in drawing order. */
export const MAX_ROWS = 20

/** Q5: stale when not rewritten for STALE_MS, or dated more than FUTURE_MS ahead of `now`. */
export function isStaleAt(at: number, now: number): boolean {
  return now - at > STALE_MS || at > now + FUTURE_MS
}

/**
 * The more-row (Q6, round 2 N3): `+<n> more not shown` for listed markers not
 * read, `<k> worktree(s) not scanned` for trees past MAX_TREES; null when both are 0.
 */
export function moreText(markers: number, trees: number): string | null {
  const parts = [
    ...(markers > 0 ? [`+${markers} more not shown`] : []),
    ...(trees > 0 ? [`${trees} ${trees === 1 ? 'worktree' : 'worktrees'} not scanned`] : []),
  ]
  return parts.length === 0 ? null : parts.join(' · ')
}

/** The label a row's title carries: `stale: `, `earlier session: ` or nothing (Q5 order). */
export function labelOf(row: { isStale?: boolean; isEarlier: boolean }): string {
  return row.isStale === true ? 'stale: ' : row.isEarlier ? 'earlier session: ' : ''
}

/** `name` under the folder `root`; a root of `/` gives `/<name>`. */
export function under(root: string, name: string): string {
  return root === '/' ? `/${name}` : `${root}/${name}`
}

export function ticketOf(name: string): string | null {
  return name.startsWith(MARKER_PREFIX) && name.length > MARKER_PREFIX.length ? name.slice(MARKER_PREFIX.length) : null
}

export type Marker = { kind: 'plan'; planDir: string; step: string } | { kind: 'trivial'; step: 'trivial' }

/**
 * Line 1: the plan dir, relative to the tree root or absolute; when line 2 is
 * `trivial`, the ticket id. Line 2: `plan <step>`, `run <wave>` or `trivial`.
 * Exactly two lines after trimming. Anything else is malformed: null.
 */
export function parseMarker(text: string, treeRoot: string): Marker | null {
  const lines = text.split('\n').map(line => line.trim())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length !== 2) return null
  const first = (lines[0] ?? '').replace(/\/+$/, '')
  const step = lines[1] ?? ''
  if (first === '') return null
  if (step === 'trivial') return { kind: 'trivial', step }
  if (!/^(plan|run) \S/.test(step)) return null
  return { kind: 'plan', planDir: first.startsWith('/') ? first : under(treeRoot, first), step }
}

/** One record of `git worktree list --porcelain`. */
export type Worktree = { path: string; isBare: boolean; isPrunable: boolean; isLocked: boolean; isDetached: boolean }

/**
 * The records of `git worktree list --porcelain -z`, the main checkout first:
 * each attribute ends in NUL, each record in one more NUL, so a path holding a
 * newline stays one path (lane 3a F1). Null when the output holds no NUL or no
 * `worktree /<abs>` record (garbage, empty, or the newline form).
 */
export function parseWorktrees(stdout: string): Worktree[] | null {
  if (!stdout.includes('\0')) return null
  const records: Worktree[] = []
  let fields: string[] = []
  const flush = () => {
    const head = fields[0] ?? ''
    if (head.startsWith('worktree /')) {
      const has = (word: string) => fields.some(field => field === word || field.startsWith(`${word} `))
      records.push({ path: head.slice('worktree '.length).replace(/\/+$/, '') || '/', isBare: has('bare'),
        isPrunable: has('prunable'), isLocked: has('locked'), isDetached: has('detached') })
    }
    fields = []
  }
  for (const field of stdout.split('\0')) {
    if (field === '') flush()
    else fields.push(field)
  }
  flush()
  return records.length === 0 ? null : records
}

/** The folder above `path` (`/` above itself). */
export function parentOf(path: string): string {
  const cut = path.replace(/\/+$/, '').lastIndexOf('/')
  return cut <= 0 ? '/' : path.slice(0, cut)
}

/** `rel` against the folder `base`, `.` and `..` folded; an absolute `rel` as it is. */
export function resolvePath(base: string, rel: string): string {
  const parts: string[] = []
  for (const part of `${rel.startsWith('/') ? '' : `${base}/`}${rel}`.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

/** The folder a `.git` file's `gitdir: <path>` line names, resolved against `dir`; null without one. */
export function parseGitdir(text: string, dir: string): string | null {
  const line = lines(text).find(one => one.startsWith('gitdir:'))
  const path = line?.slice('gitdir:'.length).trim() ?? ''
  return path === '' ? null : resolvePath(dir, path)
}

/** The tree holding `cwd`: the longest root that is `cwd` or one of its parents, else null. */
export function ownTree(cwd: string, roots: readonly string[]): string | null {
  let best: string | null = null
  for (const root of roots) {
    const isUnder = root === '/' || cwd === root || cwd.startsWith(`${root}/`)
    if (isUnder && (best === null || root.length > best.length)) best = root
  }
  return best
}

/** Rows in drawing order: the own tree's first, then newest first, the ticket breaking a tie. */
export function order<R extends { tree: string; since: number; ticket: string }>(rows: readonly R[], own: string | null): R[] {
  return [...rows].sort((a, b) =>
    Number(b.tree === own) - Number(a.tree === own) || b.since - a.since || (a.ticket < b.ticket ? -1 : a.ticket > b.ticket ? 1 : 0))
}

/**
 * Control characters (C0, DEL, C1), which a surface refuses to draw, and bidi
 * controls (U+061C, U+200E, U+200F, U+202A-U+202E, U+2066-U+2069), which can
 * reorder a row (lane 3a F5), and the line and paragraph separators U+2028,
 * U+2029 (round 2 N6), as spaces; `\n` kept only when asked.
 */
export function clean(text: string, keepNewlines = false): string {
  return text
    .replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g : /[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u2028\u2029]/g, ' ')
}

/** Lines ending in `\r\n`, `\r` or `\n`. */
export function lines(text: string): string[] {
  return text.split(/\r\n|\r|\n/)
}

/** The `Predicted red set` line of §4, else null. */
export function redSet(plan: string): string | null {
  const body = section(plan, 4)
  const line = body?.split('\n').find(one => one.startsWith('Predicted red set'))
  return line ?? null
}

export type Decisions = { decisions: number }

/**
 * One decision per row `<date> | <label> | <decision> | <why>`: a line that
 * starts with a `YYYY-MM-DD` date followed by `|`, a leading `|` allowed (a
 * Markdown table). The label is not read: the skill does not define it yet.
 * Every other line (heading, table header, wrapped text) is skipped.
 */
export function parseDecisions(text: string): Decisions {
  let decisions = 0
  for (const line of lines(text)) {
    if (/^\d{4}-\d{2}-\d{2}\s*\|/.test(line.trim().replace(/^\|\s*/, ''))) decisions += 1
  }
  return { decisions }
}

/** `# <ticket> — <title>` from plan.md's first line, else null. */
export function parseTitle(plan: string): string | null {
  const first = lines(plan)[0] ?? ''
  return first.startsWith('# ') ? first.slice(2).trim() : null
}

/** The body under the first `## <n>.` heading, up to the next `## `. */
export function section(plan: string, n: number): string | null {
  const all = lines(plan)
  const start = all.findIndex(line => line.startsWith(`## ${n}.`))
  if (start === -1) return null
  const rest = all.slice(start + 1)
  const end = rest.findIndex(line => line.startsWith('## '))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
}

/** `HH:MM` local time, with `MM-DD ` before it when `ms` is not on `now`'s day. */
export function clockTime(ms: number, now: number = ms): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  const sameDay = d.toDateString() === new Date(now).toDateString()
  const day = sameDay ? '' : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
  return `${day}${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type RowInput = {
  ticket?: string
  title: string
  step: string
  since: number
  isEarlier: boolean
  isStale?: boolean
  decisions: number
  context?: number
  problem?: string
}

/** Whether `title` starts with exactly `ticket`, then the end, a space or ` —`. */
export function namesTicket(title: string, ticket: string): boolean {
  return title === ticket || title.startsWith(`${ticket} `)
}

/** `text` in at most `room` characters, `…` last when cut; empty below 2. */
function cut(text: string, room: number): string {
  return room >= text.length ? text : room >= 2 ? `${text.slice(0, room - 1)}…` : ''
}

/**
 * One line, at most `columns` wide. The ticket leads and is kept (Q1, lane 3a
 * F10): the title is cut first, then the problem text, then the line's end.
 * Every part is true when drawn: the time is when the marker was written,
 * never an age that goes stale on screen.
 */
export function rowText(row: RowInput, columns: number, now: number = row.since): string {
  if (columns < 1) return ''
  const fit = (line: string) => (line.length <= columns ? line : `${line.slice(0, Math.max(0, columns - 1))}…`)
  if (row.problem !== undefined && row.step === '') {
    // round 3 R3-4: the label, as the pane draws it.
    return fit(clean(`${labelOf(row)}shawarma: ${row.ticket !== undefined ? `${row.ticket}: ` : ''}${row.problem}`))
  }
  const isTrivial = row.step === 'trivial'
  const ticket = row.ticket
  // Q5: `stale:` wins over `earlier session:` when both apply (an old marker that is also stale says the stronger thing).
  const head = `${labelOf(row)}${ticket ?? ''}`
  const rest = ticket === undefined ? row.title
    : isTrivial ? '' : namesTicket(row.title, ticket) ? row.title.slice(ticket.length) : ` · ${row.title}`
  const body = [
    row.step,
    `since ${clockTime(row.since, now)}`,
    ...(isTrivial ? [] : [`${row.decisions} ${row.decisions === 1 ? 'decision' : 'decisions'}`]),
  ].join(' · ')
  const problem = row.problem !== undefined ? ` · ${row.problem}` : ''
  const ctx = row.context !== undefined ? ` · ctx ${row.context}%` : ''
  const avail = columns - head.length - 3 - body.length - ctx.length
  const title = cut(rest, avail - problem.length)
  const shown = cut(problem, avail - title.length)
  const name = `${head}${title}`
  const sep = ticket === undefined && title === '' ? '' : ' · '
  return fit(clean(`${name}${sep}${body}${shown}${ctx}`))
}
