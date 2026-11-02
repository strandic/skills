import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { clean, clockTime, isStaleAt, order, parentOf, parseDecisions, parseGitdir, parseMarker, parseWorktrees, redSet, resolvePath, rowText } from '../hooks/model'

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
  noRepo?: boolean; inits?: unknown[]; now?: number }
/** Porcelain as git prints it: `-z` ends each attribute with NUL and each record with one more; else newlines. */
const render = (records: string[][], z: boolean) => z
  ? records.map(r => `${r.map(a => `${a}\0`).join('')}\0`).join('')
  : records.map(r => `${r.join('\n')}\n`).join('\n')
const recordsOf = (trees: string[], extra: Record<string, string> = {}) =>
  trees.map(tree => [`worktree ${tree}`, 'HEAD 0123abcd', extra[tree] ?? 'branch refs/heads/x'])

function world(on: On, files: Files, cwd = ROOT, log: string[] = [], fail: Set<string> = new Set(), git: Git = {}) {
  let tick = STARTED + 60_000
  if (git.noRepo !== true && !files.has(`${ROOT}/.git/HEAD`)) files.set(`${ROOT}/.git/HEAD`, { text: 'ref: refs/heads/main\n', mtimeMs: 1 })
  const clock = mock.clock(on, { now: git.now ?? STARTED + 120_000 })
  const failing = (name: string) => { if (fail.has(name)) throw new Error(`${name} failed`) }
  on('fs.exists', (_$, e) => (log.push(`exists ${e.path}`), { value: files.has(e.path) || [...files.keys()].some(k => k.startsWith(`${e.path}/`)) }))
  on('fs.read', (_$, e) => (log.push(`read ${e.path}`), failing(`read ${e.path}`), { value: files.get(e.path)?.text ?? '' }))
  on('fs.stat', (_$, e) => {
    log.push(`stat ${e.path}`)
    if (fail.delete(`stat once ${e.path}`)) throw new Error(`EACCES: permission denied, stat '${e.path}'`)
    const file = files.get(e.path)
    if (file === undefined && [...files.keys()].some(k => k.startsWith(`${e.path}/`))) {
      return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } }
    }
    if (file === undefined) throw new Error(`ENOENT: no such file, stat '${e.path}'`)
    return { value: { kind: 'file', size: 1, mtimeMs: file.mtimeMs, isLink: false } }
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
  on('session.cwd', () => (failing('cwd'), { value: cwd }))
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

describe('band', () => {
  test('no marker: nothing drawn', { options: ON }, async ($, on) => {
    world(on, new Map())
    await bash($, 'true')
    expect(await bandText($)).toBe(undefined)
  })

  test('marker this session wrote, plan and decisions: the row', { options: ON }, async ($, on) => {
    world(on, new Map([plan, decisions]))
    await write($, MARKER, MARKER_TEXT('run W3 review'))
    expect(await bandText($)).toBe(`skills-x — the thing · run W3 review · ${SINCE(1)} · 2 decisions`)
  })

  test('marker written through Bash: no label (Q1)', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await bash($, `echo plan 2 spike > .shawarma/active-${TICKET}`)
    expect(await bandText($)).toBe(`skills-x — the thing · plan 2 spike · ${SINCE(1)} · 0 decisions`)
  })

  test('marker changed by a call that did not name it: no label (Q1)', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await bash($, 'sh mark.sh plan 2 spike')
    expect(await bandText($)).toMatch(/^skills-x — the thing · plan 2 spike/)
  })

  test('marker older than the session: earlier-session label', { options: ON }, async ($, on) => {
    world(on, new Map([[MARKER, { text: MARKER_TEXT('plan 2 spike'), mtimeMs: STARTED - 1 }], plan]))
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^earlier session: skills-x — the thing · plan 2 spike/)
  })

  test('marker another session wrote after this one started: no label (Q1)', { options: ON }, async ($, on) => {
    world(on, new Map([[MARKER, { text: MARKER_TEXT('plan 3'), mtimeMs: STARTED + 5 }], plan]))
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^skills-x — the thing · plan 3/)
  })

  test('a worktree\'s marker is drawn (git worktree list)', { options: ON }, async ($, on) => {
    const tree = WT
    world(on, new Map([[`${tree}/docs/plans/2026-10-16-skills-x-thing/plan.md`, plan[1]]]))
    await write($, `${tree}/.shawarma/active-${TICKET}`, MARKER_TEXT('run W0'))
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W0 · /)
  })

  test('marker deleted by a Bash call: the row goes', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W3 review'))
    expect(await bandText($)).toMatch(/run W3 review/)
    await bash($, `rm ${MARKER}`)
    expect(await bandText($)).toBe(undefined)
  })

  test('band off: nothing drawn', { options: { ...ON, band: false } }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W3 review'))
    expect(await bandText($)).toBe(undefined)
  })

  test('context on: ctx field', { options: { ...ON, context: true } }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W3 review'))
    expect(await bandText($)).toMatch(/ · ctx 42%$/)
  })

  test('malformed marker: a problem line', { options: ON }, async ($, on) => {
    world(on, new Map())
    await write($, MARKER, 'just one line\n')
    expect(await bandText($)).toBe(`shawarma: ${TICKET}: malformed marker`)
  })
})

describe('band, more', () => {
  test('an edit of decisions.md updates the count', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W3'))
    expect(await bandText($)).toMatch(/ · 0 decisions$/)
    await write($, `${DIR}/decisions.md`, '2026-10-16 | R1 (Q1, bound) | a | b\n')
    expect(await bandText($)).toMatch(/ · 1 decision$/)
  })

  test('plan dir missing: the row says so', { options: ON }, async ($, on) => {
    world(on, new Map())
    await write($, MARKER, MARKER_TEXT('plan 1'))
    expect(await bandText($)).toMatch(/ · plan dir not found: \/repo\/docs\/plans\/2026-10-16-skills-x-thing$/)
  })

  test('a Write of a relative marker path is drawn', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, `.shawarma/active-${TICKET}`, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W1/)
  })

  test('control characters in the title are not drawn', { options: ON }, async ($, on) => {
    world(on, new Map([[`${DIR}/plan.md`, { text: '# skills-x \u001b[31mred\n', mtimeMs: 0 }]]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    const text = await bandText($)
    expect(text).toMatch(/^skills-x  \[31mred · run W1/)
  })

  test('a survey above the prompt: nothing drawn', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt',
      props: { ...BAND, hasSurvey: true } } as any)
    expect((await ui.find({ type: 'Text' }))?.text).toBe(undefined)
  })

  test('earlier-session rows are dimmed, current rows are not (Q1)', { options: ON }, async ($, on) => {
    const files = new Map([[MARKER, { text: MARKER_TEXT('plan 2'), mtimeMs: STARTED - 1 }], plan])
    world(on, files)
    await bash($, 'true')
    const mount = () => $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND } as any)
    expect((await (await mount()).find({ type: 'Text' }))?.props.dimColor).toBe(true)
    await write($, MARKER, MARKER_TEXT('plan 3'))
    expect((await (await mount()).find({ type: 'Text' }))?.props.dimColor).toBe(false)
    await bash($, 'sh mark.sh plan 4')
    expect((await (await mount()).find({ type: 'Text' }))?.props.dimColor).toBe(false)
  })

  test('desktop surface draws the row', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'desktop', component: 'AbovePrompt', props: BAND } as any)
    expect((await ui.find({ type: 'Text' }))?.text).toMatch(/run W1/)
  })

  test('no options given: the manifest defaults apply (band on, context off)', async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    const text = await bandText($)
    expect(text).toMatch(/run W1/)
    expect(text).not.toMatch(/ctx/)
  })
})

describe('writes of the marker (was: own writes, R6)', () => {
  test('an Edit of the marker path is drawn', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    await $.tool.call({ tool: 'Edit', file_path: MARKER, old_string: 'run W1', new_string: 'run W2' } as any)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W2 · /)
  })

  test('another writer landing inside this session\'s Write: its text, no label', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, `${MARKER_TEXT('run W1')}#race\n`)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER · /)
  })

  test('replaced after the call with the same mtime: the new text, no label', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    files.set(MARKER, { text: MARKER_TEXT('run OTHER'), mtimeMs: files.get(MARKER)!.mtimeMs })
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER · /)
  })

  test('turn end re-reads the marker', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    files.set(MARKER, { text: MARKER_TEXT('run W2'), mtimeMs: STARTED + 130_000 })
    await $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)
  })
})

describe('session start', () => {
  test('a marker already there at session start is drawn before any tool call', { options: ON }, async ($, on) => {
    world(on, new Map([[MARKER, { text: MARKER_TEXT('plan 2 spike'), mtimeMs: STARTED - 1 }], plan]))
    await $.session.start({ source: 'startup', cwd: ROOT } as any)
    expect(await bandText($)).toMatch(/^earlier session: skills-x — the thing · plan 2 spike/)
  })
})

describe('check every 15 s (R5)', () => {
  test('marker replaced while idle: the row follows within 15 s, not before', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    const clock = world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    files.set(MARKER, { text: MARKER_TEXT('run W2'), mtimeMs: STARTED + 130_000 })
    await clock.advance(14_000)
    expect(await bandText($)).toMatch(/run W1/)
    await clock.advance(1_000)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)
  })

  test('marker deleted while idle: the row goes within 15 s', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    const clock = world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/run W1/)
    files.delete(MARKER)
    await clock.advance(15_000)
    expect(await bandText($)).toBe(undefined)
  })

  test('unchanged files: at most W + 2M fs calls a period, no re-read (Q3)', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const n0 = log.length
    await clock.advance(60_000)
    const calls = log.slice(n0)
    expect(calls.filter(line => line.startsWith('read ')).length).toBe(0)
    expect(calls.filter(line => line === `list ${ROOT}/.shawarma`).length).toBe(4)
    expect(calls.length <= 4 * (2 + 2 * 1)).toBe(true)
  })

  test('no row drawn: no check runs', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await bash($, 'true')
    const before = log.length
    await clock.advance(60_000)
    expect(log.length).toBe(before)
  })

  test('band off: no check runs', { options: { ...ON, band: false } }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const before = log.length
    await clock.advance(60_000)
    expect(log.length).toBe(before)
  })
})

