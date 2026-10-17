import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Snapshot } from '../types'
import { MARKER_TAIL, clean, parseDecisions, parseMarker, parseTitle, redSet, rowText, section } from './model'

const PANE = 'shawarma-companion'
const snap = atom({ plugin: 'shawarma-companion', key: 'snap' } as const, null)
/** The marker a Write or Edit of this session named; it wins over the cwd's. */
const known = atom({ plugin: 'shawarma-companion', key: 'marker' } as const, null)
/** `<path>@<mtimeMs>@<text>` of each own write: a later write with the same mtime but other text is not own. */
const own = atom({ plugin: 'shawarma-companion', key: 'own' } as const, [])
/** git toplevel per cwd: git is spawned once per directory, not per tool call. */
const toplevels = new Map<string, string | null>()

const WRITERS = new Set(['Write', 'Edit', 'NotebookEdit', 'Bash'])
/** While a row is drawn, the drawn marker is stat'ed this often (R5). */
export const CHECK_MS = 15_000
/** The running check, or null; a reload cancels it with the old module. */
let check: Timer | null = null
/** Set from `options.band` at register: the check runs only while a row can be drawn. */
let isBandOn = false

async function readOr(
  $: EngineInterface,
  path: string,
): Promise<string | null> {
  return (await $.fs.exists(path)) ? String(await $.fs.read(path)) : null
}

/** The marker at the cwd's git root, or null outside a repo. */
async function cwdMarker($: EngineInterface): Promise<string | null> {
  const cwd = await $.session.cwd()
  if (!toplevels.has(cwd)) {
    const git = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd })
    toplevels.set(cwd, git.exitCode === 0 ? git.stdout.trim() : null)
  }
  const top = toplevels.get(cwd)
  return top == null ? null : `${top}${MARKER_TAIL}`
}

/** mtime per candidate marker that exists now. */
async function markerTimes($: EngineInterface): Promise<Map<string, number>> {
  const times = new Map<string, number>()
  for (const marker of [await read($, known), await cwdMarker($)]) {
    if (marker !== null && (await $.fs.exists(marker))) {
      times.set(marker, (await $.fs.stat(marker)).mtimeMs)
    }
  }
  return times
}

async function snapshot($: EngineInterface): Promise<Snapshot | null> {
  const candidates = [await read($, known), await cwdMarker($)]
  for (const marker of candidates) {
    if (marker === null || !(await $.fs.exists(marker))) continue
    const text = String(await $.fs.read(marker))
    const parsed = parseMarker(text, marker)
    const stat = await $.fs.stat(marker)
    const { startedAt } = await $.session.usage()
    const isEarlier = stat.mtimeMs < startedAt
    const isUnconfirmed = !isEarlier && !(await read($, own)).includes(`${marker}@${stat.mtimeMs}@${text}`)
    const base = { marker, since: stat.mtimeMs, isEarlier, isUnconfirmed }
    if (parsed === null) {
      return { ...base, title: '', step: '', ruled: 0, defaults: 0, unreadable: 0,
        planDir: '', problem: `${marker} is malformed` }
    }
    const plan = await readOr($, `${parsed.planDir}/plan.md`)
    const decisions = await readOr($, `${parsed.planDir}/decisions.md`)
    const dirName = parsed.planDir.split('/').pop() ?? parsed.planDir
    const hasDir = await $.fs.exists(parsed.planDir)
    return {
      ...base,
      ...parseDecisions(decisions ?? ''),
      title: (plan !== null ? parseTitle(plan) : null) ?? dirName,
      step: parsed.step,
      planDir: parsed.planDir,
      ...(hasDir ? {} : { problem: `plan dir not found: ${parsed.planDir}` }),
    }
  }
  return null
}

/** Never throws: a failed read draws nothing rather than a stale row. */
async function refresh($: EngineInterface): Promise<void> {
  const next = await snapshot($).catch((err: unknown) => {
    $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' })
    return null
  })
  await update($, snap, () => next)
  watch($, next)
}

/** Starts the check when a row is drawn, stops it when none is. */
function watch($: EngineInterface, row: Snapshot | null): void {
  if (row === null || !isBandOn) {
    check?.cancel()
    check = null
  } else if (check === null) {
    check = $.clock.every(CHECK_MS, () => void stale($).catch(() => update($, snap, () => null)))
  }
}

