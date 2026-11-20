import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { clean, clockTime, isInside, isStaleAt, order, ownTree, parentOf, parseDecisions, parseGitdir, parseMarker, parseWorktrees, redSet, resolvePath, rowText } from '../hooks/model'

const ROOT = '/repo'
const TICKET = 'skills-x'
const MARKER = `${ROOT}/.shawarma/active-${TICKET}`
const WT = `${ROOT}/.worktrees/w`
const DIR = `${ROOT}/docs/plans/2026-10-16-skills-x-thing`
// 2026-10-16 14:00 local: written times read as literal `14:01` (an oracle apart from clockTime).
const STARTED = new Date(2026, 9, 16, 14, 0).getTime()
const BAND = {
  hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 4 }, view: {},
} as const

type File = { text: string; mtimeMs: number; isLink?: boolean }
type Files = Map<string, File>

const MARKER_TEXT = (step: string) => `docs/plans/2026-10-16-skills-x-thing\n${step}\n`

/**
 * A fake tree beneath the plugin: fs, git, cwd and usage answer from it. Its
 * tools act on it: Write sets a file (mtime from a counter; content holding
 * `#race` is then replaced inside the same call by another writer), Edit
 * replaces `old_string` with `new_string` (not found: an error, nothing
 * changed, as the real Edit), Bash `rm <path>`
 * deletes one, Bash `echo <step> > .shawarma/active-<ticket>` writes that
 * marker of the cwd, `sh mark.sh <step>` writes MARKER, any other Bash changes
 * nothing. `fs.list` lists a folder as the Map holds it (a file: ENOTDIR; no
 * entry beneath: ENOENT, as the real engine, probe D6; `list <path>` in `fail`:
 * EACCES). `process.run` answers `git worktree list --porcelain` from `git.trees`
 * (default ROOT and WT) or `git.worktree` (`'reject'` or a raw answer), and
 * `git rev-parse` from `git.revparse` (default: the cwd's tree, ROOT's .git).
 * `fs.stat` of a path with entries beneath it answers a folder. ROOT holds
 * `.git/HEAD` (a main checkout's `.git` folder) unless `git.noRepo`. `fs.stat` rejects
 * `ENOENT` on a missing path, as the real one. Each name in `fail` makes that
 * call throw: `cwd`, `usage`, `open`, `register`, or `read <path>`; `cwd after
 * call` makes `cwd` throw once a tool call has run; `stat once <path>` makes
 * the next stat of that path fail with EACCES. A Write whose content holds
 * `#fail` errors and changes nothing; an Edit whose `old_string` is
 * `#appear` errors while another writer creates the file. Errors take core's
 * shape: `{ isError: true, result, text }`.
 */
type Answer = 'reject' | 'hang' | { exitCode: number; stdout: string | ((z: boolean) => string); truncated?: boolean }
type Git = { trees?: string[]; extra?: Record<string, string>; records?: string[][]; worktree?: Answer; revparse?: Answer;
  noRepo?: boolean; inits?: unknown[]; now?: number; links?: Record<string, string>; noReal?: boolean; hangStat?: string
  /** s6qg: the project root (default: the cwd), the session id (default SESSION), the store's entries (shared with the test when given). */
  root?: string | (() => string); id?: string | (() => string); store?: Map<string, unknown>
  /**
   * s6qg: the trees claimed before the test, seeded as this session's stored claims. Default `'all'`: every tree the
   * test names (git.trees, the records, each `.shawarma/` folder in the files), so a test written before s6qg still
   * reads every tree. `[]` claims none: only the cwd, the root and writes claim.
   */
  claimed?: string[] | 'all'
  /** s6qg: the working directory `$.session.cwd()` answers, when it moves during the test (tool paths still resolve against `cwd`). */
  cwdNow?: () => string
  /** s6qg: what a Bash call's result carries as `bashEditDiff` (raw); default: `touch <abs>` answers `{ changedFiles: [<abs>] }`. */
  bashDiff?: unknown
  /** lane 3a: per engine call name, a hook run first; a non-undefined answer replaces the call's answer. */
  hold?: Record<string, (e: any) => Promise<unknown> | undefined>
  /** lane 3a: awaited after the fake tool ran, before the call answers (a long call). */
  after?: (e: any) => Promise<unknown> | undefined }