describe('pane', () => {
  const PLAN = '# skills-x — the thing\n\n## 1. What\n\nthe recap\n\n## 4. Tests\n\nPredicted red set: **t1, t2**\n\n## 9. Amendments\n\n| W0 | row |\n'
  const pane = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    return (await ui.find({ type: 'Markdown' }))?.props.text as string | undefined
  }

  test('recap, decisions, amendments, red set', { options: ON }, async ($, on) => {
    world(on, new Map([[`${DIR}/plan.md`, { text: PLAN, mtimeMs: 0 }], decisions]))
    await write($, MARKER, MARKER_TEXT('run W3'))
    const text = await pane($)
    expect(text).toMatch(/### Recap\n\nthe recap/)
    expect(text).toMatch(/- 2026-10-16 \| Q1 RULING \| a \| b/)
    expect(text).toMatch(/### Amendments\n\n\| W0 \| row \|/)
    expect(text).toMatch(/### Red set\n\nPredicted red set: \*\*t1, t2\*\*/)
  })

  test('no brief yet', { options: ON }, async ($, on) => {
    world(on, new Map([[`${DIR}/x`, { text: '', mtimeMs: 0 }]]))
    await write($, MARKER, MARKER_TEXT('plan 2'))
    expect(await pane($)).toMatch(/_No brief yet: the plan is in progress._\n\n### Decisions\n\n_None recorded._$/)
  })

  test('pane on: the command is registered and a press on the row opens the pane', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan]), ROOT, log)
    await $.session.start({ source: 'startup', cwd: ROOT } as any)
    await write($, MARKER, MARKER_TEXT('run W1'))
    await bandText($)
    await $.ui.press({ plugin: 'shawarma-companion', key: `row:${TICKET}` })
    expect(log.filter(line => !/^(exists|stat|read|list|run) /.test(line))).toEqual(['command shawarma-companion', 'open shawarma-companion'])
  })

  test('pane off: no command, no button', { options: { ...ON, pane: false } }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan]), ROOT, log)
    await $.session.start({ source: 'startup', cwd: ROOT } as any)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND } as any)
    expect(await ui.find({ type: 'Button' })).toBe(undefined)
    expect(log.filter(line => !/^(exists|stat|read|list|run) /.test(line))).toEqual([])
  })
})

describe('model', () => {
  test('parseMarker', async () => {
    expect(parseMarker('d\nrun W0\n', ROOT)).toEqual({ kind: 'plan', planDir: `${ROOT}/d`, step: 'run W0' })
    expect((parseMarker('/abs\nplan 1\n', ROOT) as any)?.planDir).toBe('/abs')
    expect(parseMarker('d\nwalk W0\n', ROOT)).toBe(null)
    expect(parseMarker('d\nplan\n', ROOT)).toBe(null)
    expect(parseMarker('d\nplanning 2\n', ROOT)).toBe(null)
    expect(parseMarker('', ROOT)).toBe(null)
  })

  test('parseMarker: exactly two lines, trailing slashes dropped', async () => {
    expect(parseMarker('d\nrun W0\nextra\n', ROOT)).toBe(null)
    expect((parseMarker('d/\nrun W1\n\n', ROOT) as any)?.planDir).toBe(`${ROOT}/d`)
  })

  test('clean and redSet', async () => {
    expect(clean('a\u001b[0m\tb\nc')).toBe('a [0m b c')
    expect(clean('a\nb', true)).toBe('a\nb')
    expect(redSet('## 4. Tests\n\nPredicted red set: x\n## 5. Gate\n')).toBe('Predicted red set: x')
    expect(redSet('## 4. Tests\n\nnone\n')).toBe(null)
  })

  test('parseDecisions counts dated rows only', async () => {
    expect(parseDecisions([
      '# BIO-1 decisions', '', '`<date> | <label> | <decision> | <why>`',
      '2026-10-21 | Q1 RULING | a | b', '2026-10-21 | D1–D8 DEFAULT | c | d', '2026-10-21 | R1 (Q1, bound) | e | f',
      '| date | label | decision | why |', '| ---- | ----- | -------- | --- |', '| 2026-10-24 | D1 DEFAULT | g | h |',
      '  wrapped text of the row above', 'x | RULING | a | b', 'On 2026-10-21 the owner ruled', '2026-10-21 no pipe',
    ].join('\n'))).toEqual({ decisions: 4 })
  })

  test('clockTime adds the day only when it is not today', async () => {
    const at = new Date(2026, 9, 16, 14, 2).getTime()
    expect(clockTime(at, at + 60_000)).toBe('14:02')
    expect(clockTime(at, at + 86_400_000)).toBe('10-16 14:02')
  })

  test('rowText cuts the title first, never past columns', async () => {
    const row = { title: 'a long ticket title', step: 'run W3', since: 0, isEarlier: false,
      decisions: 0 }
    for (const columns of [0, 1, 10, 30, 40, 200]) {
      expect(rowText(row, columns).length <= Math.max(columns, 0)).toBe(true)
    }
    expect(rowText(row, 200).startsWith('a long ticket title · run W3')).toBe(true)
  })
})

describe('review round 1', () => {
  const TREE = `${ROOT}/.worktrees/w`
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read|list) /.test(line))
  const pane = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    return ui
  }

  // W3-R1: the check also stats plan.md and decisions.md.
  test('decisions.md written while idle: the count follows within 15 s', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    const clock = world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    files.set(`${DIR}/decisions.md`, { ...decisions[1], mtimeMs: STARTED + 200_000 })
    await clock.advance(15_000)
    expect(await bandText($)).toMatch(/ · 2 decisions$/)
  })

  test('plan.md retitled while idle: the title follows within 15 s', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    const clock = world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    files.set(`${DIR}/plan.md`, { text: '# skills-x — renamed\n', mtimeMs: STARTED + 200_000 })
    await clock.advance(15_000)
    expect(await bandText($)).toMatch(/^skills-x — renamed · run W1/)
  })

  // Q3 then Q6 (was W3-R2, 10 a call): at most W + 3M fs calls per tool call, inside the Q6 bound W + 4M.
  test('a Bash call with two markers: at most W + 3M fs calls, inside the Q6 bound W + 4M (Q6)', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan, [MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/plan.md`, plan[1]],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/decisions.md`, decisions[1]]]), ROOT, log)
    await write($, `${TREE}/.shawarma/active-other`, MARKER_TEXT('run W0'))
    const n0 = log.length
    await bash($, 'true')
    expect(fsCalls(log, n0).length <= 2 + 3 * 2).toBe(true)
  })

  test('a marker Write, one marker: at most W + 3M fs calls, inside the Q6 bound W + 4M (Q6)', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan, decisions]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const n0 = log.length
    await write($, MARKER, MARKER_TEXT('run W2'))
    expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)
  })

  // W3-R3: CR and CRLF line ends.
  test('parseDecisions splits on \\r\\n, \\r and \\n', async () => {
    const rows = ['2026-10-21 | Q1 RULING | a | b', '2026-10-21 | D1 DEFAULT | c | d', '| 2026-10-21 | D2 DEFAULT | e | f |']
    expect(parseDecisions(rows.join('\r'))).toEqual({ decisions: 3 })
    expect(parseDecisions(rows.join('\r\n'))).toEqual({ decisions: 3 })
  })

  // W3-D1: a failed Edit records no own write.
  test('a failed Edit of another session\'s worktree marker: its text, no label', { options: ON }, async ($, on) => {
    world(on, new Map([[`${TREE}/.shawarma/active-${TICKET}`, { text: MARKER_TEXT('run OTHER'), mtimeMs: STARTED + 5 }],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/plan.md`, plan[1]]]))
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active-${TICKET}`, old_string: 'run W9', new_string: 'run W10' } as any)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER/)
  })

  // W3-D2: C1 controls.
  test('clean blanks C1 controls', async () => {
    expect(clean('a\u0085b\u009bc\u0080d')).toBe('a b c d')
    expect(clean('a\u009f\nb', true)).toBe('a \nb')
  })

  test('a C1 control in the title: the row is still drawn', { options: ON }, async ($, on) => {
    world(on, new Map([[`${DIR}/plan.md`, { text: '# skills-x \u009b31mred\n', mtimeMs: 0 }]]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/run W1/)
  })

  test('a C1 control in decisions.md: the pane is still drawn', { options: ON }, async ($, on) => {
    world(on, new Map([plan, [`${DIR}/decisions.md`, { text: '2026-10-16 | Q1 RULING | a\u009b | b\n', mtimeMs: 0 }]]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect((await (await pane($)).find({ type: 'Markdown' }))?.props.text).toMatch(/### Decisions/)
  })

  // W3-D3: every hook catches its own errors.
  test('pane: a read that fails draws a short line, not an error', { options: ON }, async ($, on) => {
    const fail = new Set<string>()
    world(on, new Map([plan, decisions]), ROOT, [], fail)
    await write($, MARKER, MARKER_TEXT('run W1'))
    fail.add(`read ${DIR}/decisions.md`)
    const ui = await pane($).catch((err: unknown) => String(err))
    expect(typeof ui).not.toBe('string')
    expect((await (ui as any).find({ type: 'Text' }))?.text).toMatch(/could not be read/)
  })

  test('row: a failing usage call with context on draws nothing, not an error', { options: { ...ON, context: true } }, async ($, on) => {
    const fail = new Set<string>()
    world(on, new Map([plan]), ROOT, [], fail)
    await write($, MARKER, MARKER_TEXT('run W1'))
    fail.add('usage')
    expect(await bandText($).catch((err: unknown) => `threw ${String(err)}`)).toBe(undefined)
  })

  test('command: the pane failing to open is said, not thrown', { options: ON }, async ($, on) => {
    world(on, new Map([plan]), ROOT, [], new Set(['open']))
    const out = await $.command.run({ command: 'shawarma-companion', args: '' } as any).catch((err: unknown) => ({ text: `threw ${String(err)}` }))
    expect(out.text).toMatch(/^Shawarma pane could not open: /)
  })

  test('session start: a failed command registration still draws the row', { options: ON }, async ($, on) => {
    world(on, new Map([[MARKER, { text: MARKER_TEXT('plan 2'), mtimeMs: STARTED - 1 }], plan]), ROOT, [], new Set(['register']))
    await $.session.start({ source: 'startup', cwd: ROOT } as any).catch(() => undefined)
    expect(await bandText($)).toMatch(/^earlier session: .* plan 2/)
  })

  test('tool call: the cwd failing after the call still returns the result', { options: ON }, async ($, on) => {
    world(on, new Map([plan]), ROOT, [], new Set(['cwd after call']))
    const out: any = await $.tool.call({ tool: 'Write', file_path: 'notes.txt', content: 'x' } as any).catch((err: unknown) => ({ threw: String(err) }))
    expect(out?.result?.text).toBe('ok')
  })

  // W3-D4: the check timer.
  test('the check stops when the row goes', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    await bash($, `rm ${MARKER}`)
    const n0 = log.length
    await clock.advance(60_000)
    expect(log.slice(n0).filter(line => line === `list ${ROOT}/.shawarma`)).toEqual([])
  })

  test('row, gone, row again: one check, not two', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    await bash($, `rm ${MARKER}`)
    await write($, MARKER, MARKER_TEXT('run W2'))
    const n0 = log.length
    await clock.advance(60_000)
    expect(log.slice(n0).filter(line => line === `list ${ROOT}/.shawarma`).length).toBe(4)
  })

  test('reload with a row kept in state: the first drawing restarts the check', { options: ON }, async ($, on) => {
    const files = new Map([plan, [MARKER, { text: MARKER_TEXT('run W1'), mtimeMs: STARTED + 61_000 }]])
    const clock = world(on, files)
    const kept = { ticket: TICKET, marker: MARKER, tree: ROOT, title: 'skills-x — the thing', step: 'run W1', since: STARTED + 61_000,
      isEarlier: false, decisions: 0, planDir: DIR, planAt: 0, decisionsAt: null }
    on('state.get', { plugin: 'shawarma-companion' } as any, async (_$, e: any, next: any) => {
      const r = await next(e)
      return e.key === 'rows' && r.value.version === 0 ? { value: { value: [kept], version: 0 } } : r
    })
    expect(await bandText($)).toMatch(/run W1/)
    files.set(MARKER, { text: MARKER_TEXT('run W2'), mtimeMs: STARTED + 130_000 })
    await clock.advance(15_000)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)
  })
})

