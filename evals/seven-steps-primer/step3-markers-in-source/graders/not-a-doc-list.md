---
type: llm
focus: last_message
---
The conversation this run resumes had already settled what the change involves, what
state it needs and what the functions look like. The turn being judged was asked only to
proceed. The step it was asked to do is: put a literal marker (a `TODO` comment) into the
service's own source files at every site where code will change.

Score 1 if the reply says that markers now exist in the source files and names at least
one file that was edited. The shape of the reply does not matter. A list of files with
line numbers, a table, a count such as "eight markers across three files", or one
sentence all score 1 as long as they say the markers are in the files. "Every site has a
marker" followed by the file names scores 1. Listing the sites and saying the markers are
in place scores 1. Do not score down for terseness, for enumerating sites, or for ending
with a gate line.

Score 0 only if the reply describes where markers would go, proposes a plan for placing
them, asks whether to place them, or puts the sites into a document instead of the code,
without saying that the source files were edited. Score 0 if the reply is a fragment that
reports nothing, for example a sentence that stops before saying what was done.
