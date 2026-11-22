import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsEntry, Register, Timer } from 'claude-code'

import type { Snapshot } from '../types'
import {
  CLAIM_TTL_MS, MARKER_PREFIX, changedFiles, claimKey, pruneStart, clean, order, ownTree, parseClaimed, parentOf, decisionRows, parseDecisions, parseGitdir, parseMarker, parseTitle, parseWorktrees,
  MAX_ROWS, MAX_TREES, isInside, isStaleAt, labelOf, moreText, redSet, resolvePath, rowText, section, ticketOf, under,
} from './model'

const PANE = 'shawarma-companion'
/** One row per live marker, in drawing order (Q4). */
const rowsAtom = atom({ plugin: 'shawarma-companion', key: 'rows' } as const, [])
/** The marker path the pane shows: set by a row press or the command. */
const chosen = atom({ plugin: 'shawarma-companion', key: 'chosen' } as const, null)
/** Q6, round 2 N3: markers listed but not read, and worktrees not scanned: one dimmed more-row. */
const hiddenAtom = atom({ plugin: 'shawarma-companion', key: 'hidden' } as const, { markers: 0, trees: 0, others: 0, otherTickets: [] as string[] })
/**
 * s6qg Q1: the tree roots this session claimed, as `git worktree list` (or the
 * fallback) spells them. Claims only grow. Kept in `$.state` (a hot reload keeps
 * it), in `lastClaims` (a `/clear` keeps the process), and in the store under
 * the session id (a `--resume` starts a new process, Q4).
 */
const claimsAtom = atom({ plugin: 'shawarma-companion', key: 'claims' } as const, [])
/** The claims last written, kept across a `/clear` in the same process (Q4). */
let lastClaims: readonly string[] = []
/** The session id the store last held these claims for: a `/clear` changes the id, so the next claim writes again. */
let storedFor: string | null = null
/** How many trees the last write that landed for `storedFor` held (lane 3a F6). */
let storedCount = 0
/** N2: a store write was given up on and may land later: each claim reads the entry back and rewrites a short one. */
let isStoreUncertain = false
/**
 * The session id whose stored claims were read in (Q4). Set only once that read
 * succeeded: until then the store is not written for that id, so a failed read
 * never overwrites what a resumed session had (lane A9c).
 */
let restoredFor: string | null = null
/**
 * Q3, lane A9a: the folders of the last MAX_FOLDERS paths this session's tools
 * wrote. Each refresh places them again against the trees it lists, so a write
 * into a worktree git did not list yet (made in the same turn) claims it once
 * listed.
 */
const folders: string[] = []
export const MAX_FOLDERS = 64
/**
 * Lane round 2 B4a2: every folder and call span of the current main turn, kept
 * until that turn's end refresh has placed them against a fresh worktree list,
 * at most MAX_TURN each; the last MAX_FOLDERS and MAX_WINDOWS carry over.
 */
const turnFolders: string[] = []
const turnWindows: { from: number; to: number }[] = []
export const MAX_TURN = 4096
/** Lane round 2 B2e: a marker this close to a call span counts as written in it (file times rounded to the second, clock skew). */
export const WINDOW_SLACK_MS = 2_000
/**
 * s6qg D1: the time spans of this session's last MAX_WINDOWS writing tool calls,
 * main session and subagents. A marker whose time falls in one claims its tree,
 * whatever tool wrote it (a Bash write into another worktree is in no
 * changed-files list: probed).
 */
const windows: { from: number; to: number }[] = []
export const MAX_WINDOWS = 64
/**
 * Lane round 3 C3: the marker paths of the last listing. Only a marker absent
 * from it whose time falls in a call span claims its tree, so another session's
 * rewrites of its own marker during this session's calls claim nothing. Null
 * until the first listing since load.
 */
