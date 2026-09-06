#!/usr/bin/env bash
#
# Puts notesvc-seeded into the harness's empty sandbox workspace. Same contract as the
# clean fixture's scaffold (see evals/seven-steps-primer/fixtures/notesvc/scaffold.sh):
# five files to the workspace root, git init and one commit, an .integrity sentinel.
#
# TODO: copy the clean scaffold's body here once the five seeded files exist; the file
# list stays exactly five and is listed explicitly — defects/, this script and README.md
# are never copied, and the fixture-health test asserts the scaffolded workspace carries
# no defects/ directory and no signature string.
set -euo pipefail
echo "scaffold: notesvc-seeded is not built yet (step 4)" >&2
exit 1
