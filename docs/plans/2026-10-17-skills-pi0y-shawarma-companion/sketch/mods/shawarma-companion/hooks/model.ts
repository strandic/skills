// Pure parsing and layout: no `$`, so tests call these directly.

/** The marker's file name, under the tree root: `<root>/.shawarma/active`. */
export const MARKER_TAIL = '/.shawarma/active'

export type Marker = { planDir: string; step: string }

/**
 * Line 1: the plan dir, relative to the tree root or absolute. Line 2: the
 * step, `plan <step>` or `run <wave>`. Anything else is malformed: null.
 */
export function parseMarker(text: string, markerPath: string): Marker | null {
  const lines = text.split('\n').map(line => line.trim())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length !== 2) return null
  const dir = (lines[0] ?? '').replace(/\/+$/, '')
  const step = lines[1] ?? ''
  if (dir === '' || !/^(plan|run) \S/.test(step)) return null
  const root = markerPath.slice(0, markerPath.length - MARKER_TAIL.length)
  return { planDir: dir.startsWith('/') ? dir : `${root}/${dir}`, step }
}

/** Control characters, which a surface refuses to draw, as spaces; `\n` kept only when asked. */
export function clean(text: string, keepNewlines = false): string {
  return text.replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ')
}

/** The `Predicted red set` line of §4, else null. */
export function redSet(plan: string): string | null {
  const body = section(plan, 4)
  const line = body?.split('\n').find(one => one.startsWith('Predicted red set'))
  return line ?? null
}

export type Decisions = { ruled: number; defaults: number; unreadable: number }

/** Rows `<date> | RULING|DEFAULT | <decision> | <why>`; blank lines skipped. */
export function parseDecisions(text: string): Decisions {
  const out = { ruled: 0, defaults: 0, unreadable: 0 }
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    const fields = line.split('|').map(field => field.trim())
    const label = fields.length >= 4 ? fields[1] : undefined
    if (label === 'RULING') out.ruled += 1
    else if (label === 'DEFAULT') out.defaults += 1
    else out.unreadable += 1
  }
  return out
}

/** `# <ticket> — <title>` from plan.md's first line, else null. */
export function parseTitle(plan: string): string | null {
  const first = plan.split('\n', 1)[0] ?? ''
  return first.startsWith('# ') ? first.slice(2).trim() : null
}

/** The body under the first `## <n>.` heading, up to the next `## `. */
export function section(plan: string, n: number): string | null {
  const lines = plan.split('\n')
  const start = lines.findIndex(line => line.startsWith(`## ${n}.`))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
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
  title: string
  step: string
  since: number
  isEarlier: boolean
  isUnconfirmed?: boolean
  ruled: number
  defaults: number
  unreadable: number
  context?: number
  problem?: string
}

/**
 * One line, at most `columns` wide: the title is cut first, then the whole
 * line. Every part is true when drawn: the time is when the marker was
 * written, never an age that goes stale on screen.
 */
export function rowText(row: RowInput, columns: number, now: number = row.since): string {
  if (columns < 1) return ''
  if (row.problem !== undefined && row.step === '') {
    const only = clean(`shawarma: ${row.problem}`)
    return only.length <= columns ? only : `${only.slice(0, columns - 1)}…`
  }
  const tail = [
    row.step,
    `since ${clockTime(row.since, now)}`,
    `${row.ruled} ruled, ${row.defaults} default`,
    ...(row.unreadable > 0 ? [`${row.unreadable} unreadable in decisions.md`] : []),
    ...(row.problem !== undefined ? [row.problem] : []),
    ...(row.context !== undefined ? [`ctx ${row.context}%`] : []),
  ].join(' · ')
  const head = row.isEarlier ? 'earlier session: ' : row.isUnconfirmed === true ? 'unconfirmed: ' : ''
  const room = columns - head.length - tail.length - 3
  const title =
    room >= row.title.length ? row.title : room >= 2 ? `${row.title.slice(0, room - 1)}…` : ''
  const line = clean(title === '' ? `${head}${tail}` : `${head}${title} · ${tail}`)
  return line.length <= columns ? line : `${line.slice(0, Math.max(0, columns - 1))}…`
}
