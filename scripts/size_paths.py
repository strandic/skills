#!/usr/bin/env python3
"""Token cost of each shawarma load path, by Claude Code's own estimator.

    python3 scripts/size_paths.py <skill dir> <out dir> && claude --plugin-dir <out dir> plugin details szp

Writes one throwaway skill per load path (the files that path reads, concatenated);
`plugin details` prints each one's on-invoke tokens. The retro reports these before and after.
"""
import json, os, shutil, sys

PATHS = {  # load path -> files read on it, per SKILL.md's Dispatch
    'plan-brief': ['SKILL.md', 'plan.md', 'spike.md', 'brief-template.md', 'lanes.md'],
    'plan-questions': ['SKILL.md', 'plan.md', 'brief-template.md', 'spike.md', 'lanes.md'],
    'interview-brief': ['SKILL.md', 'interview.md', 'plan.md', 'spike.md', 'brief-template.md', 'lanes.md'],
    'run': ['SKILL.md', 'run.md', 'brief-template.md', 'plan.md', 'lanes.md'],
    'retro': ['SKILL.md', 'retro.md'],
}

src, out = sys.argv[1], sys.argv[2]
def body(f):
    s = open(os.path.join(src, f)).read()
    return s.split('---', 2)[2] if f == 'SKILL.md' else s
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out + '/.claude-plugin')
json.dump({'name': 'szp', 'version': '0.0.1'}, open(out + '/.claude-plugin/plugin.json', 'w'))
for name, files in PATHS.items():
    os.makedirs(f'{out}/skills/{name}')
    text = ''.join(body(f) for f in files if os.path.exists(os.path.join(src, f)))
    open(f'{out}/skills/{name}/SKILL.md', 'w').write(f'---\nname: {name}\ndescription: x\n---\n' + text)
    print(name, len(text.split()), 'words')
