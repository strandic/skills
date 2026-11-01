import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { clean, clockTime, parseDecisions, parseMarker, redSet, rowText } from '../hooks/model'

const ROOT = '/repo'
const MARKER = `${ROOT}/.shawarma/active`
const DIR = `${ROOT}/docs/plans/2026-10-16-skills-x-thing`
// 2026-10-16 14:00 local: written times read as literal `14:01` (an oracle apart from clockTime).
const STARTED = new Date(2026, 9, 16, 14, 0).getTime()
const BAND = {
  hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 4 }, view: {},
} as const

type File = { text: string; mtimeMs: number }
type Files = Map<string, File>

const MARKER_TEXT = (step: string) => `docs/plans/2026-10-16-skills-x-thing\n${step}\n`

/**
 * A fake tree beneath the plugin: fs, git, cwd and usage answer from it. Its
 * tools act on it: Write sets a file (mtime from a counter; content holding
 * `#race` is then replaced inside the same call by another writer), Edit
 * replaces `old_string` with `new_string` (not found: an error, nothing
 * changed, as the real Edit), Bash `rm <path>`
 * deletes one, Bash `echo <step> > .shawarma/active` or `sh mark.sh <step>`
 * writes the cwd's marker, any other Bash changes nothing. `fs.stat` rejects
 * `ENOENT` on a missing path, as the real one. Each name in `fail` makes that
 * call throw: `cwd`, `usage`, `open`, `register`, or `read <path>`; `cwd after
 * call` makes `cwd` throw once a tool call has run; `stat once <path>` makes
 * the next stat of that path fail with EACCES. A Write whose content holds
 * `#fail` errors and changes nothing; an Edit whose `old_string` is
 * `#appear` errors while another writer creates the file. Errors take core's
 * shape: `{ isError: true, result, text }`.
 */
