"""Runs each mutant (one replacement in scripts/plantime.mjs) against scripts/test/plantime.test.mjs in a copy of the tree.
    python3 -I mutants.py <worktree> -> one line per mutant: id, applied?, red tests"""
import sys, shutil, subprocess, re, tempfile, os
wt = sys.argv[1]
M = [
 ('M1', "'exec-wait', 'other-session-wait', 'idle-for-coordinator'", "'exec-wait', 'idle-for-coordinator'"),
 ('M2', "if (WAKE.has(k)) total += cg; else add(fallback, cg);", "if (WAKE.has(k)) total += cg; else add(k, cg);"),
 ('M3', "carried.push([g, k === DEFER ? 'other' : 'compaction']);", "carried.push([g, 'other']);"),
 ('M4', "const inside = prev !== null && t0 <= prev && t <= t1;", "const inside = prev !== null && t0 <= t && t <= t1;"),
 ('M5', "const hit = typeof d.toolUseResult?.timedOutAfterMs === 'number' || (call?.name", "const hit = (call?.name"),
 ('M6', 'const LIMIT_TEXT = /^(?:<error>)?(?:', 'const LIMIT_TEXT = /^(?:'),
 ('M7', "(call?.name === 'Bash' && LIMIT_TEXT.test(text))", "LIMIT_TEXT.test(text)"),
 ('M8', "plan\\\\s+${t}(?![\\\\w-])[^<]*</command-args>", "plan\\\\s+${t}[^<]*</command-args>"),
 ('M9', "if (d.type !== 'user' || d.isSidechain || d.isMeta) continue;", "if (d.type !== 'user' || d.isSidechain) continue;"),
 ('M10', "const typed = new RegExp(`^\\\\s*/", "const typed = new RegExp(`/"),
 ('M11', 'if (!isIso(brief)) bad(', 'if (Number.isNaN(ts(brief))) bad('),
 ('M12', "if (hits.length !== 1) throw", "if (hits.length === 0) throw"),
 ('M13', "if (st.isDirectory()) walk(p);", "if (st.isDirectory()) {}"),
 ('M14', "if (!s.length || ts(s[0].timestamp) < t0 || ts(s[0].timestamp) > p.brief) continue;", "if (!s.length) continue;"),
 ('M15', "out.sort((a, b) => ts(a.timestamp) - ts(b.timestamp));", ""),
 ('M16', "if (last !== 'human') { counted = inside; if (counted) waits.push(0); }", "{ counted = inside; if (counted) waits.push(0); }"),
 ('M17', "if (origin !== undefined && !OWNER_ORIGINS.has(origin) && !READ_ORIGINS.has(origin)) return 'external';", ""),
 ('M18', "if (d.isCompactSummary) return 'compaction';", ""),
 ('M19', "if (d.isMeta || ACCOMPANYING_TAGS.test(text)) return DEFER;", "if (d.isMeta) return DEFER;"),
 ('M20', "if (t0 === undefined) { notRun(", "if (t0 === undefined) { continue; notRun("),
 ('M21', "lines.push(`## ${p.ticket}: wall", "lines.push(`## ${p.ticket} ${path}: wall"),
 ('M22', "counted = inside;", "counted = true;"),
 ('M23', "if (OWNER_TAGS.test(text)) return 'human';", ""),
 ('M24', "if (origin === 'peer' || has('<agent-message') ||", 'if ('),
 ('M25', "  for (const [cg, fallback] of carried) add(fallback, cg);\n  return", "  return"),
 ('M26', "try { d = JSON.parse(line); } catch { bad++; continue; }", "try { d = JSON.parse(line); } catch { continue; }"),
 ('M27', "if (call) return call.name === 'Bash' || call.name === 'Monitor' ? 'exec-wait' : 'lane-wait';", "if (call) return 'lane-wait';"),
 ('M28', "if (args[i] === '--json') { json = true; continue; }", ""),
 ('M29', "if (origin === undefined && /^\\s*\\[Request interrupted by user/.test(text)) return 'interrupt';", ""),
 ('M30', "if (name === 'AskUserQuestion') return 'human';", ""),
 ('M31', "if (d.turnOrigin === 'scheduled' || d.origin?.subkind === 'scheduled-trigger' ||", "if (d.turnOrigin === 'scheduled' ||"),
 ('M32', "if (has('<cross-session-message') || has('<teammate-message')) return", "if (has('<cross-session-message')) return"),
 ('M33', "if (/^\\s*<[a-zA-Z][\\w-]*[\\s>]/.test(text)) return 'external';", ""),
 ('M34', "let from = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;", "let from = 0;"),
 ('M35', "    if (isIso(d.timestamp)) out.push(d); else bad++;", "    if (!Number.isNaN(ts(d.timestamp))) out.push(d); else bad++;"),
 ('M36', "if (seen.has(key)) bad(", "if (false) bad("),
 ('M37', "if (!/^[0-9a-f-]{4,}$/.test(session)) bad(", "if (false) bad("),
 ('M38', "if (st.isDirectory()) walk(p);\n      else if (st.isFile() && f.endsWith('.jsonl')) out.push(p);", "if (st.isDirectory()) walk(p);\n      else if (f.endsWith('.jsonl')) out.push(p);"),
 ('M39', "const why = (e) => (e && typeof e.code === 'string' ? e.code : 'unreadable');", "const why = (e) => String(e?.message);"),
 ('M40', '[realpathSync(process.argv[1]), resolve(process.argv[1])]', '[process.argv[1]]'),
 ('M41', "for (const f of raw.trim().split(/\\s+/)) { if (f.startsWith('#')) break; if (f) fields.push(f); }", "for (const f of raw.replace(/#.*/, '').trim().split(/\\s+/)) { if (f) fields.push(f); }"),
 ('M42', "const hits = names.filter((f) => f.endsWith('.jsonl') && f.startsWith(prefix) && isFile(join(dir, f)));", "const hits = names.filter((f) => f.endsWith('.jsonl') && f.startsWith(prefix));"),
 ('M43', "|| (task !== undefined && kinds.get(`task:${task}`))", ""),
 ('M44', "      if (call && typeof task === 'string') kinds.set(`task:${task}`, call);\n", ""),
 ('M45', "  if (OWNER_ORIGINS.has(origin) && !d.isMeta) return 'human';", "  if (OWNER_ORIGINS.has(origin)) return 'human';"),
 ('M46', " || /^\\s*<tick[\\s>]/.test(text)) return 'scheduled';", ") return 'scheduled';"),
 ('M47', "return d.isSidechain ? 'idle-for-coordinator' : 'human';", "return 'human';"),
 ('M48', "return mo >= 1 && mo <= 12 && d >= 1 && d <= days && h < 24", "return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h < 24"),
 # M49 (`if (waits.length)` for `if (counted)`) is equivalent: only the first record after the start can have a wait that crosses it, so an uncounted turn always has waits empty.
 ('M50', "[realpathSync(process.argv[1]), resolve(process.argv[1])]", "[realpathSync(process.argv[1])]"),
 ('M51', "  try { readdirSync(dir); } catch (e) { throw new Error(`transcripts dir not readable: ${why(e)}`); }\n  const lines = [];", "  const lines = [];"),
 ('M52', " || /^\\s*<remote-review[\\w-]*[\\s>]/.test(text)) return 'lane-wait';", ") return 'lane-wait';"),
 ('M53', "(?:Exit code \\d+\\n)?Command timed out after", "(?:Exit code \\d+\\n)?.*Command timed out after"),
('M54', "  if (OWNER_ORIGINS.has(origin) && !d.isMeta) return 'human';\n  if (d.turnOrigin", "  if (d.turnOrigin"),
 ('M55', "const has = (tag) => (READ_ORIGINS.has(origin) ? text.includes(tag) : text.trimStart().startsWith(tag));", "const has = (tag) => text.includes(tag);"),
 ('M56', "const has = (tag) => (READ_ORIGINS.has(origin) ? text.includes(tag) : text.trimStart().startsWith(tag));", "const has = (tag) => text.trimStart().startsWith(tag);"),
 ('M57', "  return BACKGROUND_TEXT.test(text) ? 'exec-wait' : 'lane-wait';", "  return 'lane-wait';"),
 ('M58', "if (call) return call.name === 'Bash'", "if (false) return call.name === 'Bash'"),
 ('M59', "if (k === 'human' && t0 < t && t <= t1) {", "if (k === 'human' && t0 <= t && t <= t1) {"),
 ('M60', "    if (isIso(d.timestamp)) out.push(d); else bad++;", "    if (isIso(d.timestamp)) out.push(d);"),
 ('M61', "  return { median: s.length ? s[Math.floor((s.length - 1) / 2)] : 0, max: s.length ? s[s.length - 1] : 0 };", "  return { median: s.length ? s[Math.floor((s.length - 1) / 2)] : 0, max: Math.max(0, ...s) };"),
 ('M62', "if (rx.probe.source === DEFAULTS.probe ? isProbe(c) : rx.probe.test(c))", "if (rx.probe.test(c))"),
 ('M63', "if (rx.probe.source === DEFAULTS.probe ? isProbe(c) : rx.probe.test(c))", "if (isProbe(c))"),
 # M64 (r.lastIndex = uv) is equivalent: 'uv run' holds no 'python', so no input tells them apart.
 ('M65', "if (py && seg.indexOf('.py', py.index + py[0].length) >= 0) return true;", "if (py && seg.indexOf('.py') >= 0) return true;"),
 ('M66', "for (const seg of c.split(/[|;&]/)) {", "for (const seg of [c]) {"),
 ('M67', "if (/\\bpython3? -c|\\bnode -e/.test(seg)) return true;", ""),
('M68', "      unread += lb;\n", ""),
 ('M69', "const has = (tag) => (READ_ORIGINS.has(origin) ?", "const has = (tag) => (origin !== undefined ?"),
 ('M70', "    let n = 0, limited = m.limited, unread = bad;", "    let n = 0, limited = m.limited, unread = 0;"),
('M71', "if (origin === undefined && /^\\s*\\[Request", "if (/^\\s*\\[Request"),
 ('M72', "      if (!s.length && lb) { skipped++; continue; } // nothing readable: its window cannot be known\n", ""),
('M73', "    if (t0 <= t && t <= t1) {\n      const call = limitCall(d, k, kinds);", "    if (true) {\n      const call = limitCall(d, k, kinds);"),
 ('M74', "if (call && !limitedCalls.has(call)) { limitedCalls.add(call); limited++; }", "if (call) limited++;"),
 ('M75', "  if (k !== 'exec-wait' || !isStopNotice(text)) return null;", "  return null;"),
 ('M76', "if (k !== 'exec-wait' || !isStopNotice(text))", "if (!isStopNotice(text))"),
 ('M77', "return noticeCall(text, kinds) ?? (id !== undefined ? `id:${id}` : task !== undefined ? `task:${task}` : {});", "return noticeCall(text, kinds) ?? {};"),
 ('M78', "return hit ? call ?? `id:${r.tool_use_id}` : null;", "return hit ? `id:${r.tool_use_id}` : null;"),
 ('M79', "return i >= 0 && text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length) >= 0;", "return /<summary>Background command \"[\\s\\S]*\" was stopped after reaching its background time limit<\\/summary>/.test(text);"),
 ('M80', "&& b.id !== undefined && !kinds.has(b.id)) kinds.set(", "&& b.id !== undefined) kinds.set("),
 ('M81', "  if (has('<cross-session-message') || has('<teammate-message')) return 'other-session-wait';\n  if (has('<task-notification>')) return noticeKind(text, kinds);", "  if (has('<task-notification>')) return noticeKind(text, kinds);\n  if (has('<cross-session-message') || has('<teammate-message')) return 'other-session-wait';"),
 ('M82', "return i >= 0 && text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length) >= 0;", "return i >= 0;"),
('M83', "  if (origin === 'task-notification' || (origin === undefined && has('<task-notification>'))) return noticeKind(text, kinds);\n", ""),
 ('M84', "text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length)", "text.indexOf(STOPPED_CLOSE, i + STOPPED_OPEN.length - 1)"),
 ('M85', "return hit ? call ?? `id:${r.tool_use_id}` : null;", "return hit ? call ?? {} : null;"),
]
src = open(f'{wt}/scripts/plantime.mjs').read()
for mid, old, new in M:
    n = src.count(old)
    if n != 1: print(mid, f'NOT APPLIED (matches {n})'); continue
    d = tempfile.mkdtemp(); os.makedirs(f'{d}/scripts/test')
    open(f'{d}/scripts/plantime.mjs', 'w').write(src.replace(old, new))
    shutil.copy(f'{wt}/scripts/test/plantime.test.mjs', f'{d}/scripts/test/')
    try:
        out = subprocess.run(['node', '--test', '--test-reporter=tap', '--test-timeout=20000', f'{d}/scripts/test/plantime.test.mjs'], capture_output=True, text=True, timeout=180).stdout
        red = [m.group(1) for m in re.finditer(r'^not ok (\d+) ', out, re.M)]
    except subprocess.TimeoutExpired:
        red = ['HANG']
    print(mid, 'red:', ','.join(red) or 'NONE (survives)')
    shutil.rmtree(d)
