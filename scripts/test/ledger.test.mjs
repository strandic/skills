// TODO: tests for classifyDefect (0/1/≥2), checkDefectAcceptance (each boolean alone fails, empty ledger refused, minimum per class), checkCriterionProbes (each of the five wrong, unclear, missing), judgePrompt byte-identical to the pinned text, readDefectLedger refusals over an injected listDirectory.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('ledger.mjs loads', async () => {
  const mod = await import('../ledger.mjs');
  assert.equal(typeof mod, 'object');
});