/** Stat-only: a full re-read only when the drawn marker went or changed. */
async function stale($: EngineInterface): Promise<void> {
  const row = await read($, snap)
  if (row === null) return watch($, null)
  const at = (await $.fs.exists(row.marker)) ? (await $.fs.stat(row.marker)).mtimeMs : null
  if (at !== row.since) await refresh($)
}

/**
 * Learns the marker a Write/Edit named and, when this call changed it, records
 * it as own; redraws. A Write's own text must be what the file now holds, so
 * another writer landing inside the call is not taken for this session.
 */
async function afterCall(
  $: EngineInterface,
  path: string | null,
  expected: string | null,
  before: Map<string, number>,
): Promise<void> {
  if (path !== null && path.endsWith(MARKER_TAIL)) {
    await update($, known, () => path)
    const at = (await markerTimes($)).get(path)
    if (at !== undefined && before.get(path) !== at) {
      const text = String(await $.fs.read(path))
      if (expected === null || text === expected) {
        await update($, own, list => [...list, `${path}@${at}@${text}`].slice(-50))
      }
    }
  }
  await refresh($)
}

export const register: Register = (on, options) => {
  isBandOn = options.band === true
  on('session.start', async ($, e, next) => {
    if (options.pane === true) {
      await $.command.register({
        name: 'shawarma-companion',
        description: 'Show the active shawarma plan or run: recap, decisions, amendments',
      })
    }
    await refresh($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (!WRITERS.has(e.tool)) return next(e)
    const before = await markerTimes($).catch(() => new Map<string, number>())
    const result = await next(e)
    // Bookkeeping after the call never fails the call: a miss draws nothing.
    const named = 'file_path' in e && typeof e.file_path === 'string' ? e.file_path : null
    const path =
      named === null || named.startsWith('/') ? named : `${await $.session.cwd()}/${named}`
    // A marker write counts as this session's only when a Write/Edit named the
    // marker's path (R6). Any other change seen across the call is unconfirmed.
    const expected = e.tool === 'Write' && typeof e.content === 'string' ? e.content : null
    await afterCall($, path, expected, before).catch(() => update($, snap, () => null))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'shawarma-companion' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Shawarma' })
    return { text: 'Shawarma pane opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const row = await read($, snap)
    if (options.band !== true || row === null || e.props.hasSurvey) return next(e)
    // A settings change re-registers the module without a session.start: the
    // first drawing after it restarts the check.
    watch($, row)
    const context =
      options.context === true ? (await $.session.usage()).context.percent : undefined
    const { Button, Text } = $.ui.resolve(e)
    const text = (
      <Text dimColor={row.isEarlier || row.isUnconfirmed}>
        {rowText({ ...row, context }, e.props.bodyColumns, await $.clock.now())}
      </Text>
    )
    if (options.pane !== true) return text
    return (
      <Button key="row" plain onPress={() => void $.ui.open({ id: PANE, title: 'Shawarma' })}>
        {text}
      </Button>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Markdown, Text } = $.ui.resolve(e)
    const row = await read($, snap)
    if (row === null) return <Text dimColor>No shawarma plan or run is active.</Text>
    const plan = await readOr($, `${row.planDir}/plan.md`)
    const decisions = await readOr($, `${row.planDir}/decisions.md`)
    const parts = [
      `**${row.title}** · ${row.step}`,
      plan === null ? '_No brief yet: the plan is in progress._' : `### Recap\n\n${section(plan, 1) ?? '_§1 not found._'}`,
      `### Decisions\n\n${decisions === null ? '_None recorded._' : decisions.trim().split('\n').map(line => `- ${line}`).join('\n')}`,
      ...(plan === null ? [] : [
        `### Amendments\n\n${section(plan, 9) ?? '_§9 not found._'}`,
        `### Red set\n\n${redSet(plan) ?? '_No predicted red set in §4._'}`,
      ]),
    ]
    return (
      <Box flexDirection="column">
        <Markdown text={clean(parts.join('\n\n'), true)} />
      </Box>
    )
  })
}