describe('review round 3 (W3-R4)', () => {
  const TREE = `${ROOT}/.worktrees/w`
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read|list) /.test(line))
  const paneText = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    return (await ui.find({ type: 'Markdown' }))?.props.text ?? (await ui.find({ type: 'Text' }))?.text
  }

  test('F2 a worktree marker and the cwd marker: both rows, the own tree first (Q4)', { options: ON }, async ($, on) => {
    world(on, new Map([plan,
      [`${TREE}/.shawarma/active-${TICKET}`, { text: MARKER_TEXT('run OLD'), mtimeMs: STARTED + 5 }],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/plan.md`, { text: '# tree plan\n', mtimeMs: 0 }],
      [MARKER, { text: MARKER_TEXT('run CWD'), mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${TREE}/.shawarma/active-${TICKET}`]))
    await write($, `${TREE}/.shawarma/active-${TICKET}`, MARKER_TEXT('run W1'))
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND } as any)
    const texts = (await ui.findAll({ type: 'Text' })).map((one: any) => one.text)
    expect(texts.length).toBe(2)
    expect(texts[0]).toMatch(/^skills-x — the thing · run CWD · /)
    expect(texts[1]).toMatch(/^skills-x · tree plan · run W1 · /)
  })

  test('F2 an Edit whose before-call stat fails: drawn, no label', { options: ON }, async ($, on) => {
    world(on, new Map([plan, [MARKER, { text: MARKER_TEXT('run W1'), mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${MARKER}`]))
    await $.tool.call({ tool: 'Edit', file_path: MARKER, old_string: 'run W1', new_string: 'run W2' } as any)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W2/)
  })

  test('F4 a CR-only plan.md: title, recap and decision lines', { options: ON }, async ($, on) => {
    world(on, new Map([[`${DIR}/plan.md`, { text: '# skills-x — the thing\r\r## 1. What\r\rwhy\r', mtimeMs: 0 }],
      [`${DIR}/decisions.md`, { text: '2026-10-16 | Q1 RULING | a | b\r2026-10-16 | D1 DEFAULT | c | d\r', mtimeMs: 0 }]]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect(await bandText($)).toBe(`skills-x — the thing · run W1 · ${SINCE(1)} · 2 decisions`)
    const text = await paneText($)
    expect(text).toMatch(/### Recap\n\nwhy/)
    expect(text).toMatch(/- 2026-10-16 \| Q1 RULING \| a \| b\n- 2026-10-16 \| D1 DEFAULT \| c \| d/)
  })

  test('F5 a malformed marker: the pane says so and reads no plan file', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([['/plan.md', { text: '# root plan\n\n## 1. What\n\nROOT FILE\n', mtimeMs: 0 }]]), ROOT, log)
    await write($, MARKER, 'bad\n')
    const n0 = log.length
    const text = await paneText($)
    expect(text).toBe(`shawarma: ${TICKET}: malformed marker (${MARKER})`)
    expect(fsCalls(log, n0)).toEqual([])
  })

  test('F6 plan dir created while idle: the problem line goes within 15 s', { options: ON }, async ($, on) => {
    const files = new Map<string, File>()
    const clock = world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/plan dir not found/)
    files.set(`${DIR}/notes.txt`, { text: '', mtimeMs: 0 })
    await clock.advance(15_000)
    expect(await bandText($)).toBe(`skills-x · 2026-10-16-skills-x-thing · run W1 · ${SINCE(1)} · 0 decisions`)
  })

  test('F1 a failed Edit of a missing marker, cwd marker, plan dir missing: at most W + 3M fs calls, inside the Q6 bound W + 4M', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }]]), ROOT, log)
    const n0 = log.length
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active-other`, old_string: 'run W0', new_string: 'run W1' } as any)
    expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)
  })

  test('F1 a failed Write of a new marker, cwd marker, plan dir missing: at most W + 3M fs calls, inside the Q6 bound W + 4M', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }]]), ROOT, log)
    const n0 = log.length
    await write($, `${TREE}/.shawarma/active-other`, `${MARKER_TEXT('run W0')}#fail`)
    expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)
  })

  test('F3 a press on the row when the pane cannot open: nothing escapes', { options: ON }, async ($, on) => {
    const fail = new Set<string>()
    const log: string[] = []
    world(on, new Map([plan]), ROOT, log, fail)
    await write($, MARKER, MARKER_TEXT('run W1'))
    await bandText($)
    fail.add('open')
    const n0 = log.length
    expect(await $.ui.press({ plugin: 'shawarma-companion', key: `row:${TICKET}` }).then(() => 'resolved', () => 'rejected')).toBe('resolved')
    expect(log.slice(n0).filter(line => line.startsWith('open '))).toEqual(['open shawarma-companion'])
    expect(await bandText($)).toMatch(/run W1/)
  })

  test('D9 each check period: at most W + 2M fs calls, plan dir missing', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map(), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    for (let period = 0; period < 3; period += 1) {
      const n0 = log.length
      await clock.advance(15_000)
      expect(fsCalls(log, n0).length <= 2 + 2 * 1).toBe(true)
    }
  })
})

