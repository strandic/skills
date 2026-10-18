"""Gate oracle for skills-s262: the round-6/7 meters (an independent implementation) against scripts/plantime.mjs --json.

    python3 -I oracle.py <old meter .py> <transcripts dir> <plans file> <plantime --json output>

Per plan, orchestrator and lanes: every bucket outside the regrouped set must be equal to the millisecond
(after renaming exec:pytest -> exec:suite, exec:python-probe -> exec:probe); the regrouped set
(human, other, other-session-wait, idle-for-coordinator, scheduled, compaction, lane-wait, exec-wait, interrupt,
external) must sum equal. G3 (g3.py) grades the split inside that set.
The window and the lanes are this tool's own, by the meter's header (R6): the window opens at the first
`plan <ticket>` command the owner gave at or before the brief time (no origin or the owner's, the command's
tags opening the text, or a typed `/…shawarma plan <ticket>`); a lane is a regular `*.jsonl` file under
`subagents/`, no link followed, with any record in the window. Each is split by the old meter.
Prints one line per plan and a final `PASS n/n` or `FAIL <k>/<n>`. Durations only.
"""
import importlib.util, io, contextlib, json, sys, glob, os, re
from collections import defaultdict
src, tdir, plans_path, new_path = sys.argv[1:5]
spec = importlib.util.spec_from_file_location('old', src); old = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    try: spec.loader.exec_module(old)
    except Exception: pass
REN = {'exec:pytest': 'exec:suite', 'exec:python-probe': 'exec:probe'}
GROUP = {'human', 'other', 'other-session-wait', 'idle-for-coordinator', 'scheduled', 'compaction', 'lane-wait', 'exec-wait', 'interrupt', 'external'}
new = {d['ticket']: d for d in json.load(open(new_path))}
OWNER = {'human', 'person', 'composer', 'suggestion'}
OWNER_TAGS = re.compile(r'\s*<(command-name|command-message|command-args|bash-input)>')
def text(c):
    if isinstance(c, str): return c
    return ' '.join(b['text'] for b in c if isinstance(b, dict) and b.get('type') == 'text' and isinstance(b.get('text'), str)) if isinstance(c, list) else ''
def start_of(recs, ticket, brief):
    tk = re.escape(ticket)
    args = re.compile(r'<command-args>\s*plan\s+' + tk + r'(?![\w-])[^<]*</command-args>')
    typed = re.compile(r'\s*/(?:[\w-]+:)?shawarma\s+plan\s+' + tk + r'(?![\w-])')
    for d in recs:
        if d['type'] != 'user' or d.get('isSidechain') or d.get('isMeta'): continue
        k = (d.get('origin') or {}).get('kind')
        if k is not None and k not in OWNER: continue
        s = text((d.get('message') or {}).get('content'))
        tt = old.ts(d['timestamp'])
        if tt <= brief and ((OWNER_TAGS.match(s) and args.search(s)) or typed.match(s)): return tt
def lane_files(session_path):
    top = session_path[:-6]
    if os.path.islink(top) or not os.path.isdir(f'{top}/subagents') or os.path.islink(f'{top}/subagents'): return []
    out = []
    for root, dirs, files in os.walk(f'{top}/subagents'):  # does not follow directory links
        out += [os.path.join(root, f) for f in files if f.endswith('.jsonl') and not os.path.islink(os.path.join(root, f)) and os.path.isfile(os.path.join(root, f))]
    return out
def ms(b): return {REN.get(k, k): round(v * 1000) for k, v in b.items()}
def cmp(o, n):
    keys = (set(o) | set(n)) - GROUP
    bad = {k: (o.get(k, 0), n.get(k, 0)) for k in keys if abs(o.get(k, 0) - n.get(k, 0)) > 1}
    go = sum(v for k, v in o.items() if k in GROUP); gn = sum(v for k, v in n.items() if k in GROUP)
    if abs(go - gn) > 1 + len(o): bad['(group sum)'] = (go, gn)
    return bad
fails = 0; total = 0
for line in open(plans_path):
    if not line.strip() or line.startswith('#'): continue
    t, sess, brief = line.split()[:3]; total += 1
    path = glob.glob(f'{tdir}/{sess}*.jsonl')[0]
    recs = old.records(path); t1 = old.ts(brief); t0 = start_of(recs, t, t1)
    n = new.get(t)
    if t0 is None or n is None or 'notRun' in n:
        ok = (t0 is None) == (n is None or 'notRun' in n); fails += not ok
        print(t, 'both NOT RUN' if ok else f'MISMATCH old start={t0} new={n and n.get("notRun")}'); continue
    ob = ms(old.split(recs, t0, t1))
    sb = defaultdict(float)
    for sp in lane_files(path):
        sr = old.records(sp)
        if not any(t0 <= old.ts(r['timestamp']) <= t1 for r in sr): continue
        for k, v in old.split(sr, t0, t1).items(): sb[k] += v
    bad = cmp(ob, n['buckets']); badl = cmp(ms(sb), n['laneBuckets'])
    wall_ok = abs(round((t1 - t0) * 1000) - n['wallMs']) <= 1
    ok = not bad and not badl and wall_ok; fails += not ok
    print(t, 'ok' if ok else 'DIFF', 'orchestrator', bad or '=', 'lanes', badl or '=', '' if wall_ok else f'wall {round((t1-t0)*1000)} vs {n["wallMs"]}')
print(f'PASS {total}/{total}' if not fails else f'FAIL {fails}/{total}')
