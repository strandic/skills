# skills-pi0y decisions

`<date> | <label> | <decision> | <why>`, one per line, mirroring §9.

2026-10-28 | W0 DEFAULT | base efbca68 → 5bc8e50; only marketplace.json moved (version lines), the diff still applies; sketch 39 pass on CLI 2.1.312 | Wave 0 base check
2026-10-28 | W0-R1 RULING | the row counts dated decisions.md rows as `<n> decisions`; the label is not read | Owner: "Go with reco, add the residue to h8hp". The frozen parser read 22 of 28 real logs as no decision.
2026-10-28 | W0-D1 DEFAULT | `1 decision` when there is one | Wording only.
2026-10-28 | W3-n1 DEFAULT | the "421 decisions" check shares its date test with the W0-Q1 count; 3a shape scan is the independent check | review round 1, 3a oracle note
2026-10-29 | W3-R1 RULING | the 15 s check also stats plan.md and decisions.md; ≤ 6 fs calls per period | Owner: "go with recos". The count and title went stale while idle.
2026-10-29 | W3-R2 RULING | keep ≤ 10 fs calls per tool call: each marker checked once, stat-or-ENOENT instead of exists + stat | Owner: "go with recos". Measured 12 and 17.
2026-10-29 | W3-R3 RULING | split decisions.md on \r\n, \r or \n; §6 says a hand-written log can miscount with no label | Owner: "go with recos". CR-only logs under-counted.
2026-10-29 | W3-D1 DEFAULT | a failed Edit of a marker path is not an own write | review round 1, wrong output
2026-10-29 | W3-D2 DEFAULT | clean also blanks U+0080–U+009F | the engine refuses C1 controls
2026-10-29 | W3-D3 DEFAULT | the four hooks catch their own errors | §3 error surface
2026-10-29 | W3-D4 DEFAULT | three timer tests | pin the check
2026-10-29 | W3-D5 DEFAULT | README and type comment wording | prose fixes