describe('review round 4 (W3-R5)', () => {
  const TREE = `${ROOT}/.worktrees/w`
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read|list) /.test(line))

  test('N1 a failed Edit of a missing marker, no brief yet: at most W + 3M fs calls, inside the Q6 bound W + 4M', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }], decisions]), ROOT, log)
    const n0 = log.length
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active-other`, old_string: 'run W0', new_string: 'run W1' } as any)
    expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)
  })

  test('N1 a failed Write of a missing marker, no brief yet: at most W + 3M fs calls, inside the Q6 bound W + 4M', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }], decisions]), ROOT, log)
    const n0 = log.length
    await write($, `${TREE}/.shawarma/active-other`, `${MARKER_TEXT('run W0')}#fail`)
    expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)
  })

  test('N1 a failed Edit of a missing marker, plan dir with neither file: at most W + 3M fs calls, inside the Q6 bound W + 4M', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }],
      [`${DIR}/notes.txt`, { text: '', mtimeMs: 0 }]]), ROOT, log)
    const n0 = log.length
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active-other`, old_string: 'run W0', new_string: 'run W1' } as any)
    expect(fsCalls(log, n0).length <= 2 + 3 * 1).toBe(true)
  })

  test('N2 an Edit of a missing marker that another writer creates inside the call: drawn, no label', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await $.tool.call({ tool: 'Edit', file_path: MARKER, old_string: '#appear', new_string: 'x' } as any)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run OTHER/)
  })

  test('N3 a failed Write, the file already holding its text: drawn, no label', { options: ON }, async ($, on) => {
    const text = MARKER_TEXT('run W1 #fail')
    world(on, new Map([plan, [MARKER, { text, mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${MARKER}`]))
    await write($, MARKER, text)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W1 #fail · /)
  })

  test('a successful Write whose before-call stat fails: drawn, no label', { options: ON }, async ($, on) => {
    world(on, new Map([plan, [MARKER, { text: MARKER_TEXT('run OLD'), mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${MARKER}`]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W1 · /)
  })
})

describe('v2tm per-ticket markers', () => {
  const SIB = '/elsewhere/repo-t5b2'
  const A = `${ROOT}/.worktrees/a`
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read|list) /.test(line))
  const mountBand = ($: any, props: any = BAND) =>
    $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props } as any)
  const texts = async ($: any): Promise<string[]> => (await (await mountBand($)).findAll({ type: 'Text' })).map((one: any) => one.text as string)
  const paneMd = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    return (await ui.find({ type: 'Markdown' }))?.props.text ?? (await ui.findAll({ type: 'Text' })).map((one: any) => one.text).join('\n')
  }
  const planIn = (tree: string, slug: string, title: string, rows = 0): [string, File][] => [
    [`${tree}/docs/plans/${slug}/plan.md`, { text: `# ${title}\n\n## 1. What\n\nrecap of ${title}\n`, mtimeMs: 0 }],
    [`${tree}/docs/plans/${slug}/decisions.md`, { text: '2026-10-16 | Q1 RULING | a | b\n'.repeat(rows), mtimeMs: 0 }],
  ]
  const markerAt = (tree: string, ticket: string, body: string, at: number): [string, File] =>
    [`${tree}/.shawarma/active-${ticket}`, { text: body, mtimeMs: at }]

  test('the marker is .shawarma/active-<ticket>, the ticket from its name', { options: ON }, async ($, on) => {
    world(on, new Map([plan, decisions, markerAt(ROOT, 'skills-x', MARKER_TEXT('run W3'), STARTED + 5)]))
    await bash($, 'true')
    expect(await bandText($)).toBe(`skills-x — the thing · run W3 · since 14:00 · 2 decisions`)
  })

  test('D4 the old .shawarma/active is not read', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan, [`${ROOT}/.shawarma/active`, { text: MARKER_TEXT('run W3'), mtimeMs: STARTED + 5 }]]), ROOT, log)
    await bash($, 'true')
    expect(await bandText($)).toBe(undefined)
    expect(log.filter(line => line === `read ${ROOT}/.shawarma/active`)).toEqual([])
  })

  test('a name that is not active-<ticket> is no marker', { options: ON }, async ($, on) => {
    world(on, new Map([plan, markerAt(ROOT, '', MARKER_TEXT('run W3'), STARTED + 5),
      [`${ROOT}/.shawarma/.gitignore`, { text: '*\n', mtimeMs: STARTED + 5 }],
      [`${ROOT}/.shawarma/active-dir/x`, { text: '', mtimeMs: STARTED + 5 }]]))
    await bash($, 'true')
    expect(await bandText($)).toBe(undefined)
  })

  test('D1 a trivial marker: <ticket> · trivial · since HH:MM, no plan file read', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([markerAt(ROOT, 'skills-t', 'skills-t\ntrivial\n', STARTED + 60_000)]), ROOT, log)
    await bash($, 'true')
    expect(await bandText($)).toBe('skills-t · trivial · since 14:01')
    expect(log.filter(line => /^(list|read|stat|exists) .*docs/.test(line))).toEqual([])
  })

  test('D1 a trivial marker: the pane reads "Trivial run: no brief" with the ticket', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'skills-t', 'skills-t\ntrivial\n', STARTED + 60_000)]))
    await bash($, 'true')
    const text = await paneMd($)
    expect(text).toMatch(/\*\*skills-t\*\* · trivial/)
    expect(text).toMatch(/Trivial run: no brief/)
  })

  test('Q4 many markers: the own tree first, then newest first, one Text each', { options: ON }, async ($, on) => {
    world(on, new Map([
      ...planIn(ROOT, 'p-own', 'own-1 — mine'), ...planIn(A, 'p-a', 'a-1 — in a'), ...planIn(SIB, 'p-s', 's-1 — sibling'),
      markerAt(ROOT, 'own-1', 'docs/plans/p-own\nplan 2\n', STARTED + 10),
      markerAt(A, 'a-1', 'docs/plans/p-a\nrun W1\n', STARTED + 30),
      markerAt(SIB, 's-1', 'docs/plans/p-s\nrun W2\n', STARTED + 20)]), ROOT, [], new Set(), { trees: [ROOT, A, SIB] })
    await bash($, 'true')
    const all = await texts($)
    expect(all.map(line => line.split(' — ')[0])).toEqual(['own-1', 'a-1', 's-1'])
  })

  test('Q4 a cwd inside a linked worktree: that tree is own', { options: ON }, async ($, on) => {
    world(on, new Map([
      ...planIn(ROOT, 'p-own', 'own-1 — main'), ...planIn(A, 'p-a', 'a-1 — in a'),
      markerAt(ROOT, 'own-1', 'docs/plans/p-own\nplan 2\n', STARTED + 30),
      markerAt(A, 'a-1', 'docs/plans/p-a\nrun W1\n', STARTED + 10)]), `${A}/sub`, [], new Set(), { trees: [ROOT, A] })
    await bash($, 'true')
    expect((await texts($)).map(line => line.split(' — ')[0])).toEqual(['a-1', 'own-1'])
  })

  test('Q4 two markers with the same mtime: ticket order', { options: ON }, async ($, on) => {
    world(on, new Map([
      markerAt(WT, 'zz', 'zz\ntrivial\n', STARTED + 10), markerAt(WT, 'aa', 'aa\ntrivial\n', STARTED + 10)]))
    await bash($, 'true')
    expect(await texts($)).toEqual(['aa · trivial · since 14:00', 'zz · trivial · since 14:00'])
  })

  test('Q4 one Button per row, keyed per ticket; a press opens the pane on that ticket, the header lists the others', { options: ON }, async ($, on) => {
    world(on, new Map([
      ...planIn(ROOT, 'p-own', 'own-1 — mine'), ...planIn(SIB, 'p-s', 's-1 — sibling', 3),
      markerAt(ROOT, 'own-1', 'docs/plans/p-own\nplan 2\n', STARTED + 10),
      markerAt(SIB, 's-1', 'docs/plans/p-s\nrun W2\n', STARTED + 20)]), ROOT, [], new Set(), { trees: [ROOT, SIB] })
    await bash($, 'true')
    const ui = await mountBand($)
    expect((await ui.findAll({ type: 'Button' })).map((one: any) => one.key)).toEqual(['row:own-1', 'row:s-1'])
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:s-1' })
    const text = await paneMd($)
    expect(text).toMatch(/^\*\*s-1 — sibling\*\* · run W2\n\nOther tickets: own-1\n\n### Recap\n\nrecap of s-1 — sibling/)
  })

  test('Q4 /shawarma-companion opens the pane on the first row', { options: ON }, async ($, on) => {
    world(on, new Map([
      ...planIn(ROOT, 'p-own', 'own-1 — mine'), ...planIn(SIB, 'p-s', 's-1 — sibling'),
      markerAt(ROOT, 'own-1', 'docs/plans/p-own\nplan 2\n', STARTED + 10),
      markerAt(SIB, 's-1', 'docs/plans/p-s\nrun W2\n', STARTED + 20)]), ROOT, [], new Set(), { trees: [ROOT, SIB] })
    await bash($, 'true')
    await mountBand($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:s-1' })
    const pane = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    expect((await pane.find({ type: 'Markdown' }))?.props.text).toMatch(/^\*\*s-1 — sibling\*\*/)
    await $.command.run({ command: 'shawarma-companion', args: '' } as any)
    expect((await pane.find({ type: 'Markdown' }))?.props.text).toMatch(/^\*\*own-1 — mine\*\* · plan 2\n\nOther tickets: s-1/)
  })

  test('Q2 a sibling-folder worktree is found by git worktree list', { options: ON }, async ($, on) => {
    world(on, new Map([...planIn(SIB, 'p-s', 's-1 — sibling'), markerAt(SIB, 's-1', 'docs/plans/p-s\nrun W2\n', STARTED + 20)]),
      ROOT, [], new Set(), { trees: [ROOT, SIB] })
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^s-1 — sibling · run W2/)
  })

  test('D3 prunable and bare records skipped; locked and detached read', { options: ON }, async ($, on) => {
    const P = '/x/prunable', L = '/x/locked', T = '/x/detached'
    world(on, new Map([markerAt(P, 'p', 'p\ntrivial\n', STARTED + 4), markerAt(L, 'l', 'l\ntrivial\n', STARTED + 3),
      markerAt(T, 't', 't\ntrivial\n', STARTED + 2), markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 1)]), ROOT, [], new Set(), {
      records: [[`worktree ${ROOT}`, 'bare'], [`worktree ${P}`, 'HEAD 1', 'branch refs/heads/p', 'prunable gitdir file points to non-existent location'],
        [`worktree ${L}`, 'HEAD 2', 'branch refs/heads/l', 'locked on a USB stick'], [`worktree ${T}`, 'HEAD 3', 'detached']],
    })
    await bash($, 'true')
    expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['l', 't'])
  })

  test('Q2 git worktree list exits non-zero: the file-API fallback, main plus <main>/.worktrees/*, a sibling missed', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 3), markerAt(A, 'a', 'a\ntrivial\n', STARTED + 2),
      markerAt(SIB, 's', 's\ntrivial\n', STARTED + 1)]), ROOT, [], new Set(), { trees: [ROOT, A, SIB], worktree: { exitCode: 129, stdout: '' } })
    await bash($, 'true')
    expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['m', 'a'])
  })

  test('Q2 git worktree list prints garbage: the fallback', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(A, 'a', 'a\ntrivial\n', STARTED + 2)]), ROOT, [], new Set(),
      { worktree: { exitCode: 0, stdout: 'warning: something\nnot a record\n' } })
    await bash($, 'true')
    expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['a'])
  })

  // Q2 fallback by the file API: no process at all.
  const NOPROC: Git = { worktree: 'reject', revparse: 'reject' }
  const linkedGit = (tree: string, name: string, commondir = true): [string, File][] => [
    [`${tree}/.git`, { text: `gitdir: ${ROOT}/.git/worktrees/${name}\n`, mtimeMs: 1 }],
    ...(commondir ? [[`${ROOT}/.git/worktrees/${name}/commondir`, { text: '../..\n', mtimeMs: 1 }] as [string, File]] : []),
  ]
  const three = (): Files => new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 3), markerAt(A, 'a', 'a\ntrivial\n', STARTED + 2),
    markerAt(SIB, 's', 's\ntrivial\n', STARTED + 2), ...linkedGit(A, 'a'), ...linkedGit(SIB, 's')])

  test('Q2 process.run rejects for every command, cwd in main: main and .worktrees/* drawn, the sibling not (known limit)', { options: ON }, async ($, on) => {
    world(on, three(), ROOT, [], new Set(), NOPROC)
    const out: any = await bash($, 'true')
    expect(out?.result?.text).toBe('ok')
    expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['m', 'a'])
  })

  test('Q2 process.run rejects, cwd deep in a linked worktree under .worktrees: that tree first, then main', { options: ON }, async ($, on) => {
    world(on, three(), `${A}/x/y`, [], new Set(), NOPROC)
    await bash($, 'true')
    expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['a', 'm'])
  })

  test('Q2 process.run rejects, a linked worktree with no commondir file: gitdir/../.. is the common dir', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 3), markerAt(A, 'a', 'a\ntrivial\n', STARTED + 2),
      ...linkedGit(A, 'a', false)]), A, [], new Set(), NOPROC)
    await bash($, 'true')
    expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['a', 'm'])
  })

  test('Q2 process.run rejects, cwd in a sibling worktree: its own tree, main and .worktrees/*, not other siblings', { options: ON }, async ($, on) => {
    const OTHER = '/elsewhere/repo-wb64'
    world(on, new Map([...three(), markerAt(OTHER, 'o', 'o\ntrivial\n', STARTED + 9), ...linkedGit(OTHER, 'o')]), SIB, [], new Set(), NOPROC)
    await bash($, 'true')
    expect((await texts($)).map(line => line.split(' ')[0])).toEqual(['s', 'm', 'a'])
  })

  test('Q2 process.run rejects, no .git up to /: nothing drawn', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt('/x', 'm', 'm\ntrivial\n', STARTED + 3)]), '/x/y', [], new Set(), { ...NOPROC, noRepo: true })
    await bash($, 'true')
    expect(await bandText($)).toBe(undefined)
  })

  test('Q2 the walk: one stat per level, kept per cwd across calls and turns', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, three(), `${ROOT}/a/b/c/d`, log, new Set(), NOPROC)
    const walkCalls = (from: number) => log.slice(from).filter(line => /^(stat|read) .*(\.git|commondir)/.test(line))
    await bash($, 'true')
    expect(walkCalls(0)).toEqual(['/repo/a/b/c/d', '/repo/a/b/c', '/repo/a/b', '/repo/a', '/repo'].map(d => `stat ${d}/.git`))
    const n0 = log.length
    await bash($, 'true')
    await $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)
    await bash($, 'true')
    expect(walkCalls(n0)).toEqual([])
  })

  test('parseGitdir, resolvePath, parentOf', async () => {
    expect(parseGitdir('gitdir: /repo/.git/worktrees/a\n', '/repo/.worktrees/a')).toBe('/repo/.git/worktrees/a')
    expect(parseGitdir('gitdir: ../../.git/worktrees/a\n', '/repo/.worktrees/a')).toBe('/repo/.git/worktrees/a')
    expect(parseGitdir('nonsense\n', '/r')).toBe(null)
    expect(resolvePath('/repo/.git/worktrees/a', '../..')).toBe('/repo/.git')
    expect(resolvePath('/x', '/abs/./y/')).toBe('/abs/y')
    expect([parentOf('/a/b'), parentOf('/a'), parentOf('/')]).toEqual(['/a', '/', '/'])
  })

  test('D6 .shawarma missing, a file, or unreadable in one tree: the others still draw', { options: ON }, async ($, on) => {
    const F = '/x/file', U = '/x/unreadable', N = '/x/none'
    world(on, new Map([[`${F}/.shawarma`, { text: 'x', mtimeMs: 1 }], markerAt(U, 'u', 'u\ntrivial\n', STARTED + 9),
      markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 2)]), ROOT, [], new Set([`list ${U}/.shawarma`]), { trees: [ROOT, F, U, N] })
    await bash($, 'true')
    expect(await texts($)).toEqual(['m · trivial · since 14:00'])
  })

  test('malformed markers: 1 line, 3 lines, empty, bad step, each its own row', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'one', 'd\n', STARTED + 4), markerAt(ROOT, 'three', 'd\nrun W1\nx\n', STARTED + 3),
      markerAt(ROOT, 'empty', '', STARTED + 2), markerAt(ROOT, 'bad', 'd\nwalk W1\n', STARTED + 1)]))
    await bash($, 'true')
    expect(await texts($)).toEqual(['one', 'three', 'empty', 'bad'].map(t => `${t === 'bad' ? 'earlier session: ' : ''}shawarma: ${t}: malformed marker`))
  })

  test('parseMarker: trivial, and a plan dir that says trivial is not', async () => {
    expect(parseMarker('skills-t\ntrivial\n', ROOT)).toEqual({ kind: 'trivial', step: 'trivial' })
    expect(parseMarker('\ntrivial\n', ROOT)).toBe(null)
    expect(parseMarker('skills-t\ntrivial extra\n', ROOT)).toBe(null)
    expect(parseMarker('skills-t\nTRIVIAL\n', ROOT)).toBe(null)
  })

  test('parseWorktrees: records, flags, garbage', async () => {
    expect(parseWorktrees(`worktree /a\0HEAD 1\0branch b\0\0worktree /b\0detached\0locked\0\0worktree /c\0prunable x\0\0`)).toEqual([
      { path: '/a', isBare: false, isPrunable: false, isLocked: false, isDetached: false },
      { path: '/b', isBare: false, isPrunable: false, isLocked: true, isDetached: true },
      { path: '/c', isBare: false, isPrunable: true, isLocked: false, isDetached: false }])
    expect(parseWorktrees('')).toBe(null)
    expect(parseWorktrees('fatal: not a git repository\n')).toBe(null)
  })

  test('order: own first, newest first, ticket on a tie', async () => {
    const r = (ticket: string, tree: string, since: number) => ({ ticket, tree, since })
    expect(order([r('b', '/s', 5), r('a', '/s', 5), r('o', '/own', 1), r('c', '/s', 9)], '/own').map(x => x.ticket))
      .toEqual(['o', 'c', 'a', 'b'])
  })

  test('D5 a marker as old as the session start reads earlier session; one newer than start + 1 ms reads current (F3)', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'eq', 'eq\ntrivial\n', STARTED), markerAt(ROOT, 'new', 'new\ntrivial\n', STARTED + 2)]))
    await bash($, 'true')
    const ui = await mountBand($)
    const found = await ui.findAll({ type: 'Text' })
    expect(found.map((one: any) => [one.text, one.props.dimColor])).toEqual([
      ['new · trivial · since 14:00', false], ['earlier session: eq · trivial · since 14:00', true]])
  })

  test('D2 a leftover marker stays, dimmed (a day old: stale, Q5), beside a live one', { options: ON }, async ($, on) => {
    world(on, new Map([...planIn(ROOT, 'p-old', 'old-1 — crashed'), ...planIn(ROOT, 'p-new', 'new-1 — live'),
      markerAt(ROOT, 'old-1', 'docs/plans/p-old\nrun W2\n', STARTED - 86_400_000),
      markerAt(ROOT, 'new-1', 'docs/plans/p-new\nplan 1\n', STARTED + 5)]))
    await bash($, 'true')
    expect(await texts($)).toEqual(['new-1 — live · plan 1 · since 14:00 · 0 decisions',
      'stale: old-1 — crashed · run W2 · since 10-15 14:00 · 0 decisions'])
  })

  test('a title not naming its ticket gets the ticket in front (Q1)', { options: ON }, async ($, on) => {
    world(on, new Map([...planIn(ROOT, 'p', 'Untitled thing'), markerAt(ROOT, 'skills-q', 'docs/plans/p\nplan 1\n', STARTED + 5)]))
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^skills-q · Untitled thing · plan 1/)
  })

  test('plan dir missing in one row only', { options: ON }, async ($, on) => {
    world(on, new Map([...planIn(ROOT, 'p', 'ok-1 — here'), markerAt(ROOT, 'ok-1', 'docs/plans/p\nplan 1\n', STARTED + 5),
      markerAt(ROOT, 'gone-1', 'docs/plans/gone\nplan 1\n', STARTED + 4)]))
    await bash($, 'true')
    expect(await texts($)).toEqual(['ok-1 — here · plan 1 · since 14:00 · 0 decisions',
      `gone-1 · gone · plan 1 · since 14:00 · 0 decisions · plan dir not found: ${ROOT}/docs/plans/gone`])
  })

  // Q3 at W=3 worktrees, M=2 markers.
  const W3M2 = (): Files => new Map([
    ...planIn(ROOT, '2026-10-16-skills-x-thing', 'own-1 — mine', 2), ...planIn(SIB, 'p-s', 's-1 — sibling', 1),
    markerAt(ROOT, 'own-1', MARKER_TEXT('plan 2'), STARTED + 10),
    markerAt(SIB, 's-1', 'docs/plans/p-s\nrun W2\n', STARTED + 20)])

  test('Q3 W=3, M=2: per tool call at most W + 3M fs calls, inside the Q6 bound W + 4M and one git worktree list per turn', { options: ON }, async ($, on) => {
    const log: string[] = []
    const files = W3M2()
    world(on, files, ROOT, log, new Set(), { trees: [ROOT, A, SIB] })
    await $.session.start({ source: 'startup', cwd: ROOT } as any)
    const runs = () => log.filter(line => line.startsWith('run git worktree list --porcelain')).length
    expect(runs()).toBe(1)
    for (const command of ['true', 'echo plan 3 > .shawarma/active-own-1', 'echo run W3 > .shawarma/active-own-1', 'true']) {
      const n0 = log.length
      await bash($, command)
      expect(fsCalls(log, n0).length <= 3 + 3 * 2).toBe(true)
    }
    expect(runs()).toBe(1)
    await $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)
    expect(runs()).toBe(2)
    await bash($, 'true')
    expect(runs()).toBe(2)
  })

  test('Q3 W=3, M=2: per check at most W + 2M fs calls, no read, no process', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, W3M2(), ROOT, log, new Set(), { trees: [ROOT, A, SIB] })
    await bash($, 'true')
    expect((await texts($)).length).toBe(2)
    for (let period = 0; period < 4; period += 1) {
      const n0 = log.length
      await clock.advance(15_000)
      const calls = log.slice(n0)
      expect(fsCalls(log, n0).length <= 3 + 2 * 2).toBe(true)
      expect(calls.filter(line => /^(read|run) /.test(line))).toEqual([])
    }
  })

  test('Q3 a sibling marker rewritten while idle: the row follows within 15 s, one marker read', { options: ON }, async ($, on) => {
    const log: string[] = []
    const files = W3M2()
    const clock = world(on, files, ROOT, log, new Set(), { trees: [ROOT, A, SIB] })
    await bash($, 'true')
    files.set(`${SIB}/.shawarma/active-s-1`, { text: 'docs/plans/p-s\nrun W9\n', mtimeMs: STARTED + 130_000 })
    const n0 = log.length
    await clock.advance(15_000)
    expect((await texts($))[1]).toMatch(/^s-1 — sibling · run W9/)
    expect(log.slice(n0).filter(line => line.startsWith('read '))).toEqual([`read ${ROOT}/.shawarma/active-own-1`, `read ${SIB}/.shawarma/active-s-1`])
  })
})

