"""Gate oracle for skills-s262: the round-6/7 meters (an independent implementation) against scripts/plantime.mjs --json.

    python3 -I oracle.py <old meter .py> <transcripts dir> <plans file> <plantime --json output>

Per plan, orchestrator and lanes: every bucket outside the regrouped set must be equal to the millisecond
(after renaming exec:pytest -> exec:suite, exec:python-probe -> exec:probe); the regrouped set
(human, other, other-session-wait, idle-for-coordinator, scheduled, compaction, lane-wait, exec-wait, interrupt,
external) must sum equal. G3 (g3.py) grades the split inside that set.
Prints one line per plan and a final `PASS n/n` or `FAIL <k>/<n>`. Durations only.
"""
import importlib.util, io, contextlib, json, sys, glob, os
from collections import defaultdict
src, tdir, plans_path, new_path = sys.argv[1:5]
spec = importlib.util.spec_from_file_location('old', src); old = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    try: spec.loader.exec_module(old)
    except Exception: pass
REN = {'exec:pytest': 'exec:suite', 'exec:python-probe': 'exec:probe'}
GROUP = {'human', 'other', 'other-session-wait', 'idle-for-coordinator', 'scheduled', 'compaction', 'lane-wait', 'exec-wait', 'interrupt', 'external'}
new = {d['ticket']: d for d in json.load(open(new_path))}
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
    recs = old.records(path); t0 = old.start_of(recs, t); t1 = old.ts(brief)
    n = new.get(t)
    if t0 is None or n is None or 'notRun' in n:
        ok = (t0 is None) == (n is None or 'notRun' in n); fails += not ok
        print(t, 'both NOT RUN' if ok else f'MISMATCH old start={t0} new={n and n.get("notRun")}'); continue
    ob = ms(old.split(recs, t0, t1))
    sb = defaultdict(float)
    for sp in glob.glob(f'{path[:-6]}/subagents/**/*.jsonl', recursive=True):
        sr = old.records(sp)
        if not sr or not (t0 <= old.ts(sr[0]['timestamp']) <= t1): continue
        for k, v in old.split(sr, t0, t1).items(): sb[k] += v
    bad = cmp(ob, n['buckets']); badl = cmp(ms(sb), n['laneBuckets'])
    wall_ok = abs(round((t1 - t0) * 1000) - n['wallMs']) <= 1
    ok = not bad and not badl and wall_ok; fails += not ok
    print(t, 'ok' if ok else 'DIFF', 'orchestrator', bad or '=', 'lanes', badl or '=', '' if wall_ok else f'wall {round((t1-t0)*1000)} vs {n["wallMs"]}')
print(f'PASS {total}/{total}' if not fails else f'FAIL {fails}/{total}')
