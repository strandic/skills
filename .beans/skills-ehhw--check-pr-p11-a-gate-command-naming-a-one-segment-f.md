---
# skills-ehhw
title: 'check_pr P11: a gate command naming a one-segment folder (pytest kitchen) is never checked'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-22T12:44:13Z
updated_at: 2026-11-22T12:44:13Z
---

Found by the skills-4eqz plan (2026-11-22). gate_files (skills/shawarma/check_pr.py) keeps a command token only when it holds '/' or ends in an extension. A §5 rule whose command is 'python3 -m pytest kitchen' therefore names no file for P11, and a gate file changed under kitchen/ since the freeze prints no P11 line. Executed: the first draft of the skills-4eqz test used 'kitchen' and read no P11 line on base for a changed kitchen/gate_lid.py. Direction: false PASS (a gate change goes unflagged). Fix idea: also keep a token that names a directory in the freeze tree (git cat-file -t <freeze>:<token> = tree).
