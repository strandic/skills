---
# skills-mdg4
title: step3-markers works about half the time — find out why
status: todo
type: task
priority: normal
created_at: 2026-09-01T11:05:18Z
updated_at: 2026-09-01T11:05:18Z
---

`step3-markers-in-source` is the one behaviour no control produced at all — 0.47 treatment against 0.00 for both the one-liner and the placebo, all ten control runs at zero. It is the strongest evidence in the suite that the method's specific content does something.

But the treatment's own scatter is `0.67 · 0.00 · 1.00 · 0.67 · 0.00` — it works about half the time, and two runs scored zero outright.

Worth understanding before it is quoted as a headline. The mean is real; so is the instability, and reporting 0.47 without the spread would be the mean hiding the instrument.

- [ ] read the transcripts of the two zero-scoring runs — did the agent implement instead of placing markers, as it did before the transcript was fixed?
- [ ] decide whether this is skill instability, replay-transcript fragility, or a grader that is too strict about `not-a-doc-list`
- [ ] if it is the skill, that is a finding about step 3 and belongs in the ledger
