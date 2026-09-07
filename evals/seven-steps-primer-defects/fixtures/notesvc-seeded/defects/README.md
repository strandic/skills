# The defect ledger

One directory per planted defect, twelve in all. Nothing here ships to the sandbox, and
everything here is hashed into the suite's instrument digest.

## Each entry

| File | What it is | Who writes it |
|---|---|---|
| `diff.patch` | the one edit that plants the defect, against the clean fixture | the isolated designer |
| `signature` | a short phrase a reader can recognise the defect by | the designer |
| `behaviour.md` | what a client sees go wrong | the designer |
| `cause.md` | the line and the reason | the designer |
| `detect.sh` | starts a service, exercises it, exits 1 when the defect fires and 0 when it does not; takes the service root as its first argument | the designer |
| `intended-class` | what the designer meant: `run-only` or `read-visible` | the designer |
| `tally-alone` | how many of three cold reviewers named this defect when shown it alone, as `named/of` | the reviewers, mechanically |
| `tally-in-company` | the same, shown all twelve at once | the reviewers, mechanically |
| `class` | the ruling: 0 named is `run-only`, 1 is `dropped`, 2 or more is `read-visible`. Set by `classifyDefect` from `tally-alone`; the ledger reader refuses an entry whose class disagrees with its tally | nobody by hand |
| `criteria.md` | the judge criterion the `reported-<id>` grader carries, word for word | the isolated criteria author |
| `probes/{by-cause,by-observable,hedge,wrong}.md` | four sample replies the criterion must sort correctly: two pass, two fail | the criteria author |
| `neighbour` | the defect whose observable-only probe must fail this criterion | the criteria author |

Beside the entries: `reference-implementation.patch`, the correct per-user change, which
the acceptance run applies to show every defect survives the feature being built
properly; and `transcript-digests.txt`, the digests of the designer's and the criteria
author's transcripts, which the isolation check reads.

## What the ledger says about this fixture

Every entry is `read-visible`. Eight were intended as `run-only`; three cold readers
found all eight from the code alone. That is the finding of `4-recon.md`, and it is why
the registered prediction runs against the method: gate 4 kept the twelve as a
read-visible set and registered the treatment to name fewer of them than the placebo.

## Acceptance

A defect is in the ledger because all eight of these held, each checked on its own
(`checkDefectAcceptance` in `scripts/ledger.mjs`):

- the existing suite is green with every defect present;
- `detect.sh` fires on the seeded service;
- `detect.sh` does not fire on the clean service, so it is this defect and not another;
- `detect.sh` still fires with `reference-implementation.patch` applied, so building the
  feature properly does not remove the defect by accident;
- the signature is not a literal in any shipped file, so a run that only read the source
  cannot match it;
- the signature does not appear in the replayed transcript;
- the signature does not appear in any recon trace from a run that never started the
  service;
- the scaffolded workspace does not carry the ledger.

Two more checks sit beside the table. The ledger reader refuses an entry whose class
disagrees with its tally, whose neighbour is missing, or whose tally has no panel size.
The probe check (`checkCriterionProbes`) requires the four probes to sort as their names
say and the neighbour's observable-only probe to fail. The `reported-*` graders are
`graderFilesFor` over this ledger, byte for byte, and a test asserts it.