let lastSeen: Set<string> | null = null
/** The main session's working directory, last read outside a subagent's hook (lane A9g). */
let mainCwd: string | null = null
/**
 * s6qg S1: a written folder in no tree as written (a Write spelled through a
 * link, `/tmp/…` for `/private/tmp/…`) has its real path asked, at most this many
 * folders per refresh, each answer kept until the turn ends; past the cap, or
 * with no answer in RUN_MS, it claims nothing that refresh.
 */
export const MAX_RESOLVE = 8
/** Per folder, its real path or null, asked this turn (cleared with `worktrees`). */
const folderReals = new Map<string, string | null>()
/** Q4: at most this many other store keys are examined per session id. */
export const MAX_PRUNE = 100

/** `items` as a list holding each once, the last MAX newest, after appending `more`. */
function remember<T>(list: T[], more: readonly T[], max: number, same: (a: T, b: T) => boolean): void {
  for (const one of more) {
    const at = list.findIndex(other => same(other, one))
    if (at !== -1) list.splice(at, 1)
    list.push(one)
  }
  if (list.length > max) list.splice(0, list.length - max)
}
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
 * listed marker. A picked marker that fails to read is a row (cm2l Q1).
 */
type Scan = { status: 'none' | 'ok' | 'failed'; trees: Set<string>; paths: Set<string> }
const NO_SCAN = (status: 'none' | 'failed'): Scan => ({ status, trees: new Set(), paths: new Set() })
let lastScan: Scan = NO_SCAN('none')

/** Why the chosen marker is not drawn, from facts the last scan holds only. */
function reasonFor(want: string): string {
  if (lastScan.status !== 'ok') return 'not shown (not in the last scan)'
  if (lastScan.paths.has(want)) return `not shown (past the ${MAX_ROWS}-row limit)`
  const tree = want.slice(0, want.lastIndexOf('/.shawarma/')) || '/'
  return lastScan.trees.has(tree) ? 'no longer active' : 'not shown (not in the last scan)'
}

/**
 * The trees to scan, and the one holding the session's cwd. `reals` maps each
 * scanned root to its real path, links followed (R3); a root missing from it
 * is used as given.
 */
type Trees = { own: string | null; roots: string[]; reals: ReadonlyMap<string, string>; isFromGit?: boolean }
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