const SESSION = 'sess-1'
/** Porcelain as git prints it: `-z` ends each attribute with NUL and each record with one more; else newlines. */
const render = (records: string[][], z: boolean) => z
  ? records.map(r => `${r.map(a => `${a}\0`).join('')}\0`).join('')
  : records.map(r => `${r.join('\n')}\n`).join('\n')
const recordsOf = (trees: string[], extra: Record<string, string> = {}) =>
  trees.map(tree => [`worktree ${tree}`, 'HEAD 0123abcd', extra[tree] ?? 'branch refs/heads/x'])

function world(on0: On, files: Files, cwd = ROOT, log: string[] = [], fail: Set<string> = new Set(), git: Git = {}) {
  let tick = STARTED + 60_000
  const on: any = (name: string, ...args: any[]) => {
    const h = args[args.length - 1]
    if (git.hold?.[name] !== undefined) {
      args[args.length - 1] = async (...a: any[]) => { const r = await git.hold![name]!(a[1]); return r !== undefined ? r : h(...a) }
    } else if (name === 'tool.call' && git.after !== undefined) {
      args[args.length - 1] = async (...a: any[]) => { const r = await h(...a); await git.after!(a[1]); return r }
    }
    return (on0 as any)(name, ...args)
  }
  if (git.noRepo !== true && !files.has(`${ROOT}/.git/HEAD`)) files.set(`${ROOT}/.git/HEAD`, { text: 'ref: refs/heads/main\n', mtimeMs: 1 })
  const clock = mock.clock(on, { now: git.now ?? STARTED + 120_000 })
  const failing = (name: string) => { if (fail.has(name)) throw new Error(`${name} failed`) }
  on('fs.exists', (_$, e) => (log.push(`exists ${e.path}`), { value: files.has(e.path) || [...files.keys()].some(k => k.startsWith(`${e.path}/`)) }))
  on('fs.read', (_$, e) => (log.push(`read ${e.path}`), failing(`read ${e.path}`), { value: files.get(e.path)?.text ?? '' }))
  // R1: `git.links` maps a link's path to its target; a stat with resolve answers realPath through them (absent with noReal).
  const realOf = (path: string): string => {
    const link = Object.keys(git.links ?? {}).sort((a, b) => b.length - a.length).find(k => path === k || path.startsWith(`${k}/`))
    return link === undefined ? path : realOf(`${git.links![link]}${path.slice(link.length)}`)
  }
  on('fs.stat', (_$, e) => {
    log.push(e.resolve === true ? `stat ${e.path} resolve` : `stat ${e.path}`)
    if (e.path === git.hangStat) return new Promise<never>(() => undefined)
    if (fail.delete(`stat once ${e.path}`)) throw new Error(`EACCES: permission denied, stat '${e.path}'`)
    const file = files.get(e.path)
    const real = e.resolve === true && git.noReal !== true ? { realPath: realOf(e.path) } : {}
    if (file === undefined && [...files.keys()].some(k => k.startsWith(`${e.path}/`))) {
      return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: e.path in (git.links ?? {}), ...real } }
    }
    if (file === undefined) throw new Error(`ENOENT: no such file, stat '${e.path}'`)
    return { value: { kind: 'file', size: 1, mtimeMs: file.mtimeMs, isLink: false, ...real } }
  })
  on('fs.list', (_$, e) => {
    log.push(`list ${e.path}`)
    if (fail.has(`list ${e.path}`)) throw new Error(`EACCES: permission denied, scandir '${e.path}'`)
    if (files.has(e.path)) throw new Error(`ENOTDIR: not a directory, scandir '${e.path}'`)
    const entries = new Map<string, any>()
    for (const [key, file] of files) {
      if (!key.startsWith(`${e.path}/`)) continue
      const rest = key.slice(e.path.length + 1)
      const name = rest.split('/')[0]!
      // A File with isLink lists as the real engine lists a link: kind 'other', isLink, time 0; stat and read follow it.
      entries.set(name, rest.includes('/') ? { name, kind: 'dir', size: 0, mtimeMs: 0, isLink: false }
        : file.isLink === true ? { name, kind: 'other', size: 0, mtimeMs: 0, isLink: true }
        : { name, kind: 'file', size: 1, mtimeMs: file.mtimeMs, isLink: false })
    }
    if (entries.size === 0) throw new Error(`ENOENT: no such file or directory, scandir '${e.path}'`)
    return { value: [...entries.values()] }
  })
  on('session.cwd', () => (failing('cwd'), { value: git.cwdNow?.() ?? cwd }))
  const pick = (v: string | (() => string) | undefined, fallback: string) => (typeof v === 'function' ? v() : v ?? fallback)
  on('session.root', () => (failing('root'), { value: pick(git.root, cwd) }))
  on('session.id', () => (failing('id'), { value: pick(git.id, SESSION) }))
  const store = git.store ?? new Map<string, unknown>()
  const seeded = git.claimed ?? 'all'
  const named = seeded !== 'all' ? seeded : [...new Set([
    ...(git.trees ?? [ROOT, WT]),
    ...(git.records ?? []).map(r => (r[0] ?? '').slice('worktree '.length)).filter(p => p.startsWith('/')),
    ...[...files.keys()].filter(k => k.includes('/.shawarma/')).map(k => k.slice(0, k.indexOf('/.shawarma/')) || '/'),
  ])]
  if (named.length > 0 && !store.has(`claims:${pick(git.id, SESSION)}`)) store.set(`claims:${pick(git.id, SESSION)}`, { trees: named, at: STARTED })
  on('store.get', (_$, e: any) => (failing('store'), fail.delete('store.get once') && (() => { throw new Error('store.get failed') })(), { value: store.get(e.key) }) as any)
  on('store.set', (_$, e: any) => (failing('store'), store.set(e.key, JSON.parse(JSON.stringify(e.value))), { value: undefined }) as any)
  on('store.delete', (_$, e: any) => (store.delete(e.key), { value: undefined }) as any)
  on('store.keys', () => ({ value: [...store.keys()] }) as any)
  on('process.run', (_$, e) => {
    log.push(`run ${e.argv.join(' ')}`)
    git.inits?.push(e.init)
    const trees = git.trees ?? [ROOT, WT]
    const isList = e.argv[1] === 'worktree'
    const z = e.argv.includes('-z')
    const answer = (isList ? git.worktree : git.revparse) ?? (isList
      ? { exitCode: 0, stdout: render(git.records ?? recordsOf(trees, git.extra), z) }
      : { exitCode: 0, stdout: `${[...trees].sort((a, b) => b.length - a.length).find(t => cwd === t || cwd.startsWith(`${t}/`)) ?? cwd}\n${e.argv.includes('--git-common-dir') ? `${ROOT}/.git\n` : ''}` })
    if (answer === 'reject') throw new Error('process.run denied')
    if (answer === 'hang') return new Promise<never>(() => undefined)
    const stdout = typeof answer.stdout === 'function' ? answer.stdout(z) : answer.stdout
    return { value: { exitCode: answer.exitCode, stdout, stderr: '', isStdoutTruncated: answer.truncated === true, isStderrTruncated: false } }
  })
  on('session.usage', () => (failing('usage'), {
    value: { startedAt: STARTED, context: { tokens: 1, window: 100, percent: 42 } } as any,
  }))
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return <Box /> })
  on('session.start', () => ({ cwd }) as any)
  on('turn.complete', () => ({ text: '' }))
  on('command.register', (_$, e) => { failing('register'); log.push(`command ${e.name}`); return { value: undefined } as any })
  on('ui.open', (_$, e) => { log.push(`open ${e.id}`); failing('open'); return { value: { isPlaced: true } } as any })
  on('tool.call', (_$, e: any) => {
    if (fail.has('cwd after call')) fail.add('cwd')
    tick += 1000
    const at = (path: string) => (path.startsWith('/') ? path : `${cwd}/${path}`)
    if (e.tool === 'Write' && e.content.includes('#fail')) {
      return { isError: true, result: 'Write failed', text: 'Write failed' } as any
    }
    if (e.tool === 'Edit' && e.old_string === '#appear') {
      files.set(at(e.file_path), { text: MARKER_TEXT('run OTHER'), mtimeMs: tick })
      return { isError: true, result: 'String to replace not found', text: 'String to replace not found' } as any
    }
    if (e.tool === 'Write') files.set(at(e.file_path), { text: e.content, mtimeMs: tick })
    if (e.tool === 'Write' && e.content.includes('#race')) {
      files.set(at(e.file_path), { text: MARKER_TEXT('run OTHER'), mtimeMs: tick + 1 })
    }
    if (e.tool === 'Edit') {
      const old = files.get(at(e.file_path))?.text
      if (old === undefined || !old.includes(e.old_string)) {
        return { isError: true, result: 'String to replace not found', text: 'String to replace not found' } as any
      }
      files.set(at(e.file_path), { text: old.replace(e.old_string, e.new_string), mtimeMs: tick })
    }
    if (e.tool === 'Bash' && e.command.startsWith('rm ')) files.delete(e.command.slice(3))
    const echo = /^echo (.*) > \.shawarma\/active-(\S+)$/.exec(e.command ?? '')
    if (e.tool === 'Bash' && echo !== null) {
      files.set(`${cwd}/.shawarma/active-${echo[2]}`, { text: MARKER_TEXT(echo[1] ?? ''), mtimeMs: tick })
    }
    const mark = /^sh mark\.sh (.*)$/.exec(e.command ?? '')
    if (e.tool === 'Bash' && mark !== null) files.set(MARKER, { text: MARKER_TEXT(mark[1] ?? ''), mtimeMs: tick })
    // `mark <tree> <ticket> [<ms>]`: a marker written during the call, its time the engine clock plus <ms> (default 0).
    const markIn = /^mark (\/\S+) (\S+)(?: (-?\d+))?$/.exec(e.command ?? '')
    if (e.tool === 'Bash' && markIn !== null) {
      files.set(`${markIn[1]}/.shawarma/active-${markIn[2]}`, { text: `${markIn[2]}\ntrivial\n`,
        mtimeMs: (git.now ?? STARTED + 120_000) + Number(markIn[3] ?? 0) })
    }
    const touch = /^touch (\/\S+)$/.exec(e.command ?? '')
    if (e.tool === 'Bash' && touch !== null) files.set(touch[1]!, { text: '', mtimeMs: tick })
    if (e.tool === 'Bash' && ('bashDiff' in git || touch !== null)) {
      return { result: { stdout: '', stderr: '', interrupted: false,
        bashEditDiff: 'bashDiff' in git ? git.bashDiff : { files: [], moreFiles: 0, changedFiles: [touch![1]] } } } as any
    }
    return { result: { type: 'text', text: 'ok' } } as any
  })
  return clock
}