describe('lane 3a fixes', () => {
  const SIB = '/elsewhere/repo-t5b2'
  const NOPROC: Git = { worktree: 'reject', revparse: 'reject' }
  const markerAt = (tree: string, ticket: string, body: string, at: number): [string, File] =>
    [`${tree}/.shawarma/active-${ticket}`, { text: body, mtimeMs: at }]
  const mountBand = ($: any, props: any = BAND) =>
    $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props } as any)
  const found = async ($: any, props: any = BAND): Promise<{ text: string; dim: boolean }[]> => (await (await mountBand($, props)).findAll({ type: 'Text' }))
    .map((one: any) => ({ text: one.text as string, dim: one.props.dimColor as boolean }))
  const names = async ($: any) => (await found($)).map(one => one.text.replace(/^earlier session: /, '').split(' ')[0])

  test('F1 a worktree path holding "\\n\\nworktree /X" injects no tree (-z)', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 9), markerAt('/X', 'x', 'x\ntrivial\n', STARTED + 9)]), ROOT, log, new Set(), {
      records: [[`worktree ${ROOT}`, 'HEAD 1', 'branch refs/heads/main'], [`worktree ${ROOT}/a\n\nworktree /X`, 'HEAD 2', 'detached']] })
    await bash($, 'true')
    expect(await names($)).toEqual(['m'])
    expect(log.filter(line => line === 'list /X/.shawarma')).toEqual([])
  })

  test('F1 a truncated worktree list is a failed list: the fallback', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 9), markerAt(SIB, 's', 's\ntrivial\n', STARTED + 8)]), ROOT, [], new Set(), {
      worktree: { exitCode: 0, stdout: z => render(recordsOf([ROOT, SIB]), z), truncated: true } })
    await bash($, 'true')
    expect(await names($)).toEqual(['m'])
  })

  test('F1 parseWorktrees reads NUL-framed records, a "/" root kept as "/"', async () => {
    expect(parseWorktrees('worktree /a\nb\0HEAD 1\0locked held\nprunable\0\0worktree /\0HEAD 2\0detached\0\0')).toEqual([
      { path: '/a\nb', isBare: false, isPrunable: false, isLocked: true, isDetached: false },
      { path: '/', isBare: false, isPrunable: false, isLocked: false, isDetached: true }])
    expect(parseWorktrees('worktree /a\nHEAD 1\n\nworktree /b\nHEAD 2\n')).toBe(null)
  })

  test('F1 a worktree at "/": its .shawarma is /.shawarma', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([markerAt('', 'r', 'r\ntrivial\n', STARTED + 9)]), '/', log, new Set(), { records: [['worktree /', 'HEAD 1', 'detached']] })
    await bash($, 'true')
    expect(await names($)).toEqual(['r'])
    expect(log.filter(line => line.startsWith('list ') && line.includes('.shawarma'))).toEqual(['list /.shawarma'])
  })

  test('F3 fractional mtimes against a whole-ms start: current only past start + 1 ms', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'a', 'a\ntrivial\n', STARTED + 0.5), markerAt(ROOT, 'b', 'b\ntrivial\n', STARTED + 1),
      markerAt(ROOT, 'c', 'c\ntrivial\n', STARTED + 1.25), markerAt(ROOT, 'd', 'd\ntrivial\n', STARTED - 0.5)]))
    await bash($, 'true')
    expect((await found($)).map(one => [one.text.replace(/ · since.*/, ''), one.dim])).toEqual([
      ['c · trivial', false], ['earlier session: b · trivial', true], ['earlier session: a · trivial', true],
      ['earlier session: d · trivial', true]])
  })

  test('F5 clean blanks bidi controls', async () => {
    expect(clean('a\u061Cb\u200Ec\u200Fd\u202Ae\u202Bf\u202Cg\u202Dh\u202Ei\u2066j\u2067k\u2068l\u2069m'))
      .toBe('a b c d e f g h i j k l m')
    expect(clean('a\u202Eb\nc', true)).toBe('a b\nc')
  })

  test('F5 a ticket holding U+202E draws no bidi control', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'ev\u202Eil', 'x\ntrivial\n', STARTED + 9)]))
    await bash($, 'true')
    const [row] = await found($)
    expect(row?.text).toBe('ev il · trivial · since 14:00')
  })

  test('F8 a walk that failed once is tried again at the turn end', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 9)]), ROOT, [], new Set([`stat once ${ROOT}/.git`]), NOPROC)
    await bash($, 'true')
    expect(await bandText($)).toBe(undefined)
    await $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)
    expect(await names($)).toEqual(['m'])
  })

  test('F8 a walk that failed once is tried again at session start', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 9)]), ROOT, [], new Set([`stat once ${ROOT}/.git`]), NOPROC)
    await bash($, 'true')
    await $.session.start({ source: 'startup', cwd: ROOT } as any)
    expect(await names($)).toEqual(['m'])
  })

  test('F9 every process.run carries timeoutMs 2000', { options: ON }, async ($, on) => {
    const inits: unknown[] = []
    world(on, new Map(), ROOT, [], new Set(), { worktree: 'reject', inits })
    await bash($, 'true')
    expect(inits.length > 0).toBe(true)
    expect(inits.every((init: any) => init?.timeoutMs === 2000)).toBe(true)
  })

  test('F9 git never answers: the tool call answers by 2 s on the clock, from the fallback', { options: ON }, async ($, on) => {
    const clock = world(on, new Map([markerAt(ROOT, 'm', 'm\ntrivial\n', STARTED + 9)]), ROOT, [], new Set(), { worktree: 'hang' })
    let out: any = 'pending'
    void bash($, 'true').then((r: unknown) => { out = r })
    await clock.advance(1_999)
    expect(out).toBe('pending')
    await clock.advance(1)
    expect(out?.result?.text).toBe('ok')
    expect(await names($)).toEqual(['m'])
  })

  const LONG = `docs/plans/${'x'.repeat(150)}`
  for (const columns of [120, 40]) {
    test(`F10 plan dir missing, long path, ${columns} columns: the row keeps its ticket`, { options: ON }, async ($, on) => {
      world(on, new Map([markerAt(ROOT, 'skills-long', `${LONG}\nplan 1\n`, STARTED + 9)]))
      await bash($, 'true')
      const [row] = await found($, { ...BAND, bodyColumns: columns })
      expect(row!.text.startsWith('skills-long')).toBe(true)
      expect(row!.text.length <= columns).toBe(true)
    })

    test(`F10 malformed marker, ${columns} columns: shawarma: <ticket>: malformed marker`, { options: ON }, async ($, on) => {
      world(on, new Map([markerAt(ROOT, 'skills-mal', 'one line only\n', STARTED + 9)]))
      await bash($, 'true')
      const [row] = await found($, { ...BAND, bodyColumns: columns })
      expect(row!.text).toBe('shawarma: skills-mal: malformed marker')
    })
  }

  test('F10 rowText: the title and problem are cut before the ticket', async () => {
    const row = { ticket: 'skills-x', title: `skills-x — ${'long '.repeat(30)}`, step: 'run W1', since: 0, isEarlier: true,
      decisions: 3, problem: `plan dir not found: /${'p'.repeat(200)}` }
    for (const columns of [120, 60, 40, 30]) {
      const text = rowText(row, columns)
      expect(text.length <= columns).toBe(true)
      expect(text.startsWith('earlier session: skills-x')).toBe(true)
    }
  })

  test('the ticket prefix needs the exact ticket at the title start', { options: ON }, async ($, on) => {
    world(on, new Map([[`${ROOT}/docs/plans/p/plan.md`, { text: '# skills-x2 — other\n', mtimeMs: 0 }],
      markerAt(ROOT, 'skills-x', 'docs/plans/p\nplan 1\n', STARTED + 9)]))
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^skills-x · skills-x2 — other · plan 1/)
  })

  test('a pane whose chosen ticket is gone says so, not another row', { options: ON }, async ($, on) => {
    const files = new Map([markerAt(ROOT, 'own-1', 'own-1\ntrivial\n', STARTED + 9), markerAt(WT, 's-1', 's-1\ntrivial\n', STARTED + 8),
      [`${WT}/.shawarma/.gitignore`, { text: '*\n', mtimeMs: 1 }] as [string, File]])
    world(on, files)
    await bash($, 'true')
    await mountBand($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:s-1' })
    files.delete(`${WT}/.shawarma/active-s-1`)
    await bash($, 'true')
    const pane = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    const text = (await pane.find({ type: 'Markdown' }))?.props.text ?? (await pane.findAll({ type: 'Text' })).map((one: any) => one.text).join('\n')
    expect(text).toMatch(/^s-1: no longer active/)
  })
})

