"""Gate G3 for skills-s262: the wait buckets, from a second implementation that imports nothing from scripts/plantime.mjs.
Its origin and tag rules restate the meter's classify, so it cannot grade them (unit tests bind them); what it reads its
own way is the window, the lanes, and the exec-wait / lane-wait split.
    python3 -I g3.py <transcripts dir> <plans file> <plantime --json output>
A wait is the time from the last record that is not merely accompanying to the record that woke the session,
charged by who woke it. Finds the window start itself (first `plan <ticket>` command, its own parser) and
reads the session and its lanes. A background command's or Monitor's notification is told by the harness's
text in it ("Background command", "Monitor event"), not by ids as the meter does.
Compares, per plan, each wait bucket (orchestrator and lanes) to the meter's to the ms (±1 ms per record).
Prints one line per plan and `PASS n/n` or `FAIL k/n`. Durations only."""
import json, sys, glob, re, os
from datetime import datetime
tdir, plans_path, new_path = sys.argv[1:4]
def t(s): return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp() * 1000
ISO = re.compile(r'^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$')
OWNER = {'human', 'person', 'composer', 'suggestion'}; KNOWN = OWNER | {'task-notification', 'peer', 'coordinator'}
def load(path):
    out = []
    with open(path, 'rb') as f:
        for raw in f:
            try: d = json.loads(raw.decode('utf-8-sig'))
            except Exception: continue
            if isinstance(d, dict) and d.get('type') in ('user', 'assistant') and isinstance(d.get('timestamp'), str) and ISO.match(d['timestamp']): out.append(d)
    out.sort(key=lambda d: t(d['timestamp'])); return out
def text(c):
    if isinstance(c, str): return c
    return ' '.join(b.get('text', '') or '' for b in c if isinstance(b, dict) and b.get('type') == 'text') if isinstance(c, list) else ''
def who(d, calls):
    """'active' | 'accompanying' | a wait bucket"""
    c = (d.get('message') or {}).get('content')
    if d['type'] == 'assistant':
        for b in c if isinstance(c, list) else []:
            if isinstance(b, dict) and b.get('type') == 'tool_use' and 'id' in b: calls[b['id']] = b.get('name')
        return 'active'
    if isinstance(c, list):
        for b in c:
            if isinstance(b, dict) and b.get('type') == 'tool_result':
                return 'human' if calls.get(b.get('tool_use_id')) == 'AskUserQuestion' else 'active'
    if d.get('isCompactSummary'): return 'accompanying'
    s = text(c); o = (d.get('origin') or {}); k = o.get('kind')
    if re.match(r'\s*\[Request interrupted by user', s): return 'active'
    if k in OWNER and not d.get('isMeta'): return 'human'
    if d.get('turnOrigin') == 'scheduled' or o.get('subkind') == 'scheduled-trigger' or re.match(r'\s*<tick[\s>]', s): return 'scheduled'
    if '<cross-session-message' in s or '<teammate-message' in s: return 'other-session-wait'
    if k == 'task-notification' or '<task-notification>' in s:
        return 'exec-wait' if re.search(r'Background command "|Monitor event: "|<summary>Monitor', s) else 'lane-wait'
    if k == 'peer' or '<agent-message' in s or re.match(r'\s*<remote-review[\w-]*[\s>]', s): return 'lane-wait'
    if k == 'coordinator' or '<coordinator-relay' in s or s.lstrip().startswith('The coordinator sent a message'): return 'idle-for-coordinator'
    if k is not None and k not in KNOWN: return 'external'
    if d.get('isMeta') or re.match(r'\s*<(system-reminder|local-command-caveat|local-command-stdout|bash-stdout|bash-stderr|fetched-web-content)[\s>]', s): return 'accompanying'
    if re.match(r'\s*<(command-name|command-message|command-args|bash-input)>', s): return 'human'
    if re.match(r'\s*<[a-zA-Z][\w-]*[\s>]', s): return 'external'
    if not s.strip(): return 'accompanying'
    return 'idle-for-coordinator' if d.get('isSidechain') else 'human'
WAITS = ('human', 'other-session-wait', 'lane-wait', 'exec-wait', 'idle-for-coordinator', 'scheduled', 'external')
def start_of(recs, ticket):
    pat = re.compile(r'<command-args>\s*plan\s+' + re.escape(ticket) + r'(?![\w-])[^<]*</command-args>|^\s*/(?:[\w-]+:)?shawarma\s+plan\s+' + re.escape(ticket) + r'(?![\w-])')
    for d in recs:
        if d['type'] == 'user' and not d.get('isSidechain') and not d.get('isMeta') and pat.search(text((d.get('message') or {}).get('content'))): return t(d['timestamp'])
def waits(recs, t0, t1):
    calls = {}; got = dict.fromkeys(WAITS, 0.0); anchor = None
    for d in recs:
        tt = t(d['timestamp']); w = who(d, calls)
        if w == 'accompanying': continue
        if w in WAITS and anchor is not None and anchor >= t0 and tt <= t1: got[w] += tt - anchor
        anchor = tt
    return got
new = {d['ticket']: d for d in json.load(open(new_path))}
fails = total = 0
for line in open(plans_path):
    f = line.split()
    if not f or f[0].startswith('#'): continue
    total += 1; tk = f[0]; n = new.get(tk)
    if not n or 'notRun' in n: print(tk, 'NOT RUN in the meter'); continue
    path = glob.glob(f'{tdir}/{f[1]}*.jsonl')[0]; recs = load(path)
    t1 = t(f[2]); t0 = t(f[3]) if len(f) > 3 and not f[3].startswith('#') else start_of(recs, tk)
    got = waits(recs, t0, t1)
    lanes = dict.fromkeys(WAITS, 0.0)
    for lp in glob.glob(f'{path[:-6]}/subagents/**/*.jsonl', recursive=True):
        if os.path.islink(lp) or not os.path.isfile(lp): continue
        lr = load(lp)
        if not lr or not (t0 <= t(lr[0]['timestamp']) <= t1): continue
        for k, v in waits(lr, t0, t1).items(): lanes[k] += v
    tol = len(recs) + 1
    bad = {k: (round(got[k]), n['buckets'].get(k, 0)) for k in WAITS if abs(got[k] - n['buckets'].get(k, 0)) > tol}
    bad.update({'lane ' + k: (round(lanes[k]), n['laneBuckets'].get(k, 0)) for k in WAITS if abs(lanes[k] - n['laneBuckets'].get(k, 0)) > tol})
    if abs((t1 - t0) - n['wallMs']) > 1: bad['wall'] = (round(t1 - t0), n['wallMs'])
    fails += bool(bad); print(tk, 'ok' if not bad else f'DIFF {bad}')
print(f'PASS {total}/{total}' if not fails else f'FAIL {fails}/{total}')
