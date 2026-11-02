import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsEntry, Register, Timer } from 'claude-code'

import type { Snapshot } from '../types'
import {
  MARKER_PREFIX, clean, lines, order, ownTree, parentOf, parseDecisions, parseGitdir, parseMarker, parseTitle, parseWorktrees,
  MAX_ROWS, MAX_TREES, isInside, isStaleAt, labelOf, moreText, redSet, resolvePath, rowText, section, ticketOf, under,
} from './model'

const PANE = 'shawarma-companion'
/** One row per live marker, in drawing order (Q4). */
const rowsAtom = atom({ plugin: 'shawarma-companion', key: 'rows' } as const, [])
/** The marker path the pane shows: set by a row press or the command. */
const chosen = atom({ plugin: 'shawarma-companion', key: 'chosen' } as const, null)
/** Q6, round 2 N3: markers listed but not read, and worktrees not scanned: one dimmed more-row. */
const hiddenAtom = atom({ plugin: 'shawarma-companion', key: 'hidden' } as const, { markers: 0, trees: 0 })
/**
 * The check's signature (round 2 N4): the markers that would be drawn, from
 * the listings, plus the hidden counts. A hidden marker rewritten while it
 * stays hidden changes nothing; one that rises into the top MAX_ROWS does.
 */
let lastListed: string | null = null
/**
 * What the last scan found, for the pane's reasons (round 2 N1, round 3):
 * `none` until a refresh ran since load, `failed` when the last one threw.
 * `trees` are the trees whose `.shawarma` listing answered; `paths` every
 * listed marker; `unread` the picked markers whose files failed to read.
 */
type Scan = { status: 'none' | 'ok' | 'failed'; trees: Set<string>; paths: Set<string>; unread: Set<string> }
let lastScan: Scan = { status: 'none', trees: new Set(), paths: new Set(), unread: new Set() }

/** Why the chosen marker is not drawn, from facts the last scan holds only. */
function reasonFor(want: string): string {
  if (lastScan.status !== 'ok') return 'not shown (not in the last scan)'
  if (lastScan.unread.has(want)) return 'could not be read'
  if (lastScan.paths.has(want)) return `not shown (past the ${MAX_ROWS}-row limit)`
  const tree = want.slice(0, want.lastIndexOf('/.shawarma/')) || '/'
  return lastScan.trees.has(tree) ? 'no longer active' : 'not shown (not in the last scan)'
}

/**
 * The trees to scan, and the one holding the session's cwd. `reals` maps each
 * scanned root to its real path, links followed (R3); a root missing from it
 * is used as given.
 */
type Trees = { own: string | null; roots: string[]; reals: ReadonlyMap<string, string> }
/** Per cwd, from `git worktree list` (or the fallback) and the roots' real paths: cleared at each turn end and at session start (Q2, R3). */
const worktrees = new Map<string, Trees>()
/** Fallback only: the file-API walk per cwd, kept for the session when it found a repo. */
const walks = new Map<string, { own: string; main: string | null }>()
/** The trees of the last refresh: the check scans these and runs no process. */
let lastTrees: Trees | null = null
/** Derived values per path and `mtimeMs`: a file is read again only when its time changed (Q3). */
type Cached<T> = Map<string, { at: number; value: T }>
const titles: Cached<string | null> = new Map()
const counts: Cached<number> = new Map()
/**
 * R1, R3: per marker path, the real path of its plan dir, asked with one
 * `$.fs.stat(dir, { resolve: true })` for the marker's time and plan dir.
 * Only a real path is kept: a stat that rejects or answers none is asked
 * again next time; one that runs past RUN_MS is kept as outside in
 * `lateDirs` until the turn ends. An entry is dropped when its plan dir does
 * not list in a refresh (the row not found or not readable), so a folder seen
 * missing is checked afresh (R5). One entry per marker path, and each refresh
 * drops the markers it no longer lists.
 */
const realDirs = new Map<string, { at: number; dir: string; real: string }>()
/**
 * R4 (b): per marker path, a plan dir whose real-path stat gave no answer in
 * RUN_MS, for the marker's time: read as outside without asking again until
 * the turn ends (cleared with `worktrees`), so a hanging stat costs 2 s once
 * per turn. Written by the refresh and by the pane, read by both (R5).
 * Pruned with `realDirs`.
 */