const plan: [string, File] = [`${DIR}/plan.md`, { text: '# skills-x — the thing\n\n## 1. What\n\nwhy\n', mtimeMs: 0 }]
const decisions: [string, File] = [`${DIR}/decisions.md`, {
  text: '2026-10-16 | Q1 RULING | a | b\n2026-10-16 | D1 DEFAULT | c | d\n', mtimeMs: 0 }]

const write = ($: any, path: string, content: string) =>
  $.tool.call({ tool: 'Write', file_path: path, content } as any)
const bash = ($: any, command: string) => $.tool.call({ tool: 'Bash', command } as any)

async function bandText($: any): Promise<string | undefined> {
  const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  return (await ui.find({ type: 'Text' }))?.text
}

const ON = { band: true, pane: true, context: false }
const SINCE = (_n: number) => 'since 14:01'

const at = (tree: string, ticket: string, when = STARTED + 5): [string, File] => [`${tree}/.shawarma/active-${ticket}`, { text: `${ticket}\ntrivial\n`, mtimeMs: when }]
const rows = async ($: any): Promise<string[]> =>
  ((await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND }))
    .findAll({ type: 'Text' })) as any[]).map(one => (one.text as string).replace(/ · since.*/, ''))
const V = `${ROOT}/.worktrees/v`
const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 1)) }
const never = () => new Promise<never>(() => undefined)

