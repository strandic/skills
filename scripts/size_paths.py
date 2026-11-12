#!/usr/bin/env python3
"""Token cost of each shawarma load path, by Claude Code's own estimator.

    python3 scripts/size_paths.py <skill dir> <out dir> && claude --plugin-dir <out dir> plugin details szp

Writes one throwaway skill per load path (the files that path reads, concatenated);
`plugin details` prints each one's on-invoke tokens. The retro reports these before and after.
<out dir> is a new or empty folder, or this script's own earlier output: any other is refused.
"""
import json, os, shutil, sys

PATHS = {  # load path -> files read on it, per SKILL.md's Dispatch
    'plan-brief': ['SKILL.md', 'plan.md', 'spike.md', 'brief-template.md', 'lanes.md'],
    'plan-questions': ['SKILL.md', 'plan.md', 'brief-template.md', 'spike.md', 'lanes.md'],
    'interview-brief': ['SKILL.md', 'interview.md', 'plan.md', 'spike.md', 'brief-template.md', 'lanes.md'],
    'run': ['SKILL.md', 'run.md', 'brief-template.md', 'plan.md', 'lanes.md'],
    'retro': ['SKILL.md', 'retro.md'],
}

USAGE = 'usage: python3 scripts/size_paths.py <skill dir> <out dir>'
if len(sys.argv) != 3 or not sys.argv[1] or not sys.argv[2]:
    print(USAGE, file=sys.stderr)
    sys.exit(2)
src, out = sys.argv[1], os.path.abspath(sys.argv[2].rstrip('/') or sys.argv[2])
def body(f):
    s = open(os.path.join(src, f), encoding='utf-8').read()
    return s.split('---', 2)[2] if f == 'SKILL.md' else s
def refuse(why):
    print(f'refusing: {why}', file=sys.stderr)
    sys.exit(2)
def real_dir(p):
    return os.path.isdir(p) and not os.path.islink(p)
def real_file(p):
    return os.path.isfile(p) and not os.path.islink(p)
def ours(d):
    """True for a folder that holds this script's earlier output and nothing else."""
    try:
        meta, skills = os.path.join(d, '.claude-plugin'), os.path.join(d, 'skills')
        names = os.listdir(skills)
        return (set(os.listdir(d)) == {'.claude-plugin', 'skills'}
                and real_dir(meta) and real_dir(skills)
                and os.listdir(meta) == ['plugin.json']
                and real_file(os.path.join(meta, 'plugin.json'))
                and json.load(open(os.path.join(meta, 'plugin.json'))).get('name') == 'szp'
                and set(names) <= set(PATHS)
                and all(real_dir(os.path.join(skills, n))
                        and os.listdir(os.path.join(skills, n)) == ['SKILL.md']
                        and real_file(os.path.join(skills, n, 'SKILL.md')) for n in names))
    except (OSError, ValueError, AttributeError):
        return False
def replaceable(d):
    """The folder is replaced, so it must be ours to replace: new, empty, or an earlier output."""
    if os.path.islink(d):
        return False  # a link is never followed and never replaced
    if not os.path.lexists(d):
        return True
    try:
        return os.path.isdir(d) and (not os.listdir(d) or ours(d))
    except OSError:
        return False
if not os.path.isfile(os.path.join(src, 'SKILL.md')):
    refuse(f'{src} holds no SKILL.md: not a skill folder')
try:  # every path's text is read before anything is replaced
    texts = {name: ''.join(body(f) for f in files if os.path.exists(os.path.join(src, f)))
             for name, files in PATHS.items()}
except (OSError, UnicodeDecodeError, IndexError) as e:
    refuse(f'{src} cannot be read as a skill ({type(e).__name__}): SKILL.md needs its front '
           'matter, and every file must be UTF-8')
if not replaceable(out):
    refuse(f'{out} exists and this script did not make it, or something was added to it '
           '(give a new or empty folder)')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(os.path.join(out, '.claude-plugin'))
manifest = os.path.join(out, '.claude-plugin', 'plugin.json')
json.dump({'name': 'szp', 'version': '0.0.1'}, open(manifest, 'w'))
for name, text in texts.items():
    os.makedirs(os.path.join(out, 'skills', name))
    head = f'---\nname: {name}\ndescription: x\n---\n'
    open(os.path.join(out, 'skills', name, 'SKILL.md'), 'w').write(head + text)
    print(name, len(text.split()), 'words')