const lateDirs = new Map<string, { at: number; dir: string }>()

const WRITERS = new Set(['Write', 'Edit', 'NotebookEdit', 'Bash'])
/** Every `$.process.run` gives up after this; a timeout is a failed list (lane 3a F9). */
export const RUN_MS = 2_000

/** How a call raced against RUN_MS ended: its value, a rejection, or no answer in time. */
type Raced<T> = { kind: 'ok'; value: T } | { kind: 'failed' } | { kind: 'late' }

/** `work` raced against RUN_MS on the engine clock. */
async function within<T>($: EngineInterface, work: Promise<T>): Promise<Raced<T>> {
  let timer: Timer | null = null
  const late = new Promise<Raced<T>>(resolve => { timer = $.clock.after(RUN_MS, () => resolve({ kind: 'late' })) })
  const out = await Promise.race([
    work.then((value): Raced<T> => ({ kind: 'ok', value }), (): Raced<T> => ({ kind: 'failed' })),
    late,
  ]).catch((): Raced<T> => ({ kind: 'failed' }))
  ;(timer as Timer | null)?.cancel()
  return out
}

/** `argv` in `cwd`, or null when it rejects, runs past RUN_MS, or its stdout was cut. */
async function run($: EngineInterface, argv: readonly string[], cwd: string): Promise<{ exitCode: number; stdout: string } | null> {
  const out = await within($, $.process.run(argv, { cwd, timeoutMs: RUN_MS }))
  return out.kind === 'ok' && !out.value.isStdoutTruncated ? out.value : null
}

/** The real path of `path`, links followed, or null when the stat rejects, answers none, or runs past RUN_MS. */
async function realOf($: EngineInterface, path: string): Promise<string | null> {
  const out = await within($, $.fs.stat(path, { resolve: true }))
  return out.kind === 'ok' ? (out.value?.realPath ?? null) : null
}
/** While a row is drawn, the trees and drawn plan dirs are listed this often (R5). */
export const CHECK_MS = 15_000
/** The running check, or null; a reload cancels it with the old module. */
let check: Timer | null = null
/** Set from `options.band` at register: the check runs only while a row can be drawn. */
let isBandOn = false

/** One pass's listings, each path listed at most once; a failed listing is null (D6: it rejects on a missing folder). */
type Lister = (path: string) => Promise<FsEntry[] | null>
function lister($: EngineInterface): Lister {
  const memo = new Map<string, Promise<FsEntry[] | null>>()
  return path => {
    let hit = memo.get(path)
    if (hit === undefined) {
      hit = $.fs.list(path).then(entries => entries, () => null)
      memo.set(path, hit)
    }
    return hit
  }
}

/** `fn(text)` of the file at `path`, read only when `at` differs from the cached time. */
async function derived<T>($: EngineInterface, cache: Cached<T>, path: string, at: number, fn: (text: string) => T): Promise<T> {
  const hit = cache.get(path)
  if (hit !== undefined && hit.at === at) return hit.value
  const value = fn(String(await $.fs.read(path)))
  cache.set(path, { at, value })
  return value
}

/** The time of `name` in a plan-dir listing when it is a regular file and not a link, else null (D12). */
function timeIn(entries: readonly FsEntry[], name: string): number | null {
  return entries.find(entry => entry.name === name && entry.kind === 'file' && entry.isLink !== true)?.mtimeMs ?? null
}

/**
 * The pane's plan.md and decisions.md, each null when missing (D12): one
 * listing of `dir`, then a read only of a name it shows as a regular file and
 * not a link. A dir that does not list and does not exist reads both as
 * missing; one that exists and does not list, or a read that fails, throws.
 */
async function planFiles($: EngineInterface, dir: string): Promise<[string | null, string | null]> {
  const entries = await $.fs.list(dir).catch(async (err: unknown) => {
    if (await $.fs.exists(dir)) throw err
    return [] as FsEntry[]
  })
  const readIf = async (name: string) => (timeIn(entries, name) === null ? null : String(await $.fs.read(`${dir}/${name}`)))
  return Promise.all([readIf('plan.md'), readIf('decisions.md')])
}

