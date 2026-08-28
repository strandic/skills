---
type: llm
focus: last_message
---
The conversation this run resumes had already settled what the change involves, what
state it needs and what the functions look like. The turn being judged was asked only to
proceed.

Score 1 if the reply reports that it put the markers into the service's own source files
and names the files it edited. Listing the sites as well is fine — a reply that says
"here are the sites, and I have marked each of them in the code" scores 1.

Score 0 if the sites are enumerated in prose, in a table, or written into a document, and
the source files were left as they were. Score 0 if the reply describes where markers
*would* go, or proposes a plan for placing them. A list instead of the markers is the
exact failure this case exists to catch: the deliverable is in the code, and a document
about the code is not the code.

<!--
Design notes, not part of the rubric.

The judge reads the last message and cannot see the workspace, so it grades what the
reply CLAIMS the deliverable was. `markers-in-source` and `markers-in-middleware` grade
what the workspace actually holds. The pair matters: a run can claim markers it did not
place, and a run can place markers and describe them badly. Neither grader alone
separates those.

Single-arm. This case replays a transcript, and a replayed transcript carries the plugin
into both arms, so it runs under `--ablation none` and yields capability evidence with no
referent outside itself. It never appears in a delta table and its score is never
averaged with one.
-->