describe('Q5 liveness (stale)', () => {
  const H12 = 12 * 3600 * 1000
  const markerAt = (tree: string, ticket: string, body: string, at: number): [string, File] =>
    [`${tree}/.shawarma/active-${ticket}`, { text: body, mtimeMs: at }]
  const found = async ($: any): Promise<{ text: string; dim: boolean }[]> =>
    (await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND } as any))
      .findAll({ type: 'Text' })).map((one: any) => ({ text: one.text as string, dim: one.props.dimColor as boolean }))

  test('Q5 a run that crashed after the start reads current until 12 h, then stale on the check, no file change', { options: ON }, async ($, on) => {
    const log: string[] = []
    const at = STARTED + 60_000
    const clock = world(on, new Map([markerAt(WT, 'dead', 'dead\ntrivial\n', at)]), ROOT, log, new Set(), { now: at + H12 - 20_000 })
    await bash($, 'true')
    expect(await found($)).toEqual([{ text: 'dead · trivial · since 10-16 14:01', dim: false }])
    await clock.advance(15_000)
    expect((await found($))[0]?.dim).toBe(false)
    const n0 = log.length
    await clock.advance(15_000)
    expect(await found($)).toEqual([{ text: 'stale: dead · trivial · since 10-16 14:01', dim: true }])
    expect(log.slice(n0).filter(line => line.startsWith('read '))).toEqual([])
  })

  test('Q5 dated 2 min in the future: stale; 30 s in the future: current', { options: ON }, async ($, on) => {
    const now = STARTED + 120_000
    world(on, new Map([markerAt(ROOT, 'fut', 'fut\ntrivial\n', now + 120_000), markerAt(ROOT, 'near', 'near\ntrivial\n', now + 30_000)]))
    await bash($, 'true')
    expect((await found($)).map(one => [one.text.replace(/ · since.*/, ''), one.dim])).toEqual([
      ['stale: fut · trivial', true], ['near · trivial', false]])
  })

  test('Q5 both earlier and stale: stale wins', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'old', 'old\ntrivial\n', STARTED - 13 * 3600 * 1000), markerAt(ROOT, 'prev', 'prev\ntrivial\n', STARTED - 60_000)]))
    await bash($, 'true')
    expect((await found($)).map(one => [one.text.replace(/ · since.*/, ''), one.dim])).toEqual([
      ['earlier session: prev · trivial', true], ['stale: old · trivial', true]])
  })
})

describe('Q6 cost bounds and caps', () => {
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read|list) /.test(line))
  const setup = (W: number, Mk: number) => {
    const trees = Array.from({ length: W }, (_, i) => (i === 0 ? ROOT : `/wt/t${i}`))
    const files: Files = new Map()
    const markers: string[] = []
    for (let m = 0; m < Mk; m += 1) {
      const tree = trees[m % W]!
      files.set(`${tree}/docs/plans/p${m}/plan.md`, { text: `# k${m} — t\n`, mtimeMs: 1 })
      files.set(`${tree}/docs/plans/p${m}/decisions.md`, { text: '2026-10-16 | Q1 | a | b\n', mtimeMs: 1 })
      files.set(`${tree}/.shawarma/active-k${m}`, { text: `docs/plans/p${m}\nrun W1\n`, mtimeMs: STARTED + 100 + m })
      markers.push(`${tree}/.shawarma/active-k${m}`)
    }
    return { trees, files, markers }
  }
  const texts = async ($: any): Promise<{ text: string; dim: boolean }[]> =>
    (await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt',
      props: { ...BAND, maxRows: 40, scroll: { offset: 0, bodyRows: 40 } } } as any))
      .findAll({ type: 'Text' })).map((one: any) => ({ text: one.text as string, dim: one.props.dimColor as boolean }))

  for (const [W, Mk] of [[3, 2], [6, 4]] as const) {
    test(`Q6 W=${W}, M=${Mk}: cold (session start; every plan file changed) <= W + 4M, steady <= W + 2M, check <= W + M`, { options: ON }, async ($, on) => {
      const log: string[] = []
      const { trees, files } = setup(W, Mk)
      const clock = world(on, files, ROOT, log, new Set(), { trees })
      let n0 = log.length
      await $.session.start({ source: 'startup', cwd: ROOT } as any)
      expect(fsCalls(log, n0).length <= W + 4 * Mk).toBe(true)
      expect((await texts($)).length).toBe(Mk)
      for (const [path, file] of [...files]) if (/(plan|decisions)\.md$/.test(path)) files.set(path, { ...file, mtimeMs: STARTED + 5_000 })
      n0 = log.length
      await bash($, 'true')
      expect(fsCalls(log, n0).length <= W + 4 * Mk).toBe(true)
      expect(fsCalls(log, n0).filter(line => line.startsWith('read ')).length).toBe(3 * Mk)
      n0 = log.length
      await bash($, 'true')
      expect(fsCalls(log, n0).length <= W + 2 * Mk).toBe(true)
      for (let period = 0; period < 3; period += 1) {
        n0 = log.length
        await clock.advance(15_000)
        expect(fsCalls(log, n0).length <= W + Mk).toBe(true)
      }
    })
  }

  test('Q6 50 worktrees: all scanned, no more-row', { options: ON }, async ($, on) => {
    const log: string[] = []
    const { trees, files } = setup(50, 1)
    world(on, files, ROOT, log, new Set(), { trees })
    await bash($, 'true')
    expect(log.filter(line => /^list .*\.shawarma$/.test(line)).length).toBe(50)
    expect((await texts($)).map(one => one.text).filter(text => text.includes('more not shown'))).toEqual([])
  })

  test('Q6 51 worktrees (FAIL size): 50 scanned, the own tree among them, one dimmed "1 worktree not scanned" (N3)', { options: ON }, async ($, on) => {
    const log: string[] = []
    const { trees, files } = setup(51, 1)
    files.set(`${trees[50]}/.shawarma/active-last`, { text: 'last\ntrivial\n', mtimeMs: STARTED + 900 })
    world(on, files, trees[50]!, log, new Set(), { trees })
    await bash($, 'true')
    expect(log.filter(line => /^list .*\.shawarma$/.test(line)).length).toBe(50)
    const rows = await texts($)
    expect(rows[0]?.text).toMatch(/^last · trivial/)
    expect(rows.at(-1)).toEqual({ text: '1 worktree not scanned', dim: true })
  })

  test('Q6 20 markers: 20 rows, no more-row', { options: ON }, async ($, on) => {
    const { trees, files } = setup(2, 20)
    world(on, files, ROOT, [], new Set(), { trees })
    await bash($, 'true')
    const rows = await texts($)
    expect(rows.length).toBe(20)
    expect(rows.filter(one => one.text.includes('more not shown'))).toEqual([])
  })

  test('Q6 21 markers (FAIL size): 20 read and drawn, the oldest own-tree marker kept, "+1 more not shown", no read for the 21st', { options: ON }, async ($, on) => {
    const log: string[] = []
    const SIB = '/wt/t1'
    const files: Files = new Map([[`${ROOT}/.shawarma/active-k0`, { text: 'k0\ntrivial\n', mtimeMs: STARTED + 2 }]])
    for (let m = 1; m <= 20; m += 1) files.set(`${SIB}/.shawarma/active-k${m}`, { text: `k${m}\ntrivial\n`, mtimeMs: STARTED + 100 + m })
    world(on, files, ROOT, log, new Set(), { trees: [ROOT, SIB] })
    await bash($, 'true')
    const rows = await texts($)
    expect(rows.length).toBe(21)
    expect(rows[0]?.text).toMatch(/^k0 · trivial/)
    expect(rows.slice(1, 20).every(one => !one.text.startsWith('k1 '))).toBe(true)
    expect(rows[20]).toEqual({ text: '+1 more not shown', dim: true })
    expect(log.filter(line => /^read .*\.shawarma\/active-/.test(line)).length).toBe(20)
    expect(fsCalls(log, 0).length <= 2 + 4 * 20).toBe(true)
  })
})