function world(on: On, files: Files, cwd = ROOT, log: string[] = [], fail: Set<string> = new Set()) {
  let tick = STARTED + 60_000
  const clock = mock.clock(on, { now: STARTED + 120_000 })
  const failing = (name: string) => { if (fail.has(name)) throw new Error(`${name} failed`) }
  on('fs.exists', (_$, e) => (log.push(`exists ${e.path}`), { value: files.has(e.path) || [...files.keys()].some(k => k.startsWith(`${e.path}/`)) }))
  on('fs.read', (_$, e) => (log.push(`read ${e.path}`), failing(`read ${e.path}`), { value: files.get(e.path)?.text ?? '' }))
  on('fs.stat', (_$, e) => {
    log.push(`stat ${e.path}`)
    if (fail.delete(`stat once ${e.path}`)) throw new Error(`EACCES: permission denied, stat '${e.path}'`)
    const file = files.get(e.path)
    if (file === undefined) throw new Error(`ENOENT: no such file, stat '${e.path}'`)
    return { value: { kind: 'file', size: 1, mtimeMs: file.mtimeMs, isLink: false } }
  })
  on('session.cwd', () => (failing('cwd'), { value: cwd }))
  on('process.run', (_$, e) => ({
    value: { exitCode: 0, stdout: `${e.init?.cwd ?? cwd}\n`, stderr: '',
      isStdoutTruncated: false, isStderrTruncated: false },
  }))
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
    const step = /^(?:echo (.*) > \.shawarma\/active|sh mark\.sh (.*))$/.exec(e.command ?? '')
    if (e.tool === 'Bash' && step !== null) {
      files.set(`${cwd}/.shawarma/active`, { text: MARKER_TEXT(step[1] ?? step[2] ?? ''), mtimeMs: tick })
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

  test('marker written through Bash, even naming the path: unconfirmed label', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await bash($, 'echo plan 2 spike > .shawarma/active')
    expect(await bandText($)).toBe(`unconfirmed: skills-x — the thing · plan 2 spike · ${SINCE(1)} · 0 decisions`)
  })

  test('marker changed by a call that did not name it: unconfirmed label', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await bash($, 'sh mark.sh plan 2 spike')
    expect(await bandText($)).toMatch(/^unconfirmed: skills-x — the thing · plan 2 spike/)
  })

  test('marker older than the session: earlier-session label', { options: ON }, async ($, on) => {
    world(on, new Map([[MARKER, { text: MARKER_TEXT('plan 2 spike'), mtimeMs: STARTED - 1 }], plan]))
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^earlier session: skills-x — the thing · plan 2 spike/)
  })

  test('marker another session wrote after this one started: unconfirmed label', { options: ON }, async ($, on) => {
    world(on, new Map([[MARKER, { text: MARKER_TEXT('plan 3'), mtimeMs: STARTED + 5 }], plan]))
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^unconfirmed: skills-x — the thing · plan 3/)
  })

  test('worktree marker written by path wins over the cwd', { options: ON }, async ($, on) => {
    const tree = `${ROOT}/.worktrees/w`
    world(on, new Map([[`${tree}/docs/plans/2026-10-16-skills-x-thing/plan.md`, plan[1]]]))
    await write($, `${tree}/.shawarma/active`, MARKER_TEXT('run W0'))
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
    expect(await bandText($)).toBe(`shawarma: ${MARKER} is malformed`)
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

  test('a Write of a relative marker path is this session\'s', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, '.shawarma/active', MARKER_TEXT('run W1'))
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

  test('earlier-session and unconfirmed rows are dimmed, own row is not', { options: ON }, async ($, on) => {
    const files = new Map([[MARKER, { text: MARKER_TEXT('plan 2'), mtimeMs: STARTED - 1 }], plan])
    world(on, files)
    await bash($, 'true')
    const mount = () => $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND } as any)
    expect((await (await mount()).find({ type: 'Text' }))?.props.dimColor).toBe(true)
    await write($, MARKER, MARKER_TEXT('plan 3'))
    expect((await (await mount()).find({ type: 'Text' }))?.props.dimColor).toBe(false)
    await bash($, 'sh mark.sh plan 4')
    expect((await (await mount()).find({ type: 'Text' }))?.props.dimColor).toBe(true)
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

describe('own writes (R6)', () => {
  test('an Edit of the marker path is this session\'s', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    await $.tool.call({ tool: 'Edit', file_path: MARKER, old_string: 'run W1', new_string: 'run W2' } as any)
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W2 · /)
  })

  test('another writer landing inside this session\'s Write: unconfirmed', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await write($, MARKER, `${MARKER_TEXT('run W1')}#race\n`)
    expect(await bandText($)).toMatch(/^unconfirmed: skills-x — the thing · run OTHER · /)
  })

  test('replaced after the call with the same mtime: unconfirmed', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    files.set(MARKER, { text: MARKER_TEXT('run OTHER'), mtimeMs: files.get(MARKER)!.mtimeMs })
    await bash($, 'true')
    expect(await bandText($)).toMatch(/^unconfirmed: skills-x — the thing · run OTHER · /)
  })

  test('turn end re-reads the marker', { options: ON }, async ($, on) => {
    const files = new Map([plan])
    world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    files.set(MARKER, { text: MARKER_TEXT('run W2'), mtimeMs: STARTED + 999_000 })
    await $.turn.complete({ answer: '', reason: 'answer', durationMs: 1 } as any)
    expect(await bandText($)).toMatch(/^unconfirmed: .* run W2/)
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
    files.set(MARKER, { text: MARKER_TEXT('run W2'), mtimeMs: STARTED + 999_000 })
    await clock.advance(14_000)
    expect(await bandText($)).toMatch(/run W1/)
    await clock.advance(1_000)
    expect(await bandText($)).toMatch(/^unconfirmed: .* run W2/)
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

  test('unchanged files: at most 6 fs calls a period, no re-read (3e)', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const n0 = log.length
    await clock.advance(60_000)
    const calls = log.slice(n0)
    expect(calls.filter(line => line.startsWith('read ')).length).toBe(0)
    expect(calls.filter(line => line === `stat ${MARKER}`).length).toBe(4)
    expect(calls.length <= 4 * 6).toBe(true)
  })

  test('no row drawn: no check runs', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await bash($, 'true')
    const before = log.filter(line => line.startsWith('stat ')).length
    await clock.advance(60_000)
    expect(log.filter(line => line.startsWith('stat ')).length).toBe(before)
  })

  test('band off: no check runs', { options: { ...ON, band: false } }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const before = log.filter(line => line.startsWith('stat ')).length
    await clock.advance(60_000)
    expect(log.filter(line => line.startsWith('stat ')).length).toBe(before)
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
    await $.ui.press({ plugin: 'shawarma-companion', key: 'row' })
    expect(log.filter(line => !/^(exists|stat|read) /.test(line))).toEqual(['command shawarma-companion', 'open shawarma-companion'])
  })

  test('pane off: no command, no button', { options: { ...ON, pane: false } }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan]), ROOT, log)
    await $.session.start({ source: 'startup', cwd: ROOT } as any)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND } as any)
    expect(await ui.find({ type: 'Button' })).toBe(undefined)
    expect(log.filter(line => !/^(exists|stat|read) /.test(line))).toEqual([])
  })
})

