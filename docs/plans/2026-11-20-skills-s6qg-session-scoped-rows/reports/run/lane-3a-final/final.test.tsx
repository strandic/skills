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
  /** Run review (Q6): replace or stall the engine's answer to the named call; undefined passes it on. */
  hold?: Record<string, (e: any) => Promise<unknown> | undefined>
  /** Run review (Q6): awaited after the fake tool ran, before the call answers (a long call). */
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
  const on = ((name: string, ...args: any[]) => {
    const h = args[args.length - 1]
    if (git.hold?.[name] !== undefined) {
      args[args.length - 1] = async (...a: any[]) => { const r = await git.hold![name]!(a[1]); return r !== undefined ? r : h(...a) }
    } else if (name === 'tool.call' && git.after !== undefined) {
      args[args.length - 1] = async (...a: any[]) => { const r = await h(...a); await git.after!(a[1]); return r }
    }
    return (on0 as any)(name, ...args)
  }) as unknown as On
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


describe('lane 3a fix', () => {
  const at = (tree: string, ticket: string, when = STARTED + 5): [string, File] => [`${tree}/.shawarma/active-${ticket}`, { text: `${ticket}\ntrivial\n`, mtimeMs: when }]
  const rows = async ($: any): Promise<string[]> =>
    ((await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND }))
      .findAll({ type: 'Text' })) as any[]).map(one => (one.text as string).replace(/ · since.*/, ''))
  const V = `${ROOT}/.worktrees/v`
  const T0 = STARTED + 120_000
  const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => (globalThis as any).setTimeout(r, 1)) }
  const never = () => new Promise<never>(() => undefined)
  const turnEnd = ($: any) => $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)

  test('A1 B2 another session writes a marker in an unclaimed tree during a long call; the 15 s check lists it', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
    const store = new Map<string, unknown>()
    const clock = world(on, files, ROOT, [], new Set(), { claimed: [], store,
      after: (e: any) => (e.command === 'long' ? gate : undefined) })
    await bash($, 'true')
    const call = bash($, 'long')
    await settle()
    await clock.advance(5_000)
    files.set(...at(WT, 'other-1', T0 + 5_000))
    await clock.advance(15_000)
    await settle()
    release()
    await call
    await bash($, 'true')
    expect({ rows: await rows($), stored: (store.get(`claims:${SESSION}`) as any)?.trees })
      .toEqual({ rows: ['main-1 · trivial', '1 run in another worktree'], stored: [ROOT] })
  })

  test('A2 a subagent call that never ends: a marker another session writes 10 min later is claimed', { options: ON }, async ($, on) => {
    const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
    const clock = world(on, files, ROOT, [], new Set(), { claimed: [],
      after: (e: any) => (e.command === 'hang' ? never() : undefined) })
    await bash($, 'true')
    void $.tool.call({ tool: 'Bash', command: 'hang', agentId: 'a1' } as any)
    await settle()
    await turnEnd($)
    await clock.advance(600_000)
    files.set(...at(WT, 'other-1', T0 + 600_000))
    await clock.advance(15_000)
    await settle()
    expect(await rows($)).toEqual(['main-1 · trivial', '1 run in another worktree'])
  })

  test('A3 a long subagent call outlives a main turn end and 64 main writes; it writes its marker at its end: own run', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
    const clock = world(on, files, ROOT, [], new Set(), { claimed: [],
      after: (e: any) => (e.command === 'long' ? gate : undefined) })
    await bash($, 'true')
    const call = $.tool.call({ tool: 'Bash', command: 'long', agentId: 'a1' } as any)
    await settle()
    await turnEnd($)
    for (let i = 0; i < 64; i++) await write($, `${ROOT}/src/f${i}.ts`, 'x')
    await clock.advance(10_000)
    files.set(...at(WT, 'wt-7', T0 + 10_000))
    release()
    await call
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: wt-7 · trivial'])
  })

  test('A4 store.set for [ROOT, WT] gives up at 2 s, B lands [ROOT, WT, V], then A lands late', { options: ON }, async ($, on) => {
    let cwdNow = WT
    let first = true
    let releaseSet!: () => void
    const gate = new Promise<void>(r => (releaseSet = r))
    const store = new Map<string, unknown>()
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(WT, 'wt-1'), at(V, 'v-1')]), ROOT, [], new Set(), { claimed: [],
      trees: [ROOT, WT, V], store, cwdNow: () => cwdNow,
      hold: { 'store.set': () => (first ? (first = false, gate.then(() => undefined)) : undefined) } })
    const a = bash($, 'true')
    await settle()
    await clock.advance(2_000)
    await settle()
    await a
    cwdNow = V
    await bash($, 'true')
    const afterB = (store.get(`claims:${SESSION}`) as any)?.trees?.slice().sort()
    releaseSet()
    await settle()
    for (let i = 0; i < 3; i++) await bash($, 'true')
    expect({ afterB, final: (store.get(`claims:${SESSION}`) as any)?.trees?.slice().sort() })
      .toEqual({ afterB: [ROOT, V, WT], final: [ROOT, V, WT] })
  })

  test('A5 other sessions\' entries whose store.get runs past 2 s: kept, and the call answers within 2 advances', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    for (let i = 0; i < 100; i++) store.set(`claims:o${i}`, { trees: ['/other'], at: T0 - 1000 })
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store,
      hold: { 'store.get': (e: any) => (e.key === `claims:${SESSION}` ? undefined : never()) } })
    let done = false
    void bash($, 'true').then(() => { done = true })
    let advances = 0
    while (!done && advances < 400) { await settle(5); await clock.advance(2_000); advances += 1 }
    await settle()
    const others = [...store.keys()].filter(k => k.startsWith('claims:o')).length
    expect({ advances, others }).toEqual({ advances: 1, others: 100 })
  })

  test('A6 F4 residual: 56 trees, a Bash call from ROOT writes a marker into the 55th tree (no cd)', { options: ON }, async ($, on) => {
    const many = [ROOT, ...Array.from({ length: 55 }, (_, i) => `${ROOT}/.worktrees/t${String(i).padStart(2, '0')}`)]
    const far = many[54]!
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], trees: many })
    await bash($, 'true')
    await bash($, `mark ${far} far-1`)
    await bash($, 'true')
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: far-1 · trivial', '6 worktrees not scanned'])
  })

  test('A7 56 trees, a Write into the 55th tree from ROOT: rows after that call and after the next', { options: ON }, async ($, on) => {
    const many = [ROOT, ...Array.from({ length: 55 }, (_, i) => `${ROOT}/.worktrees/t${String(i).padStart(2, '0')}`)]
    const far = many[54]!
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(far, 'far-1')]), ROOT, [], new Set(), { claimed: [], trees: many })
    await bash($, 'true')
    await write($, `${far}/src/a.ts`, 'x')
    const first = await rows($)
    await bash($, 'true')
    expect({ first, second: await rows($) }).toEqual({
      first: ['main-1 · trivial', 'other tree: far-1 · trivial', '6 worktrees not scanned'],
      second: ['main-1 · trivial', 'other tree: far-1 · trivial', '6 worktrees not scanned'] })
  })

  test('A8 the id changes (/clear) while call A is paused inside claim: the new id\'s entry ends with every claim', { options: ON }, async ($, on) => {
    let cwdNow = WT
    let id = 'id1'
    let first = true
    let releaseRoot!: () => void
    const gate = new Promise<void>(r => (releaseRoot = r))
    const store = new Map<string, unknown>()
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(WT, 'wt-1')]), ROOT, [], new Set(), { claimed: [], store,
      cwdNow: () => cwdNow, id: () => id,
      hold: { 'session.root': () => (first ? (first = false, gate.then(() => undefined)) : undefined) } })
    const a = bash($, 'true')
    await settle()
    id = 'id2'
    cwdNow = ROOT
    await bash($, 'true')
    releaseRoot()
    await a
    await bash($, 'true')
    expect((store.get('claims:id2') as any)?.trees?.slice().sort()).toEqual([ROOT, WT])
  })

  test('A9 a call whose tool throws closes its span: another session\'s marker 60 s later is not claimed', { options: ON }, async ($, on) => {
    const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
    const clock = world(on, files, ROOT, [], new Set(), { claimed: [],
      hold: { 'tool.call': (e: any) => (e.command === 'boom' ? Promise.reject(new Error('boom')) : undefined) } })
    await bash($, 'true')
    const thrown = await bash($, 'boom').then(() => 'answered', (err: unknown) => String(err))
    await clock.advance(60_000)
    files.set(...at(WT, 'other-1', T0 + 60_000))
    await clock.advance(15_000)
    await settle()
    expect({ thrown, rows: await rows($) }).toEqual({ thrown: 'Error: boom', rows: ['main-1 · trivial', '1 run in another worktree'] })
  })

  test('A10 cost: store.set always rejects: store.set calls over 10 Bash calls; and with sets landing, over 10 calls', { options: ON }, async ($, on) => {
    let sets = 0
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [],
      hold: { 'store.set': () => (sets += 1, Promise.reject(new Error('full'))) } })
    for (let i = 0; i < 10; i++) await bash($, 'true')
    expect(sets).toBe(1)
  })

  test('A10c control: store.set lands: store.set calls over 10 Bash calls', { options: ON }, async ($, on) => {
    let sets = 0
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [],
      hold: { 'store.set': () => (sets += 1, undefined) } })
    for (let i = 0; i < 10; i++) await bash($, 'true')
    expect(sets).toBe(1)
  })
})

