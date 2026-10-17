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
 * replaces `old_string` with `new_string`, Bash `rm <path>`
 * deletes one, Bash `echo <step> > .shawarma/active` or `sh mark.sh <step>`
 * writes the cwd's marker, any other Bash changes nothing.
 */
function world(on: On, files: Files, cwd = ROOT, log: string[] = []) {
  let tick = STARTED + 60_000
  const clock = mock.clock(on, { now: STARTED + 120_000 })
  on('fs.exists', (_$, e) => ({ value: files.has(e.path) || [...files.keys()].some(k => k.startsWith(`${e.path}/`)) }))
  on('fs.read', (_$, e) => (log.push(`read ${e.path}`), { value: files.get(e.path)?.text ?? '' }))
  on('fs.stat', (_$, e) => (log.push(`stat ${e.path}`), {
    value: { kind: 'file', size: 1, mtimeMs: files.get(e.path)?.mtimeMs ?? 0, isLink: false },
  }))
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', (_$, e) => ({
    value: { exitCode: 0, stdout: `${e.init?.cwd ?? cwd}\n`, stderr: '',
      isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('session.usage', () => ({
    value: { startedAt: STARTED, context: { tokens: 1, window: 100, percent: 42 } } as any,
  }))
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return <Box /> })
  on('session.start', () => ({ cwd }) as any)
  on('turn.complete', () => ({ text: '' }))
  on('command.register', (_$, e) => { log.push(`command ${e.name}`); return { value: undefined } as any })
  on('ui.open', (_$, e) => { log.push(`open ${e.id}`); return { value: { isPlaced: true } } as any })
  on('tool.call', (_$, e: any) => {
    tick += 1000
    const at = (path: string) => (path.startsWith('/') ? path : `${cwd}/${path}`)
    if (e.tool === 'Write') files.set(at(e.file_path), { text: e.content, mtimeMs: tick })
    if (e.tool === 'Write' && e.content.includes('#race')) {
      files.set(at(e.file_path), { text: MARKER_TEXT('run OTHER'), mtimeMs: tick + 1 })
    }
    if (e.tool === 'Edit') {
      const old = files.get(at(e.file_path))?.text ?? ''
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
  text: '2026-10-16 | RULING | a | b\n2026-10-16 | DEFAULT | c | d\n', mtimeMs: 0 }]

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
    expect(await bandText($)).toBe(`skills-x — the thing · run W3 review · ${SINCE(1)} · 1 ruled, 1 default`)
  })

  test('marker written through Bash, even naming the path: unconfirmed label', { options: ON }, async ($, on) => {
    world(on, new Map([plan]))
    await bash($, 'echo plan 2 spike > .shawarma/active')
    expect(await bandText($)).toBe(`unconfirmed: skills-x — the thing · plan 2 spike · ${SINCE(1)} · 0 ruled, 0 default`)
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
    expect(await bandText($)).toMatch(/0 ruled, 0 default/)
    await write($, `${DIR}/decisions.md`, '2026-10-16 | RULING | a | b\n')
    expect(await bandText($)).toMatch(/1 ruled, 0 default/)
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

  test('unchanged marker: stat only, no re-read', { options: ON }, async ($, on) => {
    const log: string[] = []
    const clock = world(on, new Map([plan]), ROOT, log)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const count = (kind: string) => log.filter(line => line.startsWith(kind)).length
    const [reads, stats] = [count('read '), count('stat ')]
    await clock.advance(60_000)
    expect(count('read ')).toBe(reads)
    expect(count('stat ')).toBe(stats + 4)
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
    expect(text).toMatch(/- 2026-10-16 \| RULING \| a \| b/)
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
    expect(log.filter(line => !/^(stat|read) /.test(line))).toEqual(['command shawarma-companion', 'open shawarma-companion'])
  })

  test('pane off: no command, no button', { options: { ...ON, pane: false } }, async ($, on) => {
    const log: string[] = []
    world(on, new Map([plan]), ROOT, log)
    await $.session.start({ source: 'startup', cwd: ROOT } as any)
    await write($, MARKER, MARKER_TEXT('run W1'))
    const ui = await $.ui.mount({ plugin: 'shawarma-companion', surface: 'terminal', component: 'AbovePrompt', props: BAND } as any)
    expect(await ui.find({ type: 'Button' })).toBe(undefined)
    expect(log.filter(line => !/^(stat|read) /.test(line))).toEqual([])
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

  test('parseDecisions counts unreadable lines', async () => {
    expect(parseDecisions('x | RULING | a | b\n\nnot a row\nx | ruling | a | b\nx | DEFAULT | a\n'))
      .toEqual({ ruled: 1, defaults: 0, unreadable: 3 })
  })

  test('clockTime adds the day only when it is not today', async () => {
    const at = new Date(2026, 9, 16, 14, 2).getTime()
    expect(clockTime(at, at + 60_000)).toBe('14:02')
    expect(clockTime(at, at + 86_400_000)).toBe('10-16 14:02')
  })

  test('rowText cuts the title first, never past columns', async () => {
    const row = { title: 'a long ticket title', step: 'run W3', since: 0, isEarlier: false,
      ruled: 0, defaults: 0, unreadable: 0 }
    for (const columns of [0, 1, 10, 30, 40, 200]) {
      expect(rowText(row, columns).length <= Math.max(columns, 0)).toBe(true)
    }
    expect(rowText(row, 200).startsWith('a long ticket title · run W3')).toBe(true)
  })
})