describe('model', () => {
  test('parseMarker', async () => {
    expect(parseMarker('d\nrun W0\n', MARKER)).toEqual({ planDir: `${ROOT}/d`, step: 'run W0' })
    expect(parseMarker('/abs\nplan 1\n', MARKER)?.planDir).toBe('/abs')
    expect(parseMarker('d\nwalk W0\n', MARKER)).toBe(null)
    expect(parseMarker('d\nplan\n', MARKER)).toBe(null)
    expect(parseMarker('d\nplanning 2\n', MARKER)).toBe(null)
    expect(parseMarker('', MARKER)).toBe(null)
  })

  test('parseMarker: exactly two lines, trailing slashes dropped', async () => {
    expect(parseMarker('d\nrun W0\nextra\n', MARKER)).toBe(null)
    expect(parseMarker('d/\nrun W1\n\n', MARKER)?.planDir).toBe(`${ROOT}/d`)
  })

  test('clean and redSet', async () => {
    expect(clean('a\u001b[0m\tb\nc')).toBe('a [0m b c')
    expect(clean('a\nb', true)).toBe('a\nb')
    expect(redSet('## 4. Tests\n\nPredicted red set: x\n## 5. Gate\n')).toBe('Predicted red set: x')
    expect(redSet('## 4. Tests\n\nnone\n')).toBe(null)
  })

  test('parseDecisions counts dated rows only', async () => {
    expect(parseDecisions([
      '# T-1 decisions', '', '`<date> | <label> | <decision> | <why>`',
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
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read) /.test(line))
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

  // W3-R2: at most 10 fs calls per tool call.
  test('a Bash call with two markers: at most 10 fs calls (3e)', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan, [MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/plan.md`, plan[1]],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/decisions.md`, decisions[1]]]), ROOT, log)
    await write($, `${TREE}/.shawarma/active`, MARKER_TEXT('run W0'))
    const n0 = log.length
    await bash($, 'true')
    expect(fsCalls(log, n0).length <= 10).toBe(true)
  })

  test('a marker Write, one marker: at most 10 fs calls (3e)', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan, decisions]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const n0 = log.length
    await write($, MARKER, MARKER_TEXT('run W2'))
    expect(fsCalls(log, n0).length <= 10).toBe(true)
  })

  // W3-R3: CR and CRLF line ends.
  test('parseDecisions splits on \\r\\n, \\r and \\n', async () => {
    const rows = ['2026-10-21 | Q1 RULING | a | b', '2026-10-21 | D1 DEFAULT | c | d', '| 2026-10-21 | D2 DEFAULT | e | f |']
    expect(parseDecisions(rows.join('\r'))).toEqual({ decisions: 3 })
    expect(parseDecisions(rows.join('\r\n'))).toEqual({ decisions: 3 })
  })

  // W3-D1: a failed Edit records no own write.
  test('a failed Edit of another session\'s worktree marker is not own', { options: ON }, async ($, on) => {
    world(on, new Map([[`${TREE}/.shawarma/active`, { text: MARKER_TEXT('run OTHER'), mtimeMs: STARTED + 5 }],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/plan.md`, plan[1]]]))
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active`, old_string: 'run W9', new_string: 'run W10' } as any)
    expect(await bandText($)).toMatch(/^unconfirmed: skills-x — the thing · run OTHER/)
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
    expect(log.slice(n0).filter(line => line === `stat ${MARKER}`)).toEqual([])
  })

  test('row, gone, row again: one check, not two', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    await bash($, `rm ${MARKER}`)
    await write($, MARKER, MARKER_TEXT('run W2'))
    const n0 = log.length
    await clock.advance(60_000)
    expect(log.slice(n0).filter(line => line === `stat ${MARKER}`).length).toBe(4)
  })

  test('reload with a row kept in state: the first drawing restarts the check', { options: ON }, async ($, on) => {
    const files = new Map([plan, [MARKER, { text: MARKER_TEXT('run W1'), mtimeMs: STARTED + 61_000 }]])
    const clock = world(on, files)
    const kept = { marker: MARKER, title: 'skills-x — the thing', step: 'run W1', since: STARTED + 61_000,
      isEarlier: false, isUnconfirmed: false, decisions: 0, planDir: DIR, planAt: 0, decisionsAt: null }
    on('state.get', { plugin: 'shawarma-companion' } as any, async (_$, e: any, next: any) => {
      const r = await next(e)
      return e.key === 'snap' && r.value.version === 0 ? { value: { value: kept, version: 0 } } : r
    })
    expect(await bandText($)).toMatch(/run W1/)
    files.set(MARKER, { text: MARKER_TEXT('run W2'), mtimeMs: STARTED + 999_000 })
    await clock.advance(15_000)
    expect(await bandText($)).toMatch(/^unconfirmed: .* run W2/)
  })
})

