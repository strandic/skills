---
# skills-enjt
title: 'shawarma-companion: a line break in a ticket name opens a Markdown line in the pane'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T10:50:06Z
updated_at: 2026-11-20T10:50:06Z
---

Found by the skills-s6qg plan's attack round 3 (C6d), pre-existing on the base. A marker file named `active-x<newline>### Fake heading` is drawn as the row's ticket; the pane puts `row.ticket` inside `**…**` and cleans the joined text with line breaks kept, so the name opens a Markdown heading. The band cleans it to spaces. Fix: clean each ticket name (line breaks to spaces) before it enters the pane's Markdown, as s6qg does for the listed names.
