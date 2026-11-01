---
# skills-tx1x
title: 'shawarma check_pr P4: a range after a wave id leaves a stray bare id that can pass'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-01T12:03:45Z
updated_at: 2026-11-01T12:03:45Z
---

In skills/shawarma/check_pr.py, RANGE_RE knows only bare prefixes (D1–D5). A range written after a wave-prefixed id, such as 'W9-R1–R6', reads as {W9-R1, R6}; if a bare R6 is recorded (for example in the brief's authority clause), P4 passes a row whose real id W9-R1 is recorded nowhere. 'W3-D1–D5' reads as {W3-D1, D5} and is not expanded. Found by the skills-pi0y check_pr review lane (F1), present before the W4-R1 fix. Fix: expand wave ranges, and do not read the bare tail of a wave range as its own id.
