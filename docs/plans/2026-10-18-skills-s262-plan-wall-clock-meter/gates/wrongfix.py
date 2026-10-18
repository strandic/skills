"""G3's FAIL readings: each wrong fix is one replacement in scripts/plantime.mjs, run on a plans file and graded by g3.py.
    python3 -I wrongfix.py <worktree> <transcripts dir> <plans file> -> one line per wrong fix: id, g3's last line"""
import sys, subprocess, tempfile, os
wt, tdir, plans = sys.argv[1:4]
W = [
 ('W1', "'exec-wait', 'other-session-wait', 'idle-for-coordinator'", "'exec-wait', 'idle-for-coordinator'"),  # another session's message is not a wake-up
 ('W2', "for (const [cg, fallback] of carried) if (WAKE.has(k)) total += cg; else add(fallback, cg);", "for (const [cg] of carried) add('human', cg);"),  # deferred gaps are owner wait
 ('W3', "if (d.isCompactSummary) return 'compaction';", "if (d.isCompactSummary) return 'human';"),  # compaction is owner wait
 ('W4', "|| (task !== undefined && tasksOf(kinds).get(task)?.call)", ""),  # notifications by task id only are lanes
 ('W5', "  if (OWNER_ORIGINS.has(origin) && !d.isMeta) return 'human';\n", ""),  # owner text quoting tags is read by its tags
]
src = open(f'{wt}/scripts/plantime.mjs').read()
here = os.path.dirname(os.path.abspath(__file__))
for wid, old, new in W:
    if src.count(old) != 1: print(wid, f'NOT APPLIED (matches {src.count(old)})'); continue
    d = tempfile.mkdtemp()
    open(f'{d}/plantime.mjs', 'w').write(src.replace(old, new))
    out = subprocess.run(['node', f'{d}/plantime.mjs', tdir, plans, '--json'], capture_output=True, text=True).stdout
    open(f'{d}/out.json', 'w').write(out)
    g = subprocess.run([sys.executable, '-I', f'{here}/g3.py', tdir, plans, f'{d}/out.json'], capture_output=True, text=True).stdout.strip().splitlines()
    print(wid, g[-1] if g else 'NO OUTPUT')
