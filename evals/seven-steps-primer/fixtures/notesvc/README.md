# notesvc — eval fixture

TODO: a small, zero-dependency Node service. Zero-dep is not a preference: a
scaffold_script gets two minutes, runs before credentials exist, and has no ssh
keys or credential helpers (harness-facts.md #1), so anything needing an install
flakes for reasons unrelated to the skill under test.

TODO: must be realistic enough that "add per-user rate limiting" is a genuine
medium structural change, and small enough to read in one sitting.