describe('lane 3a run', () => {
  // Must stay first in the file: the module's lastSeen is null only before the first listing since load.
  test('X1 first refresh since load is the Bash call writing a new marker in a listed unclaimed tree', { options: ON }, async ($, on) => {
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [] })
    await bash($, `mark ${WT} wt-7`)
    await bash($, 'true')
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: wt-7 · trivial'])
  })

  test('X2 the 15 s check lists the new marker while the writing Bash call is still running', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const log: string[] = []
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, log, new Set(), { claimed: [],
      after: (e: any) => (String(e.command ?? '').startsWith('mark ') ? gate : undefined) })
    await bash($, 'true')
    await clock.advance(10_000)
    const call = bash($, `mark ${WT} wt-7 10000`)
    await settle()
    const n0 = log.length
    await clock.advance(15_000)
    await settle()
    const during = log.slice(n0).filter(l => l === `list ${WT}/.shawarma`).length
    release()
    await call
    await bash($, 'true')
    expect({ during, rows: await rows($) }).toEqual({ during: 1, rows: ['main-1 · trivial', 'other tree: wt-7 · trivial'] })
  })

  test('X2c control: same long call, no check in between', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [],
      after: (e: any) => (String(e.command ?? '').startsWith('mark ') ? gate : undefined) })
    await bash($, 'true')
    await clock.advance(10_000)
    const call = bash($, `mark ${WT} wt-7 10000`)
    await settle()
    await clock.advance(2_000)
    release()
    await call
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: wt-7 · trivial'])
  })

  test('X3 a parallel Write (4 s later) refreshes while the marker-writing Bash call runs', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [],
      after: (e: any) => (String(e.command ?? '').startsWith('mark ') ? gate : undefined) })
    await bash($, 'true')
    await clock.advance(10_000)
    const call = bash($, `mark ${WT} wt-7 10000`)
    await settle()
    await clock.advance(4_000)
    await write($, `${ROOT}/notes.txt`, 'x')
    release()
    await call
    await bash($, 'true')
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: wt-7 · trivial'])
  })

  test('X4 m16 interleave: call A paused at session.root inside claim while call B claims V', { options: ON }, async ($, on) => {
    let cwdNow = WT
    let first = true
    let releaseRoot!: () => void
    const gate = new Promise<void>(r => (releaseRoot = r))
    const store = new Map<string, unknown>()
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(WT, 'wt-1'), at(V, 'v-1')]), ROOT, [], new Set(), { claimed: [],
      trees: [ROOT, WT, V], store, cwdNow: () => cwdNow,
      hold: { 'session.root': () => (first ? (first = false, gate.then(() => undefined)) : undefined) } })
    const a = bash($, 'true')
    await settle()
    cwdNow = V
    await bash($, 'true')
    releaseRoot()
    await a
    await bash($, 'true')
    expect((store.get(`claims:${SESSION}`) as any)?.trees?.slice().sort()).toEqual([ROOT, V, WT])
    expect((await rows($)).filter(r => r.includes('other worktree'))).toEqual([])
  })

  test('X5 store.set answers out of order: A ([ROOT, WT]) lands after B ([ROOT, WT, V])', { options: ON }, async ($, on) => {
    let cwdNow = WT
    let first = true
    let releaseSet!: () => void
    const gate = new Promise<void>(r => (releaseSet = r))
    const store = new Map<string, unknown>()
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(WT, 'wt-1'), at(V, 'v-1')]), ROOT, [], new Set(), { claimed: [],
      trees: [ROOT, WT, V], store, cwdNow: () => cwdNow,
      hold: { 'store.set': () => (first ? (first = false, gate.then(() => undefined)) : undefined) } })
    const a = bash($, 'true')
    await settle()
    cwdNow = V
    await bash($, 'true')
    releaseSet()
    await a
    await bash($, 'true')
    await bash($, 'true')
    expect((store.get(`claims:${SESSION}`) as any)?.trees?.slice().sort()).toEqual([ROOT, V, WT])
  })

  for (const name of ['session.cwd', 'session.id', 'session.root', 'store.get', 'store.keys', 'store.set', 'store.delete']) {
    test(`X6 ${name} never answers: the Bash call still answers within 2 s of engine clock`, { options: ON }, async ($, on) => {
      const store = new Map<string, unknown>([['claims:old', { trees: [], at: 0 }]])
      const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store,
        hold: { [name]: () => never() } })
      let done = false
      void bash($, 'true').then(() => { done = true })
      await settle()
      await clock.advance(2_000)
      await settle()
      await clock.advance(60_000)
      await settle()
      expect(done).toBe(true)
    })
  }

  for (const [label, value] of [['null', null], ['an object', {}], ['a string', 'claims:x']] as const) {
    test(`X7 store.keys answers ${label}: the entry for this id is still written`, { options: ON }, async ($, on) => {
      const store = new Map<string, unknown>()
      world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store,
        hold: { 'store.keys': () => Promise.resolve({ value }) } })
      await bash($, 'true')
      await bash($, 'true')
      expect((store.get(`claims:${SESSION}`) as any)?.trees).toEqual([ROOT])
    })
  }

  test('X7b session.id answers undefined: no shared key written', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store,
      hold: { 'session.id': () => Promise.resolve({ value: undefined }) } })
    await bash($, 'true')
    expect([...store.keys()]).toEqual([])
  })

  test('X8 56 worktrees: a claimed other tree past the 50-tree scan cap (cd in, mark, cd back)', { options: ON }, async ($, on) => {
    const many = [ROOT, ...Array.from({ length: 55 }, (_, i) => `${ROOT}/.worktrees/t${String(i).padStart(2, '0')}`)]
    const far = many[54]!
    let cwdNow = ROOT
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], trees: many, cwdNow: () => cwdNow })
    await bash($, 'true')
    cwdNow = far
    await bash($, `mark ${far} far-1`)
    expect(await rows($)).toEqual(['far-1 · trivial', 'other tree: main-1 · trivial', '6 worktrees not scanned'])
    cwdNow = ROOT
    await bash($, 'true')
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: far-1 · trivial', '6 worktrees not scanned'])
  })

  test('X9 a session in no repository writes a store entry anyway', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    world(on, new Map(), '/scratch', [], new Set(), { claimed: [], store, noRepo: true, worktree: { exitCode: 128, stdout: '' } })
    await bash($, 'true')
    expect([...store.entries()]).toEqual([])
  })

  test('X10 a worktree path with spaces and unicode; git lists NFC, the cwd is NFD (real path NFD)', { options: ON }, async ($, on) => {
    const SP = `${ROOT}/.worktrees/w x`
    const NFC = `${ROOT}/.worktrees/café`
    const NFD = `${ROOT}/.worktrees/café`
    let cwdNow = `${SP}/src`
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(SP, 'sp-1'), at(NFC, 'u-1')]), ROOT, [], new Set(), { claimed: [],
      trees: [ROOT, SP, NFC], cwdNow: () => cwdNow, links: { [NFC]: NFD } })
    await bash($, 'true')
    expect(await rows($)).toEqual(['sp-1 · trivial', 'other tree: main-1 · trivial', '1 run in another worktree'])
    cwdNow = `${NFD}/src`
    await bash($, 'true')
    expect((await rows($))[0]).toBe('u-1 · trivial')
  })

  test('X11 B2 clock jumped back 31 days: other sessions\' live entries read as future-dated and deleted', { options: ON }, async ($, on) => {
    const now = STARTED + 120_000
    const store = new Map<string, unknown>([['claims:other', { trees: [WT], at: now + 31 * 86_400_000 }]])
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store })
    await bash($, 'true')
    expect([...store.keys()].sort()).toEqual(['claims:other', `claims:${SESSION}`])
  })
})