/**
 * The trees of the session's cwd: `git worktree list --porcelain` once per cwd
 * per turn, NUL-framed, prunable and bare records skipped, locked and detached
 * ones kept (D3). When it cannot run, runs past RUN_MS, exits non-zero, is cut
 * or prints no record: the file-API
 * walk (no process), then the main checkout, `<main>/.worktrees/*` and the
 * cwd's own tree (Q2). A sibling-folder worktree is then missed. Each scanned
 * root's real path is then asked with one stat, raced against RUN_MS (R3).
 */
async function discover($: EngineInterface): Promise<Trees> {
  const cwd = await $.session.cwd()
  const hit = worktrees.get(cwd)
  if (hit !== undefined) return hit
  const git = await run($, ['git', 'worktree', 'list', '--porcelain', '-z'], cwd)
  const listed = git !== null && git.exitCode === 0 ? parseWorktrees(git.stdout) : null
  let found: Omit<Trees, 'reals'>
  if (listed !== null) {
    const roots = [...new Set(listed.filter(tree => !tree.isPrunable && !tree.isBare).map(tree => tree.path))]
    found = { own: ownTree(cwd, roots), roots }
  } else {
    found = await fallback($, cwd)
  }
  const reals = new Map<string, string>()
  for (const root of scanned({ ...found, reals }).roots) {
    const real = await realOf($, root)
    if (real !== null) reals.set(root, real)
  }
  const trees: Trees = { ...found, reals }
  worktrees.set(cwd, trees)
  return trees
}

/**
 * Q2 fallback, the file API only: walk up from the cwd to the first folder
 * holding `.git` (one stat per level). A `.git` folder: that folder is the
 * main checkout. A `.git` file: its `gitdir:` line names `<common>/worktrees/<name>`,
 * whose `commondir` file (else `../..`) names the common `.git`; the main
 * checkout is the folder above it. A found repo is kept per cwd for the
 * session; a failed walk is not, so the next turn end or session start tries
 * again (lane 3a F8).
 */
async function walk($: EngineInterface, cwd: string): Promise<{ own: string; main: string | null } | null> {
  for (let dir = cwd; ; dir = parentOf(dir)) {
    const git = `${dir === '/' ? '' : dir}/.git`
    const stat = await $.fs.stat(git).then(one => one, () => null)
    if (stat?.kind === 'dir') return { own: dir, main: dir }
    if (stat?.kind === 'file') {
      const gitdir = parseGitdir(String(await $.fs.read(git)), dir)
      if (gitdir === null) return { own: dir, main: null }
      const common = (await $.fs.read(`${gitdir}/commondir`).then(text => String(text).trim(), () => '')) || '../..'
      const commonDir = resolvePath(gitdir, common)
      return { own: dir, main: commonDir.endsWith('/.git') ? parentOf(commonDir) : null }
    }
    if (dir === '/') return null
  }
}

async function fallback($: EngineInterface, cwd: string): Promise<Omit<Trees, 'reals'>> {
  const at = walks.get(cwd) ?? (await walk($, cwd).catch(() => null))
  if (at === null) return { own: null, roots: [] }
  walks.set(cwd, at)
  const main = at.main
  const linked = main === null ? [] : ((await $.fs.list(under(main, '.worktrees')).then(entries => entries, () => null)) ?? [])
    .filter(entry => entry.kind === 'dir')
    .map(entry => under(main, `.worktrees/${entry.name}`))
  return { own: at.own, roots: [...new Set([...(main === null ? [] : [main]), ...linked, at.own])] }
}

/** Every live marker of `roots`: one listing per tree's `.shawarma` (a missing or unreadable one has none). */
async function markersOf(list: Lister, roots: readonly string[], answered: Set<string> = new Set()): Promise<{ root: string; ticket: string; at: number }[]> {
  const found: { root: string; ticket: string; at: number }[] = []
  for (const root of roots) {
    const entries = await list(under(root, '.shawarma'))
    if (entries !== null) answered.add(root)
    for (const entry of entries ?? []) {
      const ticket = ticketOf(entry.name)
      if (entry.kind === 'file' && ticket !== null) found.push({ root, ticket, at: entry.mtimeMs })
    }
  }
  return found
}