describe('review round 3 (W3-R4)', () => {
  const TREE = `${ROOT}/.worktrees/w`
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read) /.test(line))
  const paneText = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'Pane',
      requestId: 'shawarma-companion', props: {} } as any)
    return (await ui.find({ type: 'Markdown' }))?.props.text ?? (await ui.find({ type: 'Text' }))?.text
  }

  test('F2 a Write whose before-call stat fails still makes its marker the one drawn', { options: ON }, async ($, on) => {
    world(on, new Map([plan,
      [`${TREE}/.shawarma/active`, { text: MARKER_TEXT('run OLD'), mtimeMs: STARTED + 5 }],
      [`${TREE}/docs/plans/2026-10-16-skills-x-thing/plan.md`, { text: '# tree plan\n', mtimeMs: 0 }],
      [MARKER, { text: MARKER_TEXT('run CWD'), mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${TREE}/.shawarma/active`]))
    await write($, `${TREE}/.shawarma/active`, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/^tree plan · run W1 · /)
  })

  test('F2 an Edit whose before-call stat fails is not own', { options: ON }, async ($, on) => {
    world(on, new Map([plan, [MARKER, { text: MARKER_TEXT('run W1'), mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${MARKER}`]))
    await $.tool.call({ tool: 'Edit', file_path: MARKER, old_string: 'run W1', new_string: 'run W2' } as any)
    expect(await bandText($)).toMatch(/^unconfirmed: skills-x — the thing · run W2/)
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
    expect(text).toBe(`shawarma: ${MARKER} is malformed`)
    expect(fsCalls(log, n0)).toEqual([])
  })

  test('F6 plan dir created while idle: the problem line goes within 15 s', { options: ON }, async ($, on) => {
    const files = new Map<string, File>()
    const clock = world(on, files)
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/plan dir not found/)
    files.set(`${DIR}/notes.txt`, { text: '', mtimeMs: 0 })
    await clock.advance(15_000)
    expect(await bandText($)).toBe(`2026-10-16-skills-x-thing · run W1 · ${SINCE(1)} · 0 decisions`)
  })

  test('F1 a failed Edit of a missing marker, cwd marker, plan dir missing: at most 10 fs calls', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }]]), ROOT, log)
    const n0 = log.length
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active`, old_string: 'run W0', new_string: 'run W1' } as any)
    expect(fsCalls(log, n0).length <= 10).toBe(true)
  })

  test('F1 a failed Write of a new marker, cwd marker, plan dir missing: at most 10 fs calls', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }]]), ROOT, log)
    const n0 = log.length
    await write($, `${TREE}/.shawarma/active`, `${MARKER_TEXT('run W0')}#fail`)
    expect(fsCalls(log, n0).length <= 10).toBe(true)
  })

  test('F3 a press on the row when the pane cannot open: nothing escapes', { options: ON }, async ($, on) => {
    const fail = new Set<string>()
    const log: string[] = []
    world(on, new Map([plan]), ROOT, log, fail)
    await write($, MARKER, MARKER_TEXT('run W1'))
    await bandText($)
    fail.add('open')
    const n0 = log.length
    expect(await $.ui.press({ plugin: 'shawarma-companion', key: 'row' }).then(() => 'resolved', () => 'rejected')).toBe('resolved')
    expect(log.slice(n0).filter(line => line.startsWith('open '))).toEqual(['open shawarma-companion'])
    expect(await bandText($)).toMatch(/run W1/)
  })

  test('D9 each check period: at most 6 fs calls, plan dir missing', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map(), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    for (let period = 0; period < 3; period += 1) {
      const n0 = log.length
      await clock.advance(15_000)
      expect(fsCalls(log, n0).length <= 6).toBe(true)
    }
  })
})

