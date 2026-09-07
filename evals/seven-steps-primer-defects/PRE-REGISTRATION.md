# Pre-registration — `seven-steps-primer-defects`, Tier 2 experiment 2

<!-- TODO: written after gate 4 and presented for its own proceed before any sweep (0-plan.md D9). Carries: conditions [treatment, placebo, run-oneliner]; the scored case with contrasts 'groups' and its three groups (run-only-reported, read-visible-reported, run-only-minus-read-visible as a difference group); the control-tagged diagnostic; every group direction copied verbatim from 0-plan.md D4; runsPerCase 10; threshold 0.6; subject sonnet, judge opus; claudeVersion 2.1.250; publishAllConditions true; the ceiling block from D6; the measured per-run cost, the caps and the runaway ceiling from step 4; the accepted defect count and both tallies per defect; the floor rule with FLOOR_ERROR_MULTIPLIER 2; the rule that errored runs count and skipped-paid-grader runs are excluded. No number in this file may be a predicted score. -->


## DRAFT block — step-4 recon only, replaced by the real registration after gate 4

```json
{
  "conditions": [
    "treatment",
    "placebo",
    "run-oneliner"
  ],
  "cases": [
    {
      "name": "step4-seeded-defects",
      "evidence": "delta",
      "ablation": "with-without",
      "tags": [
        "outcome",
        "scored"
      ],
      "scored": true,
      "measures": "DRAFT for the step-4 runner probe only: names the planted defects in its reply; the real registration registers grader groups, not this case-level score."
    },
    {
      "name": "step4-read-only",
      "evidence": "capability",
      "ablation": "none",
      "tags": [
        "control",
        "diagnostic"
      ],
      "scored": false,
      "measures": "Diagnostic only: the same case with Bash, Write and Edit not granted."
    }
  ],
  "expectedDirection": {
    "step4-seeded-defects/none": 1,
    "step4-seeded-defects/placebo": 1,
    "step4-seeded-defects/run-oneliner": 1
  },
  "threshold": 0.6,
  "subjectModel": "sonnet",
  "judgeModel": "opus",
  "runsPerCase": 10,
  "claudeVersion": "2.1.250",
  "publishAllConditions": true
}
```
