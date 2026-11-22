# Research lane report (plan step 1), saved verbatim by the orchestrator

See the session transcript for the full text; summary of rows as returned:

- Owner skill command: `user` record, string content, tags command-message, command-name, command-args; origin.kind=human, no isMeta (19 records, CLI 2.1.301–2.1.330). Next record: isMeta skill body (defer).
- Model-invoked skill: one `<command-message>` record with skill-format tag, isMeta=true, no origin; or a Skill tool_use. Not `human`, so it opens no part (plantime.mjs:191).
- Built-in/local commands open with `<command-name>`; classify reads them as human (owner turns); not skill commands.
- Resume appends to the same file (0 of 219 files hold a foreign sessionId). Fork (binary 2.1.330) copies records keeping their timestamps, adds forkedFrom (0 local). /clear starts a new file, copies nothing. Compaction stays in the same file and keeps earlier commands.
- Lanes: meta.toolUseId ties 68 of 72 Agent lanes to their Agent tool_use; 4 nested (parentAgentId). 195 workflow lanes tie by run folder name in a Workflow toolUseResult. Lane first record 88 ms–17.3 s after the tool_use (median 354 ms). Agent tool_result time is never the lane's end (all async_launched).
- No lane crosses a command boundary: 68/68 Agent, 195/195 workflow lanes, under any anchor (launch call, first record, last record). 7 of 126 lanes (sessions with a command) start before the first command.
- Timestamps not in file order: user/assistant records step back 74 times in 49 files, at most 31.5 s; none involves a skill command.
- Prior art: ccusage blocks (fixed 5 h windows, boundary rule undocumented) https://ccusage.com/guide/blocks-reports ; OpenTelemetry children tied to parent by id at launch, may end after parent https://opentelemetry.io/docs/concepts/signals/traces/ ; OpenTracing FollowsFrom.
- Found nothing: CI job attribution (not searched); a JS package of the CLI; forkedFrom / continued-in records locally.
