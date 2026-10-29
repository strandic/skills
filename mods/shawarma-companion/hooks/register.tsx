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

/**
 * `mtimeMs` of `path`, or null when it is missing. A failed stat is taken for
 * "missing" only when `fs.exists` agrees; any other failure throws.
 */
async function mtimeOr($: EngineInterface, path: string): Promise<number | null> {
  return $.fs.stat(path).then(
    stat => stat.mtimeMs,
    async (err: unknown) => {
      if (await $.fs.exists(path)) throw err
      return null
    },
  )
}

/** The file's text and `mtimeMs`, or nulls when it is missing: one stat, one read. */
async function readOr($: EngineInterface, path: string): Promise<{ text: string | null; at: number | null }> {
  const at = await mtimeOr($, path)
  return { text: at === null ? null : String(await $.fs.read(path)), at }
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

/**
 * A Write or Edit that named a marker path: the path, its `mtimeMs` before the
 * call (null: missing), and for a Write the text it sent.
 */
type Claim = { path: string; before: number | null; expected: string | null }

/**
 * The first candidate marker that exists, each candidate stat'ed once. A
 * `claim` whose path is that marker and whose `mtimeMs` changed across the
 * call, holding the Write's text if any, is recorded as own before labelling.
 */
async function snapshot($: EngineInterface, claim: Claim | null = null): Promise<Snapshot | null> {
  const candidates = new Set([await read($, known), await cwdMarker($)])
  for (const marker of candidates) {
    if (marker === null) continue
    const at = await mtimeOr($, marker)
    if (at === null) continue
    const text = String(await $.fs.read(marker))
    if (claim?.path === marker && claim.before !== at && (claim.expected === null || text === claim.expected)) {
      await update($, own, list => [...list, `${marker}@${at}@${text}`].slice(-50))
    }
    const parsed = parseMarker(text, marker)
    const { startedAt } = await $.session.usage()
    const isEarlier = at < startedAt
    const isUnconfirmed = !isEarlier && !(await read($, own)).includes(`${marker}@${at}@${text}`)
    const base = { marker, since: at, isEarlier, isUnconfirmed }
    if (parsed === null) {
      return { ...base, title: '', step: '', decisions: 0,
        planDir: '', planAt: null, decisionsAt: null, problem: `${marker} is malformed` }
    }
    const plan = await readOr($, `${parsed.planDir}/plan.md`)
    const decisions = await readOr($, `${parsed.planDir}/decisions.md`)
    const dirName = parsed.planDir.split('/').pop() ?? parsed.planDir
    const hasDir = plan.at !== null || decisions.at !== null || (await $.fs.exists(parsed.planDir))
    return {
      ...base,
      ...parseDecisions(decisions.text ?? ''),
      title: (plan.text !== null ? parseTitle(plan.text) : null) ?? dirName,
      step: parsed.step,
      planDir: parsed.planDir,
      planAt: plan.at,
      decisionsAt: decisions.at,
      ...(hasDir ? {} : { problem: `plan dir not found: ${parsed.planDir}` }),
    }
  }
  return null
}

/** Never throws: a failed read draws nothing rather than a stale row. */
async function refresh($: EngineInterface, claim: Claim | null = null): Promise<void> {
  const next = await snapshot($, claim).catch((err: unknown) => {
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

/**
 * Stat-only: a full re-read only when the drawn marker, plan.md or
 * decisions.md appeared, went or changed (W3-R1): a stat each, and an
 * exists for each one missing.
 */
async function stale($: EngineInterface): Promise<void> {
  const row = await read($, snap)
  if (row === null) return watch($, null)
  if (
    (await mtimeOr($, row.marker)) !== row.since ||
    (row.planDir !== '' &&
      ((await mtimeOr($, `${row.planDir}/plan.md`)) !== row.planAt ||
        (await mtimeOr($, `${row.planDir}/decisions.md`)) !== row.decisionsAt))
  ) {
    await refresh($)
  }
}

export const register: Register = (on, options) => {
  isBandOn = options.band === true
  on('session.start', async ($, e, next) => {
    if (options.pane === true) {
      await $.command
        .register({
          name: 'shawarma-companion',
          description: 'Show the active shawarma plan or run: recap, decisions, amendments',
        })
        .catch((err: unknown) => $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' }))
    }
    await refresh($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (!WRITERS.has(e.tool)) return next(e)
    // A marker write counts as this session's only when a Write/Edit named the
    // marker's path (R6) and its mtime changed across the call: the path is
    // stat'ed before it, so a failed Edit records nothing (W3-D1). Any other
    // change seen across the call is unconfirmed.
    const claim = await (async (): Promise<Claim | null> => {
      const named = 'file_path' in e && typeof e.file_path === 'string' ? e.file_path : null
      if (named === null) return null
      const path = named.startsWith('/') ? named : `${await $.session.cwd()}/${named}`
      if (!path.endsWith(MARKER_TAIL)) return null
      const expected = e.tool === 'Write' && typeof e.content === 'string' ? e.content : null
      return { path, before: await mtimeOr($, path), expected }
    })().catch(() => null)
    const result = await next(e)
    // Bookkeeping after the call never fails the call: a miss draws nothing.
    if (claim !== null) await update($, known, () => claim.path).catch(() => undefined)
    await refresh($, claim)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'shawarma-companion' }, async $ => {
    return $.ui.open({ id: PANE, title: 'Shawarma' }).then(
      () => ({ text: 'Shawarma pane opened.' }),
      (err: unknown) => ({ text: `Shawarma pane could not open: ${String(err)}` }),
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const row = await read($, snap)
    if (options.band !== true || row === null || e.props.hasSurvey) return next(e)
    // A settings change re-registers the module without a session.start: the
    // first drawing after it restarts the check.
    watch($, row)
    const context =
      options.context === true
        ? await $.session.usage().then(usage => usage.context.percent, () => null)
        : undefined
    if (context === null) return next(e)
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
    const files = await Promise.all([readOr($, `${row.planDir}/plan.md`), readOr($, `${row.planDir}/decisions.md`)])
      .catch((err: unknown) => String(err))
    if (typeof files === 'string') {
      return <Text dimColor>{clean(`The plan files could not be read: ${files}`)}</Text>
    }
    const [{ text: plan }, { text: decisions }] = files
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