describe('review round 4 (W3-R5)', () => {
  const TREE = `${ROOT}/.worktrees/w`
  const fsCalls = (log: string[], from: number) => log.slice(from).filter(line => /^(exists|stat|read) /.test(line))

  test('N1 a failed Edit of a missing marker, no brief yet: at most 10 fs calls', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }], decisions]), ROOT, log)
    const n0 = log.length
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active`, old_string: 'run W0', new_string: 'run W1' } as any)
    expect(fsCalls(log, n0).length <= 10).toBe(true)
  })

  test('N1 a failed Write of a missing marker, no brief yet: at most 10 fs calls', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }], decisions]), ROOT, log)
    const n0 = log.length
    await write($, `${TREE}/.shawarma/active`, `${MARKER_TEXT('run W0')}#fail`)
    expect(fsCalls(log, n0).length <= 10).toBe(true)
  })

  test('N1 a failed Edit of a missing marker, plan dir with neither file: at most 10 fs calls', { options: ON }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([[MARKER, { text: MARKER_TEXT('run A'), mtimeMs: STARTED + 5 }],
      [`${DIR}/notes.txt`, { text: '', mtimeMs: 0 }]]), ROOT, log)
    const n0 = log.length
    await $.tool.call({ tool: 'Edit', file_path: `${TREE}/.shawarma/active`, old_string: 'run W0', new_string: 'run W1' } as any)
    expect(fsCalls(log, n0).length <= 10).toBe(true)
  })

  test('N2 an Edit of a missing marker that another writer creates inside the call: unconfirmed', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await $.tool.call({ tool: 'Edit', file_path: MARKER, old_string: '#appear', new_string: 'x' } as any)
    expect(await bandText($)).toMatch(/^unconfirmed: skills-x — the thing · run OTHER/)
  })

  test('N3 a failed Write, the file already holding its text: unconfirmed', { options: ON }, async ($, on) => {
    const text = MARKER_TEXT('run W1 #fail')
    world(on, new Map([plan, [MARKER, { text, mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${MARKER}`]))
    await write($, MARKER, text)
    expect(await bandText($)).toMatch(/^unconfirmed: /)
  })

  test('a successful Write whose before-call stat fails is still own', { options: ON }, async ($, on) => {
    world(on, new Map([plan, [MARKER, { text: MARKER_TEXT('run OLD'), mtimeMs: STARTED + 5 }]]), ROOT, [], new Set([`stat once ${MARKER}`]))
    await write($, MARKER, MARKER_TEXT('run W1'))
    expect(await bandText($)).toMatch(/^skills-x — the thing · run W1 · /)
  })
})