describe('lane 3a round 2 fixes', () => {
  const markerAt = (tree: string, ticket: string, body: string, at: number): [string, File] =>
    [`${tree}/.shawarma/active-${ticket}`, { text: body, mtimeMs: at }]
  const BIG = { ...BAND, maxRows: 40, scroll: { offset: 0, bodyRows: 40 } }
  const band = async ($: any): Promise<string[]> =>
    (await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BIG } as any))
      .findAll({ type: 'Text' })).map((one: any) => one.text as string)
  const mountPane = ($: any) => $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
    requestId: 'shawarma-companion', props: {} } as any)
  const paneOf = async (pane: any): Promise<string> =>
    (await pane.find({ type: 'Markdown' }))?.props.text ?? (await pane.findAll({ type: 'Text' })).map((one: any) => one.text).join('\n')
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read|list) /.test(line))

  test('N1 a chosen ticket pushed past the 20-row limit: "not shown", not "no longer active"', { options: ON }, async ($, on) => {
    const files: Files = new Map()
    for (let m = 0; m < 25; m += 1) files.set(`${ROOT}/.shawarma/active-k${m}`, { text: 'x\ntrivial\n', mtimeMs: STARTED + 100 + m })
    world(on, files, ROOT, [], new Set(), { trees: [ROOT] })
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:k5' })
    for (let m = 25; m < 30; m += 1) files.set(`${ROOT}/.shawarma/active-k${m}`, { text: 'x\ntrivial\n', mtimeMs: STARTED + 100 + m })
    await bash($, 'true')
    const pane = await mountPane($)
    expect(await paneOf(pane)).toBe('k5: not shown (past the 20-row limit)')
    files.delete(`${ROOT}/.shawarma/active-k5`)
    await bash($, 'true')
    expect(await paneOf(pane)).toBe('k5: no longer active')
  })

  test('N2 a stale chosen row: the pane title carries "stale: ", the header labels the others', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(WT, 'dead', 'docs/p\nrun W2\n', STARTED + 60_000), markerAt(ROOT, 'old', 'old\ntrivial\n', STARTED - 5),
      [`${WT}/docs/p/plan.md`, { text: '# dead — x\n\n## 1. What\n\nr\n', mtimeMs: 1 }]]), ROOT, [], new Set(), { now: STARTED + 13 * 3600 * 1000 })
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:dead' })
    expect(await paneOf(await mountPane($))).toMatch(/^stale: \*\*dead — x\*\* · run W2\n\nOther tickets: old \(stale\)\n\n### Recap/)
  })

  test('N2 an earlier-session chosen row: labelled in the pane; a current other listed bare', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'old', 'old\ntrivial\n', STARTED - 5), markerAt(WT, 'live', 'live\ntrivial\n', STARTED + 100)]))
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:old' })
    expect(await paneOf(await mountPane($))).toMatch(/^earlier session: \*\*old\*\* · trivial\n\nOther tickets: live\n\nTrivial run: no brief/)
  })

  const treesN = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? ROOT : `/t/w${String(i).padStart(3, '0')}`))

  test('N3 the only marker in an unscanned 51st tree: one dimmed "1 worktree not scanned" row', { options: ON }, async ($, on) => {
    const trees = treesN(51)
    world(on, new Map([markerAt(trees[50]!, 'lost', 'x\ntrivial\n', STARTED + 5)]), ROOT, [], new Set(), { trees })
    await bash($, 'true')
    expect(await band($)).toEqual(['1 worktree not scanned'])
  })

  test('N3 markers in tree 1 and 51: the row counts no unlisted marker', { options: ON }, async ($, on) => {
    const trees = treesN(51)
    world(on, new Map([markerAt(ROOT, 'one', 'x\ntrivial\n', STARTED + 5), markerAt(trees[50]!, 'a', 'x\ntrivial\n', STARTED + 6),
      markerAt(trees[50]!, 'b', 'x\ntrivial\n', STARTED + 7)]), ROOT, [], new Set(), { trees })
    await bash($, 'true')
    expect(await band($)).toEqual(['one · trivial · since 14:00', '1 worktree not scanned'])
  })

  test('N3 52 trees, none past 50 holding markers: "2 worktrees not scanned", no "+n"', { options: ON }, async ($, on) => {
    const trees = treesN(52)
    world(on, new Map([markerAt(ROOT, 'one', 'x\ntrivial\n', STARTED + 5)]), ROOT, [], new Set(), { trees })
    await bash($, 'true')
    expect(await band($)).toEqual(['one · trivial · since 14:00', '2 worktrees not scanned'])
  })

  test('N3 both caps: "+1 more not shown · 1 worktree not scanned"', { options: ON }, async ($, on) => {
    const trees = treesN(51)
    const files: Files = new Map()
    for (let m = 0; m < 21; m += 1) files.set(`${ROOT}/.shawarma/active-k${m}`, { text: 'x\ntrivial\n', mtimeMs: STARTED + 100 + m })
    world(on, files, ROOT, [], new Set(), { trees })
    await bash($, 'true')
    const rows = await band($)
    expect(rows.length).toBe(21)
    expect(rows[20]).toBe('+1 more not shown · 1 worktree not scanned')
  })

  test('N4 a hidden marker touched each period: no refresh, each check <= W + M', { options: ON }, async ($, on) => {
    const log: string[] = []
    const files: Files = new Map()
    for (let m = 0; m < 25; m += 1) {
      files.set(`${ROOT}/.shawarma/active-k${m}`, { text: `docs/p${m}\nrun W1\n`, mtimeMs: STARTED + 100 + m })
      files.set(`${ROOT}/docs/p${m}/plan.md`, { text: `# k${m} — t\n`, mtimeMs: 1 })
      files.set(`${ROOT}/docs/p${m}/decisions.md`, { text: '2026-11-02 | Q | a | b\n', mtimeMs: 1 })
    }
    const clock = world(on, files, ROOT, log, new Set(), { trees: [ROOT] })
    await bash($, 'true')
    const ops: number[] = []
    for (let p = 0; p < 4; p += 1) {
      files.set(`${ROOT}/.shawarma/active-k0`, { ...files.get(`${ROOT}/.shawarma/active-k0`)!, mtimeMs: STARTED + 50 - p })
      const n0 = log.length
      await clock.advance(15_000)
      ops.push(fsCalls(log, n0).length)
    }
    expect(ops).toEqual([21, 21, 21, 21])
  })

  test('N4 a hidden marker rewritten to the newest: drawn within 15 s', { options: ON }, async ($, on) => {
    const files: Files = new Map()
    for (let m = 0; m < 25; m += 1) files.set(`${ROOT}/.shawarma/active-k${m}`, { text: 'x\ntrivial\n', mtimeMs: STARTED + 100 + m })
    const clock = world(on, files, ROOT, [], new Set(), { trees: [ROOT] })
    await bash($, 'true')
    files.set(`${ROOT}/.shawarma/active-k0`, { text: 'x\ntrivial\n', mtimeMs: STARTED + 125_000 })
    await clock.advance(15_000)
    expect((await band($))[0]).toMatch(/^k0 · trivial/)
  })

  test('N6 clean blanks U+2028 and U+2029', async () => {
    expect(clean('a\u2028b\u2029c')).toBe('a b c')
    expect(clean('a\u2028b\nc', true)).toBe('a b\nc')
  })
})