describe('lane 3a final', () => {
  const at = (tree: string, ticket: string, when = STARTED + 5): [string, File] => [`${tree}/.shawarma/active-${ticket}`, { text: `${ticket}\ntrivial\n`, mtimeMs: when }]
  const rows = async ($: any): Promise<string[]> =>
    ((await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND }))
      .findAll({ type: 'Text' })) as any[]).map(one => (one.text as string).replace(/ · since.*/, ''))
  const V = `${ROOT}/.worktrees/v`
  const T0 = STARTED + 120_000
  const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => (globalThis as any).setTimeout(r, 1)) }
  const never = () => new Promise<never>(() => undefined)
  const turnEnd = ($: any) => $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)
  /** Advances of 2 s the engine clock needs before `p` answers (at most `cap`). */
  const drive = async (clock: any, p: Promise<unknown>, cap = 400, step = 2_000) => {
    let done = false
    void p.then(() => { done = true }, () => { done = true })
    let n = 0
    await settle(60)
    while (!done && n < cap) { await clock.advance(step); n += 1; await settle(30) }
    return n
  }
  const sorted = (store: Map<string, unknown>, key: string) => (store.get(key) as any)?.trees?.slice().sort()

  // ---- isolation probe: does module state (isStoreUncertain) carry from one test to the next?
  test('P1 isolation, part 1: an abandoned store.set leaves isStoreUncertain set', { options: ON }, async ($, on) => {
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [],
      hold: { 'store.set': () => never() } })
    await drive(clock, bash($, 'true'))
    expect(true).toBe(true)
  })
  test('P2 isolation, part 2: own-key store.get calls over 3 calls with a calm store', { options: ON }, async ($, on) => {
    let gets = 0
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [],
      hold: { 'store.get': (e: any) => (e.key === `claims:${SESSION}` ? (gets += 1, undefined) : undefined) } })
    for (let i = 0; i < 3; i++) await bash($, 'true')
    expect(gets).toBe(1)
  })

  // ---- N1
  test('B1 (N1) long subagent call: marker written mid-call after its span was evicted (turn end + 64 writes), the 15 s check lists it, then the call ends', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
    const clock = world(on, files, ROOT, [], new Set(), { claimed: [],
      after: (e: any) => (e.command === 'long' ? gate : undefined) })
    await bash($, 'true')
    const call = $.tool.call({ tool: 'Bash', command: 'long', agentId: 'a1' } as any)
    await settle()
    await turnEnd($)
    for (let i = 0; i < 64; i++) await write($, `${ROOT}/src/f${i}.ts`, 'x')
    await clock.advance(10_000)
    files.set(...at(WT, 'wt-7', T0 + 10_000))
    await clock.advance(15_000)
    await settle()
    const during = await rows($)
    release()
    await call
    await bash($, 'true')
    expect({ during, after: await rows($) }).toEqual({
      during: ['main-1 · trivial', 'other tree: wt-7 · trivial'],
      after: ['main-1 · trivial', 'other tree: wt-7 · trivial'] })
  })
  test('B1c control: same, no 15 s check before the call ends (Q7-1 shape)', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
    const clock = world(on, files, ROOT, [], new Set(), { claimed: [],
      after: (e: any) => (e.command === 'long' ? gate : undefined) })
    await bash($, 'true')
    const call = $.tool.call({ tool: 'Bash', command: 'long', agentId: 'a1' } as any)
    await settle()
    await turnEnd($)
    for (let i = 0; i < 64; i++) await write($, `${ROOT}/src/f${i}.ts`, 'x')
    await clock.advance(10_000)
    files.set(...at(WT, 'wt-7', T0 + 10_000))
    release()
    await call
    await bash($, 'true')
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: wt-7 · trivial'])
  })
  test('B1d variant: turn end only (no 64 writes), the 15 s check lists the mid-call marker', { options: ON }, async ($, on) => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
    const clock = world(on, files, ROOT, [], new Set(), { claimed: [],
      after: (e: any) => (e.command === 'long' ? gate : undefined) })
    await bash($, 'true')
    const call = $.tool.call({ tool: 'Bash', command: 'long', agentId: 'a1' } as any)
    await settle()
    await turnEnd($)
    await clock.advance(10_000)
    files.set(...at(WT, 'wt-7', T0 + 10_000))
    await clock.advance(15_000)
    await settle()
    release()
    await call
    await bash($, 'true')
    expect(await rows($)).toEqual(['main-1 · trivial', 'other tree: wt-7 · trivial'])
  })

  // ---- N2
  const n2World = (on: any, store: Map<string, unknown>, extra: any = {}) => {
    let first = true
    let releaseSet!: () => void
    const gate = new Promise<void>(r => (releaseSet = r))
    const state = { cwdNow: WT, id: 'id1' }
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(WT, 'wt-1'), at(V, 'v-1')]), ROOT, [], new Set(), { claimed: [],
      trees: [ROOT, WT, V], store, cwdNow: () => state.cwdNow, id: () => state.id,
      hold: { 'store.set': () => (first ? (first = false, gate.then(() => undefined)) : undefined), ...(extra.hold ?? {}) } })
    return { clock, state, release: () => releaseSet() }
  }
  /** A's set for [ROOT, WT] abandoned at 2 s; B (cwd V) lands [ROOT, WT, V]. */
  const abandonThenLand = async ($: any, w: any) => {
    const a = bash($, 'true')
    await settle()
    await w.clock.advance(2_000)
    await settle()
    await a
    w.state.cwdNow = V
    await bash($, 'true')
  }
  test('B2 (N2 x /clear) A abandoned under id1, B lands id1, /clear to id2, then A lands late: id1 entry', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    const w = n2World(on, store)
    await abandonThenLand($, w)
    const id1AfterB = sorted(store, 'claims:id1')
    w.state.id = 'id2'
    await bash($, 'true')
    w.release()
    await settle()
    for (let i = 0; i < 3; i++) await bash($, 'true')
    await w.clock.advance(15_000)
    await settle()
    expect({ id1AfterB, id1: sorted(store, 'claims:id1'), id2: sorted(store, 'claims:id2') })
      .toEqual({ id1AfterB: [ROOT, V, WT], id1: [ROOT, V, WT], id2: [ROOT, V, WT] })
  })
  test('B2c control: same without /clear (Q7-2 shape)', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    const w = n2World(on, store)
    await abandonThenLand($, w)
    w.release()
    await settle()
    for (let i = 0; i < 3; i++) await bash($, 'true')
    expect(sorted(store, 'claims:id1')).toEqual([ROOT, V, WT])
  })
  test('B4a (N2) A lands late after the session\'s last claim, no further refresh: stored entry', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    const w = n2World(on, store)
    await abandonThenLand($, w)
    for (let i = 0; i < 3; i++) await bash($, 'true')
    w.release()
    await settle()
    expect(sorted(store, 'claims:id1')).toEqual([ROOT, V, WT])
  })
  test('B4b (N2) as B4a, then one 15 s check: stored entry', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    const w = n2World(on, store)
    await abandonThenLand($, w)
    for (let i = 0; i < 3; i++) await bash($, 'true')
    w.release()
    await settle()
    await w.clock.advance(15_000)
    await settle()
    expect(sorted(store, 'claims:id1')).toEqual([ROOT, V, WT])
  })
  test('B3 (N2 cost) one abandoned set, later sets land, own-key reads hang after restore: 2 s advances needed per call for 5 calls', { options: ON }, async ($, on) => {
    let reads = 0
    let first = true
    const store = new Map<string, unknown>()
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store,
      hold: {
        'store.set': () => (first ? (first = false, never()) : undefined),
        'store.get': (e: any) => (e.key === `claims:${SESSION}` ? (reads += 1, reads === 1 ? undefined : never()) : undefined),
      } })
    const setup = [await drive(clock, bash($, 'true')), await drive(clock, bash($, 'true'))]
    const per: number[] = []
    for (let i = 0; i < 5; i++) per.push(await drive(clock, bash($, 'true')))
    expect({ setup, per, reads }).toEqual({ setup: [1, 0], per: [0, 0, 0, 0, 0], reads: 1 })
  })
  test('B3c control: no abandoned set, own-key reads hang after restore', { options: ON }, async ($, on) => {
    let reads = 0
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [],
      hold: { 'store.get': (e: any) => (e.key === `claims:${SESSION}` ? (reads += 1, reads === 1 ? undefined : never()) : undefined) } })
    const per: number[] = []
    for (let i = 0; i < 5; i++) per.push(await drive(clock, bash($, 'true')))
    expect({ per, reads }).toEqual({ per: [0, 0, 0, 0, 0], reads: 1 })
  })

  // ---- hostile corpus on the N2 read-back: the own entry replaced after the abandoned write
  const big = Array.from({ length: 10_000 }, (_, i) => `/x/${i}`)
  const hostile: [string, unknown][] = [
    ['deleted', undefined], ['string', 'x'], ['array', []], ['null', null], ['trees string', { trees: 'x', at: 1 }],
    ['trees numbers', { trees: [1], at: 1 }], ['relative tree', { trees: ['rel'], at: 1 }], ['at NaN', { trees: [ROOT, WT, V], at: Number.NaN }],
    ['no at', { trees: [ROOT, WT, V] }], ['10 000 trees, V missing', { trees: [...big, ROOT, WT], at: 1 }],
    ['10 000 trees, all present', { trees: [...big, ROOT, WT, V], at: 1 }],
  ]
  for (const [name, value] of hostile) {
    test(`H (N2 read-back) own entry set to ${name} after the abandoned write: next call's entry holds every claim`, { options: ON }, async ($, on) => {
      const store = new Map<string, unknown>()
      const w = n2World(on, store)
      await abandonThenLand($, w)
      if (value === undefined) store.delete('claims:id1')
      else store.set('claims:id1', value)
      await bash($, 'true')
      const got = store.get('claims:id1') as any
      const trees: unknown = got?.trees
      expect(Array.isArray(trees) && [ROOT, WT, V].every(t => (trees as string[]).includes(t)) && Number.isFinite(got?.at)).toBe(true)
    })
  }
  test('Hc control: own entry set to "x" with no abandoned write before', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    world(on, new Map([at(ROOT, 'main-1', STARTED + 6), at(WT, 'wt-1')]), WT, [], new Set(), { claimed: [], store, id: 'id1', root: ROOT })
    await bash($, 'true')
    store.set('claims:id1', 'x')
    await bash($, 'true')
    expect(store.get('claims:id1')).toBe('x')
  })

  // ---- N3
  test('B5 (N3) 100 other sessions\' fresh entries, each store.get answering in 1.9 s: engine time the first call is held', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    for (let i = 0; i < 100; i++) store.set(`claims:o${i}`, { trees: ['/other'], at: T0 - 1000 })
    const pending: (() => void)[] = []
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store,
      hold: { 'store.get': (e: any) => (e.key === `claims:${SESSION}` ? undefined : new Promise<undefined>(r => pending.push(() => r(undefined)))) } })
    let done = false
    void bash($, 'true').then(() => { done = true })
    let ms = 0
    await settle(5)
    while (!done && ms < 400_000) { await clock.advance(1_900); ms += 1_900; pending.splice(0).forEach(f => f()); await settle(5) }
    const others = [...store.keys()].filter(k => k.startsWith('claims:o')).length
    expect({ heldMsAtMost4000: ms <= 4_000, ms, others }).toEqual({ heldMsAtMost4000: true, ms: 0, others: 100 })
  })
  test('B5c control: same 100 entries, store.get answers at once', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    for (let i = 0; i < 100; i++) store.set(`claims:o${i}`, { trees: ['/other'], at: T0 - 1000 })
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store })
    const n = await drive(clock, bash($, 'true'))
    expect({ n, others: [...store.keys()].filter(k => k.startsWith('claims:o')).length }).toEqual({ n: 0, others: 100 })
  })
  test('B6 (N3) 5000 keys: the first other key\'s get rejects, 4999 expired after it; three session ids in turn: keys left', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    store.set('claims:bad', { trees: ['/other'], at: T0 })
    for (let i = 0; i < 4999; i++) store.set(`claims:old${i}`, { trees: ['/other'], at: T0 - 40 * 86_400_000 })
    let id = 'id1'
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store, id: () => id,
      hold: { 'store.get': (e: any) => (e.key === 'claims:bad' ? Promise.reject(new Error('EIO')) : undefined) } })
    const n: number[] = []
    for (const one of ['id1', 'id2', 'id3']) { id = one; n.push(await drive(clock, bash($, 'true'))) }
    const old = [...store.keys()].filter(k => k.startsWith('claims:old')).length
    // Oracle: the pass examines at most 100 other keys per id; with a bad key first, 99 expired go per id (297 in all).
    expect({ n, old, bad: store.has('claims:bad') }).toEqual({ n: [0, 0, 0], old: 4999 - 297, bad: true })
  })
  test('B6c control: same 5000 keys, no failing key', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    store.set('claims:bad', { trees: ['/other'], at: T0 })
    for (let i = 0; i < 4999; i++) store.set(`claims:old${i}`, { trees: ['/other'], at: T0 - 40 * 86_400_000 })
    let id = 'id1'
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store, id: () => id })
    for (const one of ['id1', 'id2', 'id3']) { id = one; await drive(clock, bash($, 'true')) }
    const old = [...store.keys()].filter(k => k.startsWith('claims:old')).length
    expect({ old, bad: store.has('claims:bad') }).toEqual({ old: 4999 - 297, bad: true })
  })
  test('B7 (prune delete, unchanged line) 100 expired other entries, store.delete hangs: 2 s advances the first call needs', { options: ON }, async ($, on) => {
    const store = new Map<string, unknown>()
    for (let i = 0; i < 100; i++) store.set(`claims:o${i}`, { trees: ['/other'], at: T0 - 40 * 86_400_000 })
    const clock = world(on, new Map([at(ROOT, 'main-1', STARTED + 6)]), ROOT, [], new Set(), { claimed: [], store,
      hold: { 'store.delete': () => never() } })
    const n = await drive(clock, bash($, 'true'))
    expect(n).toBeLessThanOrEqual(2)
  })
})