/**
 * Whether the plan dir `dir` of the marker at `marker` (time `at`) lies in its tree (D11, R1, R3). First the folded
 * text of `dir` against `root`: outside as written is outside, with no file call. Then its real path, links followed,
 * against `realRoot`: one stat raced against RUN_MS, its real path kept per marker path, time and plan dir. No real
 * path is outside and not kept; no answer in time is outside and kept until the turn ends (R4). A stat that rejects is
 * `unknown`, not kept: the caller lists and reads nothing there that call (R3a).
 */
async function isPlanInside($: EngineInterface, marker: string, at: number, root: string, realRoot: string,
  dir: string): Promise<'inside' | 'outside' | 'unknown'> {
  const verdict = (real: string) => (isInside(realRoot, real) ? 'inside' : 'outside')
  if (!isInside(root, dir)) return 'outside'
  const hit = realDirs.get(marker)
  if (hit !== undefined && hit.at === at && hit.dir === dir) return verdict(hit.real)
  const late = lateDirs.get(marker)
  if (late !== undefined && late.at === at && late.dir === dir) return 'outside'
  const out = await within($, $.fs.stat(dir, { resolve: true }))
  if (out.kind === 'failed') return 'unknown'
  if (out.kind === 'late') {
    lateDirs.set(marker, { at, dir })
    return 'outside'
  }
  const real = out.kind === 'ok' ? (out.value?.realPath ?? null) : null
  if (real === null) return 'outside'
  realDirs.set(marker, { at, dir, real })
  return verdict(real)
}

/**
 * One row. The marker is read once; the plan dir is listed once (both files' times, and whether it is there); plan.md and
 * decisions.md are read only when their times changed (Q3), and only when listed as regular files, not links (D12). A plan
 * dir outside the marker's own tree, as written or links followed (R1, R3; `realRoot` is the tree's real path), is a
 * problem row with no plan dir: nothing there is listed or read (D11). When its real-path stat rejects, nothing there is
 * listed or read either: the row says the plan dir is not readable when it exists, not found when not (R3a).
 */
async function rowOf($: EngineInterface, list: Lister, found: { root: string; ticket: string; at: number },
  startedAt: number, now: number, realRoot: string): Promise<Snapshot> {
  const { root, ticket, at } = found
  const marker = under(root, `.shawarma/${MARKER_PREFIX}${ticket}`)
  // The marker is read each pass: a rewrite keeping its time still shows (pi0y L13).
  const parsed = parseMarker(String(await $.fs.read(marker)), root)
  // D5: a row reads current only when its marker is newer than the session
  // start. startedAt is whole ms (the true start lies in [startedAt,
  // startedAt + 1)), mtimes are fractional: current only past startedAt + 1
  // (lane 3a F3), so a marker written in the start's own ms reads earlier.
  const base = { ticket, marker, tree: root, since: at, isEarlier: !(at > startedAt + 1), isStale: isStaleAt(at, now), decisions: 0,
    planDir: '', planAt: null, decisionsAt: null }
  if (parsed === null) return { ...base, title: '', step: '', problem: 'malformed marker' }
  if (parsed.kind === 'trivial') return { ...base, title: ticket, step: 'trivial' }
  const where = await isPlanInside($, marker, at, root, realRoot, parsed.planDir)
  if (where === 'outside') return { ...base, title: '', step: '', problem: 'plan dir outside its tree' }
  const dir = parsed.planDir
  const dirName = dir.split('/').pop() ?? dir
  const entries = where === 'unknown' ? null : await list(dir)
  if (entries === null) {
    // R5: a folder seen missing or unreadable is checked afresh next time, not through a kept real path.
    realDirs.delete(marker)
    const problem = (await $.fs.exists(dir)) ? `plan dir not readable: ${dir}` : `plan dir not found: ${dir}`
    return { ...base, title: dirName, step: parsed.step, planDir: dir, problem }
  }
  const planAt = timeIn(entries, 'plan.md')
  const decisionsAt = timeIn(entries, 'decisions.md')
  const title = planAt === null ? null : await derived($, titles, `${dir}/plan.md`, planAt, parseTitle)
  const decisions = decisionsAt === null ? 0
    : await derived($, counts, `${dir}/decisions.md`, decisionsAt, text => parseDecisions(text).decisions)
  return { ...base, title: title ?? dirName, step: parsed.step, planDir: dir, planAt, decisionsAt, decisions }
}