describe('lane 3a round 3 fixes', () => {
  const markerAt = (tree: string, ticket: string, body: string, at: number): [string, File] =>
    [`${tree}/.shawarma/active-${ticket}`, { text: body, mtimeMs: at }]
  const BIG = { ...BAND, maxRows: 40, scroll: { offset: 0, bodyRows: 40 } }
  const band = async ($: any): Promise<string[]> =>
    (await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BIG } as any))
      .findAll({ type: 'Text' })).map((one: any) => one.text as string)
  const paneText = async ($: any): Promise<string> => {
    const pane = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    return (await pane.find({ type: 'Markdown' }))?.props.text ?? (await pane.findAll({ type: 'Text' })).map((one: any) => one.text).join('\n')
  }
  const turnEnd = ($: any) => $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)

  test('R3-1 the chosen marker\'s tree moved past 50 worktrees: "not shown (not in the last scan)"', { options: ON }, async ($, on) => {
    const many = Array.from({ length: 60 }, (_, i) => `/t/w${String(i).padStart(3, '0')}`)
    const X = many[5]!
    const trees = [ROOT, ...many]
    world(on, new Map([markerAt(X, 'x', 'x\ntrivial\n', STARTED + 5), markerAt(ROOT, 'own', 'own\ntrivial\n', STARTED + 6)]), ROOT, [], new Set(), { trees })
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:x' })
    trees.splice(trees.indexOf(X), 1)
    trees.push(X)
    await turnEnd($)
    expect(await paneText($)).toBe('x: not shown (not in the last scan)')
  })

  test('R3-2 the chosen marker cannot be read: "could not be read"', { options: ON }, async ($, on) => {
    const fail = new Set<string>()
    world(on, new Map([markerAt(ROOT, 'a', 'a\ntrivial\n', STARTED + 5), markerAt(ROOT, 'b', 'b\ntrivial\n', STARTED + 6)]), ROOT, [], fail, { trees: [ROOT] })
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:a' })
    fail.add(`read ${ROOT}/.shawarma/active-a`)
    await bash($, 'true')
    expect(await paneText($)).toBe('a: could not be read')
  })

  test('R3-1 the chosen marker deleted, every tree scanned: "no longer active"', { options: ON }, async ($, on) => {
    const files = new Map([markerAt(ROOT, 'a', 'a\ntrivial\n', STARTED + 5), markerAt(ROOT, 'b', 'b\ntrivial\n', STARTED + 6)])
    world(on, files, ROOT, [], new Set(), { trees: [ROOT] })
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:a' })
    files.delete(`${ROOT}/.shawarma/active-a`)
    await bash($, 'true')
    expect(await paneText($)).toBe('a: no longer active')
  })

  test('R3 reload window: rows and chosen kept in state, no listing since load: "not in the last scan"', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'a', 'a\ntrivial\n', STARTED + 5)]), ROOT, [], new Set(), { trees: [ROOT] })
    const kept = { ticket: 'a', marker: `${ROOT}/.shawarma/active-a`, tree: ROOT, title: 'a', step: 'trivial', since: STARTED + 5,
      isEarlier: false, isStale: false, decisions: 0, planDir: '', planAt: null, decisionsAt: null }
    on('state.get', { plugin: 'shawarma-companion' } as any, async (_$, e: any, next: any) => {
      const r = await next(e)
      if (r.value.version !== 0) return r
      if (e.key === 'rows') return { value: { value: [kept], version: 0 } }
      if (e.key === 'chosen') return { value: { value: `${ROOT}/.shawarma/active-b`, version: 0 } }
      return r
    })
    expect(await paneText($)).toBe('b: not shown (not in the last scan)')
  })

  test('R3-3 a failed refresh: "Shawarma state could not be read."', { options: ON }, async ($, on) => {
    const fail = new Set<string>()
    world(on, new Map([markerAt(ROOT, 'a', 'a\ntrivial\n', STARTED + 5)]), ROOT, [], fail, { trees: [ROOT] })
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:a' })
    fail.add('usage')
    await bash($, 'true')
    expect(await paneText($)).toBe('Shawarma state could not be read.')
  })

  test('R3-3 no marker anywhere: "No shawarma marker in the last scan."', { options: ON }, async ($, on) => {
    world(on, new Map(), ROOT, [], new Set(), { trees: [ROOT] })
    await bash($, 'true')
    expect(await paneText($)).toBe('No shawarma marker in the last scan.')
  })

  test('R3-3 only the more-row: the pane names it, and the 15 s check still runs', { options: ON }, async ($, on) => {
    const many = Array.from({ length: 51 }, (_, i) => (i === 0 ? ROOT : `/t/w${String(i).padStart(3, '0')}`))
    const files = new Map([markerAt(many[50]!, 'lost', 'x\ntrivial\n', STARTED + 5)])
    const clock = world(on, files, ROOT, [], new Set(), { trees: many })
    await bash($, 'true')
    expect(await band($)).toEqual(['1 worktree not scanned'])
    expect(await paneText($)).toBe('No row drawn: 1 worktree not scanned')
    files.set(`${many[1]}/.shawarma/active-later`, { text: 'later\ntrivial\n', mtimeMs: STARTED + 125_000 })
    await clock.advance(15_000)
    expect(await band($)).toEqual(['later · trivial · since 14:02', '1 worktree not scanned'])
  })

  test('R3-3 only the more-row drawn: the 15 s check still runs', { options: ON }, async ($, on) => {
    const many = Array.from({ length: 51 }, (_, i) => (i === 0 ? ROOT : `/t/w${String(i).padStart(3, '0')}`))
    const files = new Map([markerAt(many[50]!, 'lost', 'x\ntrivial\n', STARTED + 5)])
    const clock = world(on, files, ROOT, [], new Set(), { trees: many })
    await bash($, 'true')
    await band($)
    files.set(`${many[1]}/.shawarma/active-later`, { text: 'later\ntrivial\n', mtimeMs: STARTED + 125_000 })
    await clock.advance(15_000)
    expect(await band($)).toEqual(['later · trivial · since 14:02', '1 worktree not scanned'])
  })

  test('R3-4 a stale malformed marker: the band row carries "stale: " as the pane does', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'bad', 'one line\n', STARTED - 13 * 3600 * 1000)]))
    await bash($, 'true')
    expect(await band($)).toEqual(['stale: shawarma: bad: malformed marker'])
  })
})

describe('Q5 boundaries (lane 3a R-A6)', () => {
  test('isStaleAt: age exactly 12 h current, 12 h + 1 ms stale; +60000 ms ahead current, +60001 stale', async () => {
    const now = STARTED + 13 * 3600 * 1000
    const H12 = 12 * 3600 * 1000
    expect([isStaleAt(now - H12, now), isStaleAt(now - H12 - 1, now), isStaleAt(now - H12 + 1, now),
      isStaleAt(now + 60_000, now), isStaleAt(now + 60_001, now)]).toEqual([false, true, false, false, true])
  })
})

describe('v2tm amendments (D11, D12)', () => {
  const markerAt = (tree: string, ticket: string, body: string, at: number): [string, File] =>
    [`${tree}/.shawarma/active-${ticket}`, { text: body, mtimeMs: at }]
  const BIG = { ...BAND, maxRows: 40, scroll: { offset: 0, bodyRows: 40 } }
  const band = async ($: any): Promise<string[]> =>
    (await (await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BIG } as any))
      .findAll({ type: 'Text' })).map((one: any) => one.text as string)
  const paneText = async ($: any): Promise<string> => {
    const pane = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    return (await pane.find({ type: 'Markdown' }))?.props.text ?? (await pane.findAll({ type: 'Text' })).map((one: any) => one.text).join('\n')
  }
  const outside = (log: string[], prefix: string) =>
    log.filter(line => /^(exists|stat|read|list) /.test(line) && line.slice(line.indexOf(' ') + 1).startsWith(prefix))
  const EVIL: [string, File][] = [['/etc/p/plan.md', { text: '# o-1 — forged\n\n## 1. What\n\nsecret\n', mtimeMs: 1 }],
    ['/etc/p/decisions.md', { text: '2026-10-16 | Q1 RULING | a | b\n', mtimeMs: 1 }]]

  test('D11 an absolute plan dir outside the tree: a problem row, no file call there', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([markerAt(ROOT, 'o-1', '/etc/p\nrun W1\n', STARTED + 5), ...EVIL]), ROOT, log)
    await bash($, 'true')
    expect(await band($)).toEqual(['shawarma: o-1: plan dir outside its tree'])
    expect(outside(log, '/etc')).toEqual([])
  })

  test('D11 a relative plan dir climbing out of the tree: a problem row, no file call there', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([markerAt(ROOT, 'o-2', '../outside/p\nplan 2\n', STARTED + 5),
      ['/outside/p/plan.md', { text: '# o-2 — forged\n', mtimeMs: 1 }]]), ROOT, log)
    await bash($, 'true')
    expect(await band($)).toEqual(['shawarma: o-2: plan dir outside its tree'])
    expect(log.filter(line => /^(exists|stat|read|list) .*outside/.test(line))).toEqual([])
  })

  test('D11 a plan dir whose name shares the tree\'s prefix (/repo-evil): outside', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([markerAt(ROOT, 'o-3', '/repo-evil/p\nrun W1\n', STARTED + 5),
      ['/repo-evil/p/plan.md', { text: '# o-3 — forged\n', mtimeMs: 1 }]]), ROOT, log)
    await bash($, 'true')
    expect(await band($)).toEqual(['shawarma: o-3: plan dir outside its tree'])
    expect(outside(log, '/repo-evil')).toEqual([])
  })

  test('D11 a sibling worktree\'s marker naming the main checkout\'s plan dir: outside its own tree', { options: ON }, async ($, on) => {
    const SIB = '/sib'
    const log: string[] = []
    world(on, new Map([markerAt(SIB, 's-1', `${DIR}\nrun W1\n`, STARTED + 5), plan, decisions]), ROOT, log, new Set(), { trees: [ROOT, SIB] })
    await bash($, 'true')
    expect(await band($)).toEqual(['shawarma: s-1: plan dir outside its tree'])
    expect(outside(log, DIR)).toEqual([])
  })

  test('D11 a plan dir with .. that stays inside: drawn, read at the folded path', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'i-1', 'docs/../docs/plans/p/./\nplan 1\n', STARTED + 5),
      [`${ROOT}/docs/plans/p/plan.md`, { text: '# i-1 — inside\n', mtimeMs: 1 }]]))
    await bash($, 'true')
    expect(await band($)).toEqual(['i-1 — inside · plan 1 · since 14:00 · 0 decisions'])
  })

  test('D11 the plan dir equal to the tree root: inside', { options: ON }, async ($, on) => {
    world(on, new Map([markerAt(ROOT, 'r-1', `${ROOT}\nplan 1\n`, STARTED + 5),
      [`${ROOT}/plan.md`, { text: '# r-1 — at the root\n', mtimeMs: 1 }]]))
    await bash($, 'true')
    expect(await band($)).toEqual(['r-1 — at the root · plan 1 · since 14:00 · 0 decisions'])
  })

  test('D11 the pane of an outside row says so and reads no file there', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([markerAt(ROOT, 'o-1', '/etc/p\nrun W1\n', STARTED + 5), ...EVIL]), ROOT, log)
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row:o-1' })
    expect(await paneText($)).toBe(`shawarma: o-1: plan dir outside its tree (${ROOT}/.shawarma/active-o-1)`)
    expect(outside(log, '/etc')).toEqual([])
  })

  test('D11 the 15 s check of an outside row lists nothing there', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([markerAt(ROOT, 'o-1', '/etc/p\nrun W1\n', STARTED + 5), ...EVIL]), ROOT, log)
    await bash($, 'true')
    await band($)
    await clock.advance(15_000)
    await clock.advance(15_000)
    expect(await band($)).toEqual(['shawarma: o-1: plan dir outside its tree'])
    expect(outside(log, '/etc')).toEqual([])
  })

  test('D12 the pane does not read a plan.md that is a link: no brief yet', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run W1'), mtimeMs: STARTED + 5 }],
      [`${DIR}/plan.md`, { text: '# skills-x — linked\n\n## 1. What\n\nfrom elsewhere\n', mtimeMs: 1, isLink: true }], decisions]), ROOT, log)
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: `row:${TICKET}` })
    expect(await paneText($)).toMatch(/_No brief yet: the plan is in progress._\n\n### Decisions\n\n- 2026-10-16 \| Q1 RULING/)
    expect(log.filter(line => line === `read ${DIR}/plan.md`)).toEqual([])
  })

  test('D12 the pane does not read a decisions.md that is a link: none recorded', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run W1'), mtimeMs: STARTED + 5 }], plan,
      [`${DIR}/decisions.md`, { text: '2026-10-16 | Q9 RULING | linked | x\n', mtimeMs: 1, isLink: true }]]), ROOT, log)
    await bash($, 'true')
    await band($)
    await $.ui.press({ plugin: 'shawarma-companion', key: `row:${TICKET}` })
    expect(await paneText($)).toMatch(/### Decisions\n\n_None recorded._/)
    expect(log.filter(line => line === `read ${DIR}/decisions.md`)).toEqual([])
  })

  test('D12 the band does not read a plan.md that is a link: the folder name as title', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run W1'), mtimeMs: STARTED + 5 }],
      [`${DIR}/plan.md`, { text: '# skills-x — linked\n', mtimeMs: 1, isLink: true }]]), ROOT, log)
    await bash($, 'true')
    expect(await band($)).toEqual(['skills-x · 2026-10-16-skills-x-thing · run W1 · since 14:00 · 0 decisions'])
    expect(log.filter(line => line === `read ${DIR}/plan.md`)).toEqual([])
  })
})
