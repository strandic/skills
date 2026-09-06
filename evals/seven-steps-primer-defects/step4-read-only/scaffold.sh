#!/usr/bin/env bash
# Delegates to the seeded fixture's scaffold. This file exists only because
# context.scaffold_script must name a path inside its own case directory.
set -e
bash "$(dirname "$0")/../fixtures/notesvc-seeded/scaffold.sh"
