2026-11-22 | Q1 RULING | A — a lane counts whole in the part where its first record falls; the totals print a count of lanes that end under a later command; reco A | owner: "A, go with reco". Matches the --since/--until rule (a lane kept whole by its first record); 0 of 263 local lanes cross a command under any anchor
2026-11-22 | D1 DEFAULT | a message counts in the part of its first record | keeps each message's usage whole; parts' tokens sum to the session's (A2: 0 mismatches)
2026-11-22 | D2 DEFAULT | an owner turn counts in the part of its last owner record | text typed just before a command belongs to that run; turn sums stay the session's
2026-11-22 | D3 DEFAULT | a part a command opened is always kept; part 0 dropped when it has no message, turn or lane | attack A4: dropping empty command parts hid a typed command
2026-11-22 | D4 DEFAULT | cuts read over the whole file; figures over the window; a part keeps its command's label before the window | a part is that run whatever the window (A3: 0 differences)
2026-11-22 | D5 DEFAULT | part lines only for a session of two parts or more; no model or effort per part | single-part sessions print as before (A7); smaller change
2026-11-22 | D6 DEFAULT | part 0 before the first command; part N the Nth owner skill command in the file | numbers stable across windows
2026-11-22 | D7 DEFAULT | every owner-typed skill command cuts, any skill, labelled or not | the ticket: "the label rule already finds them"
2026-11-22 | D8 DEFAULT | part minutes run over the part's own records; parts' minutes can sum below the session's | same definition as session and lane minutes; documented
2026-11-22 | D9 DEFAULT | crossing count in text only when not zero; always in JSON | as the other "skipped" counts
2026-11-22 | D10 DEFAULT | a lane ending at the next command's exact instant does not cross it | it did not run under that command
2026-11-22 | D1 RULING | - a message counts in the part of its first record; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D2 RULING | - an owner turn counts in the part of its last owner record; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D3 RULING | - a part a command opened is always kept; part 0 dropped when it has no message, turn or lane; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D4 RULING | - cuts read over the whole file; figures over the window; a part keeps its command's label before the window; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D5 RULING | - part lines only for a session of two parts or more; no model or effort per part; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D6 RULING | - part 0 before the first command; part N the Nth owner skill command in the file; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D7 RULING | - every owner-typed skill command cuts, any skill, labelled or not; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D8 RULING | - part minutes run over the part's own records; parts' minutes can sum below the session's; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D9 RULING | - crossing count in text only when not zero; always in JSON; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-22 | D10 RULING | - a lane ending at the next command's exact instant does not cross it; reco - | owner: "go with reco on all defaults"; the default as written
2026-11-23 | W3a RULING | A apply the four doc fixes from the code review (minutes rounding, part label in text, part label fallback, privacy rule 3 grammar); reco A | owner: "Go with reco"; the code was right in all four, the doc text was incomplete or misleading
2026-11-23 | W3b DEFAULT | the `--labels` flag row (scripts/runmeter.md:66) and the test file header, which still name session labels only, go to ticket skills-jmj3, not this PR | older sentences the change did not touch; incomplete, not contradicting the code; a third review round for two prose lines
