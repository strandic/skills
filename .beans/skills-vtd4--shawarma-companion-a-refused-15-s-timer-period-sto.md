---
# skills-vtd4
title: 'shawarma-companion: a refused 15 s timer period stops the check for good'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T16:56:49Z
updated_at: 2026-11-20T16:56:49Z
---

From the skills-cm2l plan (D2, 2026-11-20; attack lane finding A11a). The mod types say "a refused period ends the interval" (`claude-code.d.ts:3710@2.1.325`). When another hook refuses one `clock.every` dispatch, the 15 s check ends, but `check` stays non-null, so `watch($, true)` on each draw never starts a new one. Probe: `hold["clock.every"]` rejects once; 0 fs calls in the next 60 s, and the band keeps `run W1` after the marker changed to W2 (out-of-date content until the next tool call). Same on the base and on the skills-cm2l sketch. Fix to weigh: detect the ended interval (e.g. a last-tick time older than 2 periods at draw) and start a new one.
