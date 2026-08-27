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

// TODO(seam): resolve PreRegistrationDigest — committed blob sha or content hash,
// and whether a dirty pre-registration hard-fails the run. Policy, not
// implementation; must be decided in step 4.

// TODO: implement BuildProvenance — suite sha, pre-registration digest, CLI
// version, pinned models, timestamp.

// TODO: implement FormatComparison — delta and capability tables under separate
// headings, noise floor printed beside them.

// TODO: argv handling — results dir in, report path out.