/** The trees scanned: the own tree first, at most MAX_TREES (Q6); how many were left out. */
function scanned(trees: Trees): { roots: string[]; left: number } {
  const all = trees.own === null ? trees.roots : [trees.own, ...trees.roots.filter(root => root !== trees.own)]
  return { roots: all.slice(0, MAX_TREES), left: Math.max(0, all.length - MAX_TREES) }
}

const keyOf = (one: { root: string; ticket: string; at: number }) => `${under(one.root, `.shawarma/${MARKER_PREFIX}${one.ticket}`)}@${one.at}`

/** A listed marker: its tree root, its ticket and its time. */
type Found = { root: string; ticket: string; at: number }
/** The markers to draw, in order, and the signature the check compares (N4). */
function pick(found: Found[], trees: Trees, left: number): { picked: Found[]; signature: string } {
  const picked = order(found.map(one => ({ ...one, tree: one.root, since: one.at })), trees.own).slice(0, MAX_ROWS)
  return { picked, signature: `${picked.map(keyOf).join('\n')}\n#${found.length - picked.length}\n#${left}` }
}

/**
 * Every row, in drawing order: the listings are ordered first (own tree,
 * newest, ticket), then at most MAX_ROWS markers are read; the rest only
 * counted (Q6). A row whose files fail to read is left out (D5 b: draws less).
 */
async function snapshot($: EngineInterface, trees: Trees, list: Lister): Promise<{ rows: Snapshot[]; hidden: { markers: number; trees: number };
  listed: string; scan: Scan }> {
  const scan = scanned(trees)
  const answered = new Set<string>()
  const found = await markersOf(list, scan.roots, answered)
  const { picked, signature: listed } = pick(found, trees, scan.left)
  const facts: Scan = { status: 'ok', trees: answered, unread: new Set(),
    paths: new Set(found.map(one => under(one.root, `.shawarma/${MARKER_PREFIX}${one.ticket}`))) }
  for (const marker of realDirs.keys()) if (!facts.paths.has(marker)) realDirs.delete(marker)
  for (const marker of lateDirs.keys()) if (!facts.paths.has(marker)) lateDirs.delete(marker)
  if (found.length === 0) return { rows: [], hidden: { markers: 0, trees: scan.left }, listed, scan: facts }
  const { startedAt } = await $.session.usage()
  const now = await $.clock.now()
  const rows: Snapshot[] = []
  for (const one of picked) {
    const row = await rowOf($, list, one, startedAt, now, trees.reals.get(one.root) ?? one.root).catch((err: unknown) => {
      $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' })
      return null
    })
    if (row !== null) rows.push(row)
    else facts.unread.add(under(one.root, `.shawarma/${MARKER_PREFIX}${one.ticket}`))
  }
  return { rows, hidden: { markers: found.length - picked.length, trees: scan.left }, listed, scan: facts }
}

/** Never throws: a failed discovery or read draws nothing rather than a stale row. */
async function refresh($: EngineInterface, trees: Trees | null = null, list: Lister = lister($)): Promise<void> {
  const next = await (async () => {
    const at = trees ?? (await discover($))
    lastTrees = at
    return snapshot($, at, list)
  })().catch((err: unknown) => {
    $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' })
    return { rows: [] as Snapshot[], hidden: { markers: 0, trees: 0 }, listed: null,
      scan: { status: 'failed', trees: new Set(), paths: new Set(), unread: new Set() } as Scan }
  })
  lastListed = next.listed
  lastScan = next.scan
  await update($, rowsAtom, () => next.rows)
  await update($, hiddenAtom, () => next.hidden)
  watch($, next.rows.length > 0 || moreText(next.hidden.markers, next.hidden.trees) !== null)
}

/** Starts the check when a row or the more-row is drawn (round 3 R3-3), stops it when neither is. */
function watch($: EngineInterface, isDrawn: boolean): void {
  if (!isDrawn || !isBandOn) {
    check?.cancel()
    check = null
  } else if (check === null) {
    check = $.clock.every(CHECK_MS, () => void stale($).catch(() => {
      lastScan = { status: 'failed', trees: new Set(), paths: new Set(), unread: new Set() }
      return update($, rowsAtom, () => [])
    }))
  }
}