describe('lane 3a final, B2 enumerate on the re-remembered span', () => {
  const at = (tree: string, ticket: string, when = STARTED + 5): [string, File] => [`${tree}/.shawarma/active-${ticket}`, { text: `${ticket}\ntrivial\n`, mtimeMs: when }]
  const rows = async ($: any): Promise<string[]> =>
    ((await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND }))
      .findAll({ type: 'Text' })) as any[]).map(one => (one.text as string).replace(/ · since.*/, ''))
  const T0 = STARTED + 120_000
  const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => (globalThis as any).setTimeout(r, 1)) }
  for (const [name, offset, want] of [
    ['B8 a marker dated 2.001 s after a 10 s call closed (re-remembered span): not claimed', 12_001, ['main-1 · trivial', '1 run in another worktree']],
    ['B8c control: dated 1.999 s after: claimed (slack)', 11_999, ['main-1 · trivial', 'other tree: o-1 · trivial']],
  ] as [string, number, string[]][]) {
    test(name, { options: ON }, async ($, on) => {
      let release!: () => void
      const gate = new Promise<void>(r => (release = r))
      const files = new Map([at(ROOT, 'main-1', STARTED + 6)])
      const clock = world(on, files, ROOT, [], new Set(), { claimed: [],
        after: (e: any) => (e.command === 'long' ? gate : undefined) })
      await bash($, 'true')
      const call = bash($, 'long')
      await settle()
      await clock.advance(10_000)
      release()
      await call
      files.set(...at(WT, 'o-1', T0 + offset))
      await clock.advance(15_000)
      await settle()
      expect(await rows($)).toEqual(want)
    })
  }
})
