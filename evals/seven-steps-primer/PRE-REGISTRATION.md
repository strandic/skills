# Pre-registration

TODO: committed BEFORE the first full sweep and never edited afterwards (D6).
Its sha is recorded in every merged report; a mismatch voids the run.

TODO: this file is PROSE for a human, with a single fenced ```json block carrying the
machine-readable PreRegistration (types.mjs). The merger parses that block and nothing
else, so the prose may be edited for clarity without voiding a run while the block
cannot be touched at all.

TODO: the block carries conditions, cases, expectedDirection, threshold (0.6),
subjectModel (`sonnet`), judgeModel (`opus`), runsPerCase, claudeVersion, and
publishAllConditions: true.

TODO: expected direction per case/control pair — copy the registered table from
0-plan.md D6a verbatim. It is already decided; this file records it, it does not
choose it.

TODO: the undertaking, in plain words: all four columns get published whatever
they show, including a placebo level with the treatment or a one-liner that gets
most of the way there.