/**
 * Lists only: each tree's `.shawarma` and each drawn plan dir, at most W + M
 * calls, no read and no stat (Q3). A refresh, reusing those listings, only
 * when a marker appeared, went or changed time, or a drawn plan dir's plan.md
 * or decisions.md did. A plan dir the row says is not found or not readable
 * was not confirmed inside its tree since it was last found missing or
 * unreadable: it is not listed, only asked whether
 * it exists, and a change in that (found now, or gone) starts the refresh (R4).
 */
async function stale($: EngineInterface): Promise<void> {
  const rows = await read($, rowsAtom)
  const hidden = await read($, hiddenAtom)
  if (rows.length === 0 && moreText(hidden.markers, hidden.trees) === null) return watch($, false)
  if (lastTrees === null) return refresh($)
  const trees = lastTrees
  const list = lister($)
  const scan = scanned(trees)
  let isChanged = lastListed === null || pick(await markersOf(list, scan.roots), trees, scan.left).signature !== lastListed
  for (const row of rows) {
    if (isChanged) break
    if (row.planDir === '') continue
    if (row.problem?.startsWith('plan dir not') === true) {
      isChanged = (await $.fs.exists(row.planDir)) !== row.problem.startsWith('plan dir not readable')
      continue
    }
    const entries = await list(row.planDir)
    isChanged = entries === null || timeIn(entries, 'plan.md') !== row.planAt || timeIn(entries, 'decisions.md') !== row.decisionsAt
  }
  if (isChanged) return refresh($, trees, list)
  // Q5: a row crosses 12 h (or out of the future window) with no file change: flip it on the clock, no file call.
  const now = await $.clock.now()
  if (rows.some(row => isStaleAt(row.since, now) !== row.isStale)) {
    await update($, rowsAtom, all => all.map(row => ({ ...row, isStale: isStaleAt(row.since, now) })))
  }
}

/** Opens the pane on `marker`; never throws. */
async function openOn($: EngineInterface, marker: string | null): Promise<{ isOpen: boolean; err?: unknown }> {
  await update($, chosen, () => marker).catch(() => undefined)
  return $.ui.open({ id: PANE, title: 'Shawarma' }).then(() => ({ isOpen: true }), (err: unknown) => ({ isOpen: false, err }))
}

/** Button keys, one per ticket; a ticket live in two trees gets its index too. */
function keysOf(rows: readonly Snapshot[]): string[] {
  return rows.map((row, i) => (rows.filter(other => other.ticket === row.ticket).length > 1 ? `row:${row.ticket}:${i}` : `row:${row.ticket}`))
}