/** Lane 3a F7: `work`'s value, raced against RUN_MS; a rejection or no answer in time throws. */
async function bounded<T>($: EngineInterface, work: Promise<T>): Promise<T> {
  const out = await within($, work)
  if (out.kind === 'ok') return out.value
  throw new Error(out.kind === 'late' ? `no answer in ${RUN_MS} ms` : 'call failed')
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

/**
 * s6qg Q1, Q3, Q4: the trees this session claims now: those already claimed;
 * the trees holding the main session's working directory and the project root;
 * the trees of the recent written folders, placed against `trees` now; and the
 * trees of the listed markers whose time falls in one of this session's writing
 * calls (D1). Written to `$.state` by merging (two refreshes can run at once:
 * lane A9e), and to the store when they changed or the session id did, once the
 * stored claims for that id were read in. A failed call claims less, never throws.
 */
async function claim($: EngineInterface, trees: Trees, found: readonly Found[], isSub = false): Promise<Set<string>> {
  // F8: an id that is not a non-empty string is no id (no shared `claims:undefined` key).
  const asked0 = await bounded($, $.session.id()).catch(() => null)
  const id = typeof asked0 === 'string' && asked0 !== '' ? asked0 : null
  if (id !== null && id !== restoredFor) {
    await restore($, id).then(() => { restoredFor = id }, (err: unknown) =>
      $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' }))
  }
  const held = new Set([...lastClaims, ...(await read($, claimsAtom))])
  const before = held.size
  // B7f: a subagent's hook reads its own cwd: with no main cwd known yet, the root alone.
  const cwd = mainCwd ?? (isSub ? null : await $.session.cwd().catch(() => null))
  const root = await bounded($, $.session.root()).catch(() => null)
  // S1: the engine gives the cwd and the root as real paths (probed): placed as written, else against each root's real path (B7a).
  for (const path of [cwd, root]) {
    const tree = path === null ? null : byReal(trees, path) ?? ownTree(path, trees.roots)
    if (tree !== null) held.add(tree)
  }
  const realRoots = trees.roots.map(one => ({ root: one, real: trees.reals.get(one) ?? one }))
  let asked = 0
  for (const folder of new Set([...folders, ...turnFolders])) {
    const tree = ownTree(folder, trees.roots)
    if (tree !== null) held.add(tree)
    // A9a: a folder under a root that git may not list yet is placed again next refresh; one in no tree, through its real path.
    if (tree !== null || trees.roots.length === 0) continue
    if (!folderReals.has(folder)) {
      if (asked >= MAX_RESOLVE) continue
      asked += 1
      folderReals.set(folder, await realOf($, folder))
    }
    const real = folderReals.get(folder) ?? null
    const hit = real === null ? undefined
      : realRoots.filter(one => isInside(one.real, real)).sort((a, b) => b.real.length - a.real.length)[0]
    if (hit !== undefined) held.add(hit.root)
  }
  const spans = [...windows, ...turnWindows]
  const seen = lastSeen
  const pathOf = (one: Found) => under(one.root, `.shawarma/${MARKER_PREFIX}${one.ticket}`)
  for (const one of found) {
    if (seen === null || seen.has(pathOf(one))) continue
    if (spans.some(span => one.at >= span.from - WINDOW_SLACK_MS && one.at <= span.to + WINDOW_SLACK_MS)) held.add(one.root)
  }
  lastSeen = new Set(found.map(pathOf))
  // F6: the entry is rewritten until a write holding every claim has landed (writes may land out of order).
  let isShort = false
  if (isStoreUncertain && id !== null && id === restoredFor && id === storedFor) {
    const back = await within($, $.store.get(claimKey(id)))
    const entry = back.kind === 'ok' ? parseClaimed(back.value) : null
    isShort = back.kind === 'ok' && (entry === null || lastClaims.some(tree => !entry.trees.includes(tree)))
  }
  if (!isShort && held.size === before && (id === null || (id === storedFor && storedCount === lastClaims.length))) return held
  const all = await update($, claimsAtom, prev => [...new Set([...(prev ?? []), ...held])])
  lastClaims = [...new Set([...lastClaims, ...all])]
  // F8: a session that claimed no tree writes no entry.
  if (id !== null && id === restoredFor && lastClaims.length > 0) {
    const now = await $.clock.now()
    const trees = [...lastClaims]
    // The write that lands last is what the store holds: its size, so a smaller one landing late is written again.
    await bounded($, $.store.set(claimKey(id), { trees, at: now })).then(() => {
      storedFor = id
      storedCount = trees.length
    }, (err: unknown) => {
      // N2: a write given up on may still land later: the next claim writes the whole list again, and later ones check.
      storedFor = null
      isStoreUncertain = true
      $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' })
    })
  }
  return new Set(lastClaims)
}

/** The root whose real path holds the real path `path`, the longest, else null (B7a). */
function byReal(trees: Trees, path: string): string | null {
  let best: { root: string; real: string } | null = null
  for (const root of trees.roots) {
    const real = trees.reals.get(root) ?? root
    if (isInside(real, path) && (best === null || real.length > best.real.length)) best = { root, real }
  }
  return best?.root ?? null
}

/**
 * Q4: the claims stored for `id` (a `--resume`) read in, then the other
 * `claims:` entries pruned (`prune`). Throws when the read of `id`'s entry fails.
 */
async function restore($: EngineInterface, id: string): Promise<void> {
  const now = await $.clock.now()
  const mine = parseClaimed(await bounded($, $.store.get(claimKey(id))))
  if (mine !== null) {
    const all = await update($, claimsAtom, prev => [...new Set([...(prev ?? []), ...lastClaims, ...mine.trees])])
    lastClaims = all
  }
  await prune($, id, now)
}

/**
 * Q4, skills-bnbu Q1, Q2: at most MAX_PRUNE other `claims:` entries examined,
 * from `pruneStart(id)`, wrapping: one untouched for 30 days, dated in the
 * future, or malformed, deleted. The whole pass (key list, reads, deletes)
 * ends RUN_MS after it starts, when the engine's timer fires; a read that
 * fails or answers none skips its entry; a call still running at the deadline
 * ends the pass, and a delete given up on may still land. Never throws.
 */
async function prune($: EngineInterface, id: string, now: number): Promise<void> {
  let timer: Timer | null = null
  const deadline = new Promise<Raced<never>>(resolve => { timer = $.clock.after(RUN_MS, () => resolve({ kind: 'late' })) })
  const race = <T,>(work: Promise<T>): Promise<Raced<T>> => Promise.race([
    work.then((value): Raced<T> => ({ kind: 'ok', value }), (): Raced<T> => ({ kind: 'failed' })),
    deadline,
  ]).catch((): Raced<T> => ({ kind: 'failed' }))
  try {
    // F8: a key list of another shape reads as none.
    const listed = await race($.store.keys())
    if (listed.kind !== 'ok' || !Array.isArray(listed.value)) return
    const keys = listed.value.filter((key): key is string =>
      typeof key === 'string' && key.startsWith('claims:') && key !== claimKey(id))
    const start = pruneStart(id, keys.length)
    for (let i = 0; i < Math.min(keys.length, MAX_PRUNE); i++) {
      const key = keys[(start + i) % keys.length] as string
      // Only an entry read in time is judged; a failed read skips it (6y0d), a late one ends the pass.
      const read = await race($.store.get(key))
      if (read.kind === 'late') return
      // A key listed but unset reads as `undefined`: nothing to delete, and a fault answering none spares a live entry.
      if (read.kind === 'failed' || read.value === undefined) continue
      const entry = parseClaimed(read.value)
      if (entry === null || now - entry.at > CLAIM_TTL_MS || entry.at > now + CLAIM_TTL_MS) {
        if ((await race($.store.delete(key))).kind === 'late') return
      }
    }
  } finally {
    ;(timer as Timer | null)?.cancel()
  }
}

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
async function discover($: EngineInterface, isSub = false): Promise<Trees> {
  // B7f: in a subagent's hook with no main cwd known, discover from the project root.
  const cwd = mainCwd ?? (isSub ? await $.session.root().catch(() => $.session.cwd()) : await $.session.cwd())
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
  // B7a: git may spell the roots through a link; the cwd and root are real paths.
  const probe: Trees = { ...found, reals }
  let own = byReal(probe, cwd) ?? found.own
  if (own === null) {
    const root = await $.session.root().catch(() => null)
    own = root === null ? null : byReal(probe, root) ?? ownTree(root, found.roots)
  }
  const trees: Trees = { ...found, own, reals, isFromGit: listed !== null }
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

/** The trees scanned: the own tree first, then the claimed trees (lane 3a F4), at most MAX_TREES (Q6); how many were left out. */
function scanned(trees: Trees): { roots: string[]; left: number } {
  const claimed = new Set(lastClaims)
  const rest = trees.roots.filter(root => root !== trees.own)
  const all = [...(trees.own === null ? [] : [trees.own]), ...rest.filter(root => claimed.has(root)), ...rest.filter(root => !claimed.has(root))]
  return { roots: all.slice(0, MAX_TREES), left: Math.max(0, all.length - MAX_TREES) }
}

const keyOf = (one: { root: string; ticket: string; at: number }) => `${under(one.root, `.shawarma/${MARKER_PREFIX}${one.ticket}`)}@${one.at}`

/** A listed marker: its tree root, its ticket and its time. */
type Found = { root: string; ticket: string; at: number }
/**
 * The markers to draw, in order, and the signature the check compares (N4):
 * only markers of claimed trees are drawn (s6qg Q1); the others are counted.
 */
function pick(found: Found[], trees: Trees, left: number, claims: ReadonlySet<string>): { picked: Found[]; others: Found[];
  signature: string } {
  const mine = found.filter(one => claims.has(one.root))
  const others = found.filter(one => !claims.has(one.root))
  const picked = order(mine.map(one => ({ ...one, tree: one.root, since: one.at })), trees.own).slice(0, MAX_ROWS)
  return { picked, others, signature: `${picked.map(keyOf).join('\n')}\n#${mine.length - picked.length}\n#${left}\n#${others.length}` }
}

/** cm2l Q1: the problem a row reads when its marker, plan dir or plan files fail to read. */
export const UNREAD = 'could not be read'

/**
 * Every row, in drawing order: the listings are ordered first (own tree,
 * newest, ticket), then at most MAX_ROWS markers are read; the rest only
 * counted (Q6). A row whose files fail to read is drawn as an UNREAD problem
 * row: its ticket, nothing it would have read (cm2l Q1).
 */
async function snapshot($: EngineInterface, trees: Trees, list: Lister, isSub = false): Promise<{ rows: Snapshot[];
  hidden: { markers: number; trees: number; others: number; otherTickets: string[] }; listed: string; scan: Scan }> {
  const scan = scanned(trees)
  const answered = new Set<string>()
  const found = await markersOf(list, scan.roots, answered)
  const claims = await claim($, trees, found, isSub)
  const { picked, others, signature: listed } = pick(found, trees, scan.left, claims)
  const pathOf = (one: Found) => under(one.root, `.shawarma/${MARKER_PREFIX}${one.ticket}`)
  const facts: Scan = { status: 'ok', trees: answered, paths: new Set(found.map(pathOf)) }
  const hidden = { markers: found.length - others.length - picked.length, trees: scan.left, others: others.length,
    otherTickets: [...new Set(others.map(one => one.ticket))].sort().slice(0, MAX_ROWS) }
  for (const marker of realDirs.keys()) if (!facts.paths.has(marker)) realDirs.delete(marker)
  for (const marker of lateDirs.keys()) if (!facts.paths.has(marker)) lateDirs.delete(marker)
  if (picked.length === 0) return { rows: [], hidden, listed, scan: facts }
  const { startedAt } = await $.session.usage()
  const now = await $.clock.now()
  const rows: Snapshot[] = []
  for (const one of picked) {
    const row = await rowOf($, list, one, startedAt, now, trees.reals.get(one.root) ?? one.root).then(
      made => ({ ...made, isOtherTree: one.root !== trees.own }), (err: unknown) => {
      $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' })
      return null
    })
    if (row !== null) {
      rows.push(row)
      continue
    }
    const marker = under(one.root, `.shawarma/${MARKER_PREFIX}${one.ticket}`)
    rows.push({ ticket: one.ticket, marker, tree: one.root, since: one.at, isEarlier: !(one.at > startedAt + 1),
      isStale: isStaleAt(one.at, now), decisions: 0, planDir: '', planAt: null, decisionsAt: null, title: '', step: '',
      problem: UNREAD, isOtherTree: one.root !== trees.own })
  }
  return { rows, hidden, listed, scan: facts }
}

/**
 * Never throws: a failed discovery or pass draws nothing, and a row whose files fail to read is drawn as
 * `could not be read`, never with a value read earlier.
 */
async function refresh($: EngineInterface, trees: Trees | null = null, list: Lister = lister($), isSub = false): Promise<void> {
  const next = await (async () => {
    const at = trees ?? (await discover($, isSub))
    lastTrees = at
    return snapshot($, at, list, isSub)
  })().catch((err: unknown) => {
    $.ui.log(`shawarma-companion: ${String(err)}`, { to: 'debug' })
    return { rows: [] as Snapshot[], hidden: { markers: 0, trees: 0, others: 0, otherTickets: [] as string[] }, listed: null,
      scan: NO_SCAN('failed') }
  })
  lastListed = next.listed
  lastScan = next.scan
  await update($, rowsAtom, () => next.rows)
  await update($, hiddenAtom, () => next.hidden)
  // cm2l Q3: a failed refresh while the check runs keeps it running, so the rows come back once the error clears.
  watch($, next.rows.length > 0 || moreText(next.hidden.markers, next.hidden.trees, next.hidden.others) !== null
    || (next.scan.status === 'failed' && check !== null))
}

/** cm2l Q3: a check that throws acts as a failed refresh: no rows, no counts, the scan failed; the check goes on. */
async function failed($: EngineInterface): Promise<void> {
  lastScan = NO_SCAN('failed')
  lastListed = null
  await update($, rowsAtom, () => [])
  await update($, hiddenAtom, () => ({ markers: 0, trees: 0, others: 0, otherTickets: [] as string[] }))
}

/** Starts the check when a row or the more-row is drawn (round 3 R3-3), stops it when neither is. */
function watch($: EngineInterface, isDrawn: boolean): void {
  if (!isDrawn || !isBandOn) {
    check?.cancel()
    check = null
  } else if (check === null) {
    check = $.clock.every(CHECK_MS, () => void stale($).catch(() => failed($)).catch(() => undefined))
  }
}

/**
 * Lists only: each tree's `.shawarma` and each drawn plan dir, at most W + M
 * calls, no read and no stat (Q3). A refresh, reusing those listings, only
 * when a marker appeared, went or changed time, or a drawn plan dir's plan.md
 * or decisions.md did. A row that could not be read, or whose plan dir is not
 * readable, starts the refresh every pass (cm2l Q2, Q4); the refresh asks the
 * plan dir's real path before it lists it. A plan dir the row says is not found
 * was not confirmed inside its tree since it was last found missing: it is not
 * listed, only asked whether it exists, and a change in that (found now), or a
 * failed ask, starts the refresh (R4).
 */
async function stale($: EngineInterface): Promise<void> {
  const rows = await read($, rowsAtom)
  const hidden = await read($, hiddenAtom)
  if (rows.length === 0 && moreText(hidden.markers, hidden.trees, hidden.others ?? 0) === null && lastScan.status !== 'failed') {
    return watch($, false)
  }
  if (lastTrees === null) return refresh($)
  const trees = lastTrees
  const list = lister($)
  const scan = scanned(trees)
  // A9i: the timer reads the session's own directory; a `/cd` with no tool call is claimed here.
  mainCwd = await $.session.cwd().catch(() => mainCwd)
  const found = await markersOf(list, scan.roots)
  const claims = await claim($, trees, found)
  let isChanged = lastListed === null || pick(found, trees, scan.left, claims).signature !== lastListed
  for (const row of rows) {
    if (isChanged) break
    // cm2l Q2: a row that could not be read is read again each pass, for as long as it fails; so is a plan dir that did
    // not list (Q4): the refresh asks its real path first, as at any update, then lists it.
    if (row.problem === UNREAD || row.problem?.startsWith('plan dir not readable') === true) {
      isChanged = true
      continue
    }
    if (row.planDir === '') continue
    if (row.problem?.startsWith('plan dir not') === true) {
      // cm2l: an exists that rejects starts the refresh, which draws the row again from what it reads now.
      const isThere = await $.fs.exists(row.planDir).catch(() => null)
      isChanged = isThere === null || isThere !== row.problem.startsWith('plan dir not readable')
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
    folderReals.clear()
    storedFor = null
    restoredFor = null
    mainCwd = e.cwd
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
    // The hook's own cwd: a subagent's in a subagent's call (d.ts `$.session.cwd`), for its relative paths.
    const cwd = await $.session.cwd().catch(() => null)
    // Lane 3a F1, F2: the span is open while the call runs, so a refresh during it (the 15 s check, a parallel
    // call) already counts a marker the call writes.
    const span = { from: await $.clock.now(), to: Number.POSITIVE_INFINITY }
    remember(windows, [span], MAX_WINDOWS, () => false)
    remember(turnWindows, [span], MAX_TURN, () => false)
    // N1: a closed span is remembered again as the newest, so a long call's span outlives newer calls and a turn end.
    const result = await next(e).finally(async () => {
      span.to = await $.clock.now()
      remember(windows, [span], MAX_WINDOWS, (a, b) => a === b)
      remember(turnWindows, [span], MAX_TURN, (a, b) => a === b)
    })
    const isMain = (e as { agentId?: unknown }).agentId === undefined
    if (isMain) mainCwd = await $.session.cwd().catch(() => mainCwd)
    // Q3: a file tool's path (relative to the cwd read before the call) or a Bash call's changed files claim their trees.
    const input = e as { file_path?: unknown; notebook_path?: unknown }
    const path = e.tool === 'NotebookEdit' ? input.notebook_path : e.tool === 'Bash' ? undefined : input.file_path
    const paths = typeof path === 'string' && path !== '' && (path.startsWith('/') || cwd !== null) ? [resolvePath(cwd ?? '/', path)] : []
    // Lane finding 5: changed files are folded like a tool's path (`..`, `//`).
    if (e.tool === 'Bash' && 'result' in result) paths.push(...changedFiles(result.result).map(one => resolvePath('/', one)))
    remember(folders, paths.map(parentOf), MAX_FOLDERS, (a, b) => a === b)
    remember(turnFolders, paths.map(parentOf), MAX_TURN, (a, b) => a === b)
    await refresh($, null, lister($), !isMain)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    worktrees.clear()
    lateDirs.clear()
    folderReals.clear()
    const isMain = (e as { agentId?: unknown }).agentId === undefined
    if (isMain) mainCwd = await $.session.cwd().catch(() => mainCwd)
    await refresh($, null, lister($), !isMain)
    // B4a2: the main turn's end placed this turn's folders and spans against a fresh git list; the last 64 carry
    // over. C6b3: a turn end listed by the fallback (git failed) keeps them for the next turn.
    if (isMain && lastTrees?.isFromGit === true) {
      turnFolders.splice(0)
      turnWindows.splice(0)
    }
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
    const more = moreText(hidden.markers, hidden.trees, hidden.others ?? 0)
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
      const more = moreText(hidden.markers, hidden.trees, hidden.others ?? 0)
      const line = lastScan.status === 'none' ? 'No scan has run since the mod loaded.'
        : more !== null ? `No row drawn: ${more}` : 'No shawarma marker in the last scan.'
      const away = hidden.otherTickets ?? []
      return <Text dimColor>{clean(away.length === 0 ? line : `${line}\nIn other worktrees: ${away.map(one => clean(one)).join(', ')}`, true)}</Text>
    }
    const row = picked ?? rows[0]!
    // N2: the others with their labels, never called live.
    const others = rows.filter(one => one !== row)
      .map(one => `${one.ticket}${one.isStale ? ' (stale)' : one.isEarlier ? ' (earlier session)' : ''}`)
    const away = (await read($, hiddenAtom)).otherTickets ?? []
    // B6d: each name with no line break, so a ticket cannot open a Markdown line of its own.
    const lines2 = [...(others.length === 0 ? [] : [`Other tickets: ${others.map(one => clean(one)).join(', ')}`]),
      ...(away.length === 0 ? [] : [`In other worktrees: ${away.map(one => clean(one)).join(', ')}`])]
    const header = lines2.length === 0 ? null : clean(lines2.join('\n'), true)
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
    const dated = decisions === null ? [] : decisionRows(decisions)
    const parts = [
      `${label}**${row.title}** · ${row.step}`,
      ...(header === null ? [] : [header]),
      plan === null ? '_No brief yet: the plan is in progress._' : `### Recap\n\n${section(plan, 1) ?? '_§1 not found._'}`,
      `### Decisions\n\n${dated.length === 0 ? '_None recorded._' : dated.map(line => `- ${line}`).join('\n')}`,
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
