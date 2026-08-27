#!/usr/bin/env node
/**
 * Turns three sweep documents into one comparison, split by evidence kind.
 * Signatures: ../scripts/interfaces.mjs § merge-results
 */

// TODO: wire handles at this entry point only — ReadTextFile, RevParse, Clock.

// TODO: implement ParseHarnessDocument — tolerate unknown fields; reject only a
// schemaVersion other than 1.

// TODO: implement ExtractRunScores — every run's score, never a mean.

// TODO: implement ComputeContrasts — expected direction comes from the
// pre-registration, never from the numbers being compared.

// TODO: implement ComputeBaselineSpread — max minus min across the per-sweep
// stock-Claude columns. This is the noise floor.

// TODO: implement MergeSweeps — split rows into deltaRows and capabilityRows as
// two arrays; never one list plus a filter.

// TODO: implement PreRegistrationDigest — content hash, and hard-fail when
// `git status --porcelain` shows the pre-registration dirty. Ruled in recon.

// TODO: implement BuildProvenance — suite sha, pre-registration digest, CLI
// version, pinned models, timestamp.

// TODO: implement FormatComparison — delta and capability tables under separate
// headings, noise floor printed beside them.

// TODO: mark every contrast whose |value| < baselineSpread with belowNoiseFloor,
// so I1b can pass. Sub-noise contrasts are published, never suppressed.

// TODO: wire the invariant checks from ./invariants.mjs before writing any report —
// I1, I1b, I2, I4, I8 all take the merged report. Refuse to emit a report that
// violates one; a violated invariant is not a warning.

// TODO: argv handling — results dir in, report path out.