export const register: Register = (on, options) => {
  isBandOn = options.band === true
  on('session.start', async ($, e, next) => {
    worktrees.clear()
    lateDirs.clear()
    if (options.pane === true) {
      await $.command
        .register({
          name: 'shawarma-companion',
          description: 'Show the active shawarma plans or runs: recap, decisions, amendments',
        })
        .catch((err: unknown) => $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' }))
    }
    await refresh($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (!WRITERS.has(e.tool)) return next(e)
    const result = await next(e)
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    worktrees.clear()
    lateDirs.clear()
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'shawarma-companion' }, async $ => {
    const first = (await read($, rowsAtom))[0]?.marker ?? null
    const out = await openOn($, first)
    return out.isOpen ? { text: 'Shawarma pane opened.' } : { text: `Shawarma pane could not open: ${String(out.err)}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rows = await read($, rowsAtom)
    const hidden = await read($, hiddenAtom)
    const more = moreText(hidden.markers, hidden.trees)
    // N3: the more-row is drawn even when no other row is.
    if (options.band !== true || (rows.length === 0 && more === null) || e.props.hasSurvey) return next(e)
    // A settings change re-registers the module without a session.start: the
    // first drawing after it restarts the check.
    watch($, true)
    const context =
      options.context === true
        ? await $.session.usage().then(usage => usage.context.percent, () => null)
        : undefined
    if (context === null) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const keys = keysOf(rows)
    return (
      <Box flexDirection="column">
        {rows.map((row, i) => {
          const key = keys[i] ?? `row:${i}`
          const text = (
            <Text key={key} dimColor={row.isEarlier || row.isStale}>
              {rowText({ ...row, context: i === 0 ? context : undefined }, e.props.bodyColumns, now)}
            </Text>
          )
          if (options.pane !== true) return text
          return (
            <Button key={key} plain onPress={() => void openOn($, row.marker)}>
              {text}
            </Button>
          )
        })}
        {more !== null ? <Text key="more" dimColor>{more.length <= e.props.bodyColumns ? more : `${more.slice(0, Math.max(0, e.props.bodyColumns - 1))}…`}</Text> : null}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Markdown, Text } = $.ui.resolve(e)
    const rows = await read($, rowsAtom)
    // Round 3: every sentence here comes from facts the last scan holds.
    if (lastScan.status === 'failed') return <Text dimColor>Shawarma state could not be read.</Text>
    const want = await read($, chosen)
    const picked = rows.find(one => one.marker === want)
    if (want !== null && picked === undefined) {
      const ticket = ticketOf(want.split('/').pop() ?? '') ?? want
      return <Text dimColor>{clean(`${ticket}: ${reasonFor(want)}`)}</Text>
    }
    if (rows.length === 0) {
      const hidden = await read($, hiddenAtom)
      const more = moreText(hidden.markers, hidden.trees)
      const unread = lastScan.unread.size
      const line = lastScan.status === 'none' ? 'No scan has run since the mod loaded.'
        : unread > 0 ? `${unread} ${unread === 1 ? 'marker' : 'markers'} could not be read.`
        : more !== null ? `No row drawn: ${more}` : 'No shawarma marker in the last scan.'
      return <Text dimColor>{line}</Text>
    }
    const row = picked ?? rows[0]!
    // N2: the others with their labels, never called live.
    const others = rows.filter(one => one !== row)
      .map(one => `${one.ticket}${one.isStale ? ' (stale)' : one.isEarlier ? ' (earlier session)' : ''}`)
    const header = others.length === 0 ? null : clean(`Other tickets: ${others.join(', ')}`)
    const label = labelOf(row)
    const problemLine = (problem: string) => {
      const line = <Text dimColor>{clean(`${label}shawarma: ${row.ticket}: ${problem} (${row.marker})`)}</Text>
      return header === null ? line : <Box flexDirection="column">{line}<Text dimColor>{header}</Text></Box>
    }
    if (row.planDir === '' && row.step !== 'trivial') return problemLine(row.problem ?? 'malformed marker')
    if (row.step === 'trivial') {
      const parts = [`${label}**${row.ticket}** · trivial`, ...(header === null ? [] : [header]), 'Trivial run: no brief.']
      return <Box flexDirection="column"><Markdown text={clean(parts.join('\n\n'), true)} /></Box>
    }
    // R4, R5: a plan dir the refresh found missing or unreadable was not confirmed inside since: its real path first.
    // A late answer this turn (the refresh's or the pane's own) reads as missing without asking again.
    let isMissing = false
    if (row.problem?.startsWith('plan dir not') === true) {
      const kept = lateDirs.get(row.marker)
      const isKept = kept !== undefined && kept.at === row.since && kept.dir === row.planDir
      const out = isKept ? { kind: 'late' as const } : await within($, $.fs.stat(row.planDir, { resolve: true }))
      if (out.kind === 'late') lateDirs.set(row.marker, { at: row.since, dir: row.planDir })
      const real = out.kind === 'ok' ? (out.value?.realPath ?? null) : null
      if (real !== null && !isInside(lastTrees?.reals.get(row.tree) ?? row.tree, real)) return problemLine('plan dir outside its tree')
      isMissing = real === null
    }
    const files = isMissing ? [null, null] as [null, null] : await planFiles($, row.planDir).catch((err: unknown) => String(err))
    if (typeof files === 'string') {
      return <Text dimColor>{clean(`The plan files could not be read: ${files}`)}</Text>
    }
    const [plan, decisions] = files
    const parts = [
      `${label}**${row.title}** · ${row.step}`,
      ...(header === null ? [] : [header]),
      plan === null ? '_No brief yet: the plan is in progress._' : `### Recap\n\n${section(plan, 1) ?? '_§1 not found._'}`,
      `### Decisions\n\n${decisions === null ? '_None recorded._' : lines(decisions.trim()).map(line => `- ${line}`).join('\n')}`,
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
