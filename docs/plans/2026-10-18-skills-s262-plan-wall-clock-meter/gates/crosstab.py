"""Cross-tab of the old meter's class against the new one's for every in-window gap, weighted by the gap's ms.
    python3 -I crosstab.py <old meter .py> <transcripts dir> <plans file> <new meter .mjs>
Windows and records come from the old meter; the new meter is asked only for each record's class (classes.mjs).
Each off-diagonal cell must belong to a named reclassification; prints `UNNAMED <old> -> <new>` otherwise, then `PASS`/`FAIL <n cells>`."""
import importlib.util, io, contextlib, sys, glob, subprocess, os
from collections import defaultdict
src, tdir, plans, meter = sys.argv[1:5]
spec = importlib.util.spec_from_file_location('old', src); old = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    try: spec.loader.exec_module(old)
    except Exception: pass
here = os.path.dirname(os.path.abspath(__file__))
def classes(path):
    out = subprocess.run(['node', f'{here}/classes.mjs', meter, path], capture_output=True, text=True, check=True).stdout
    return {(ts, uuid): k for ts, uuid, k in (l.split('\t') for l in out.splitlines())}
REN = {'exec:pytest': 'exec:suite', 'exec:python-probe': 'exec:probe'}
# Named reclassifications (old -> new), each a class the plan names:
NAMED = {
 ('other', 'human'): 'R-cmd: a slash command, `!` input or typed text the old meter called other',
 ('human', 'compaction'): 'R-compact: a compaction summary the old meter called human',
 ('other', 'defer'): 'R-defer: an accompanying record whose gap moves to the next wake-up',
 ('human', 'defer'): 'R-defer: an empty or non-text record the old meter called human',
 ('lane-wait', 'defer'): 'R-defer', ('other-session-wait', 'defer'): 'R-defer',
 ('other', 'external'): 'R-ext: an origin kind outside the four known', ('human', 'external'): 'R-ext',
 ('other', 'scheduled'): 'R-sched: a scheduled task fire', ('lane-wait', 'scheduled'): 'R-sched',
 ('human', 'interrupt'): 'R-int: an interrupt, not an owner turn',
 ('tool:other', 'human'): 'R-ask: an AskUserQuestion answer is owner wait',
 ('lane-wait', 'exec-wait'): 'R-exec: a background command or Monitor notification',
 ('human', 'other-session-wait'): 'R-tag: a teammate message', ('other', 'other-session-wait'): 'R-tag',
 ('other', 'interrupt'): 'R-int',
 ('other', 'lane-wait'): 'R-origin: origin task-notification/peer without the text tag',
 ('human', 'lane-wait'): 'R-origin', ('other', 'idle-for-coordinator'): 'R-origin', ('human', 'idle-for-coordinator'): 'R-origin',
}
cells = defaultdict(lambda: [0, 0.0])
for line in open(plans):
    if not line.strip() or line.startswith('#'): continue
    t, sess, brief = line.split()[:3]
    path = glob.glob(f'{tdir}/{sess}*.jsonl')[0]
    recs = old.records(path); t0 = old.start_of(recs, t); t1 = old.ts(brief)
    if t0 is None: continue
    new = classes(path)
    kinds = {}; prev = None
    for d in recs:
        tt = old.ts(d['timestamp'])
        ko = old.classify(d, kinds); ko = REN.get(ko, ko)
        inside = prev is not None and t0 <= prev and tt <= t1
        kn = new[(d['timestamp'], d.get('uuid') or 'undefined')] if inside else ko
        if inside and ko != kn:
            cells[(ko, kn)][0] += 1; cells[(ko, kn)][1] += tt - prev
        prev = tt
bad = 0
for (ko, kn), (n, s) in sorted(cells.items(), key=lambda kv: -kv[1][1]):
    name = NAMED.get((ko, kn))
    print(f'{ko:22} -> {kn:22} n={n:4d} {s/60:8.1f}m  {name or "UNNAMED"}')
    bad += name is None
print('PASS' if not bad else f'FAIL {bad} cells')
