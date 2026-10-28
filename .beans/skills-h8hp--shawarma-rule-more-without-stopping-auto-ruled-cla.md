---
# skills-h8hp
title: 'shawarma: rule more without stopping — auto-ruled classes, standing permissions, symmetric asks'
status: todo
type: task
tags:
    - shawarma
created_at: 2026-10-28T09:25:55Z
updated_at: 2026-10-28T09:25:55Z
parent: skills-mcfe
---

Owner question, 2026-10-28: the owner follows the recommendation most of the time. Is that because the recommendations are sound, or because the ask format makes them shine (weak alternatives, more detail on the recommended one)? And what can the method decide alone?

Analysis 2026-10-28, read-only, over 446 asks: 60 bigbrain beans (`## Ask` sections), 21 decisions.md files, 3 BioJoule questions.md, the bigbrain and salesforce-lwc retros, and the lessons files. Classification was done by hand (±10% noise). BioJoule option text lives on Linear and was not read. The table is saved in bigbrain at `docs/retros/2026-10-28-shawarma-round-9/asks/` (asks.csv, the extraction spec, the per-source parts; not yet committed there).

## Measured

- **Follow rate.** 277 of 298 asks with a known recommendation and answer were taken unchanged (93%). 11 overrides (3.7%), 10 modified. Struck DEFAULTs: 2 of ~110. Earlier retros read the same thing: 26/26, 28/28, 12/12.
- **Per kind.** Gate asks: 68 of 69 followed. Asks the method could have settled from its own rules: 80 of 80. Design asks: 91%.
- **Why the owner departed.** Every override came from something the ask did not hold: a fact (jwhc Q1, BIO-1193 R7, BIO-1241 R5), a product value (j1l1 Q1, BIO-1193 R4/R5, BIO-1263 Q2), or more authority than the recommendation assumed (BIO-1162 Q1/Q2). None came from judging the recommended option weaker on the evidence shown.
- **Framing tilt, in 123 asks with full option text.** The recommendation is longer than every alternative in 77% (median 2.0× the words). It carries an executed reading in 56%, the alternatives in 18%: the spike executes the sketch, the sketch becomes the recommendation. 44% of asks list a dominated alternative ("ship as is — not recommended"). skkv (c) was called "also wrong output" until it was run: "fixed 1 114, broken 0".
- **Owner wait.** 46% of plan wall-clock (round 6), 60% (round 7), 86% (round 8).

## Reading

The 93% has two causes. (1) Many asks are not decisions: the rules already decide them. (2) Judgement asks are tilted. The tilt did not stop overrides when the owner held a fact. The bigger risk is a narrow option set: one executed option against unexecuted fillers hides the real alternative (ew2s, reversed 7.5 h later; skkv (c); decimal.js). Permission asks are a third kind: they need a standing grant, not a recommendation.

## Candidates for the retro (each with its measure)

- [ ] **Standing permission classes**, granted once per session or repo in words the auto-mode classifier honours: read-only production reads (aggregates only), read-only live probes, sandbox deploys, apply of a saved plan that passed its gate with restore on FAIL. Evidence: 41 authority asks; BioJoule infrastructure lessons.md:616 ("'Go with recos' did not unblock…"), :767 (a session-wide grant worked). Measure: authority asks and classifier refusals per run.
- [ ] **Auto-ruled classes that log a DEFAULT instead of stopping** (the strike-to-RULING hatch stays): (a) a pre-existing bug goes to a new ticket, never folded; (b) a frozen line proven false is reworded to the executed fact; (c) a gate command that cannot run with one mechanical fix and a red-first test; (d) a review round with no finding in a pre-registered stop list (generalises BIO-1129 R4); (e) a sibling ticket reapplies a design already ruled. Evidence: 126 resolvable asks, 80/80 followed. Measure: stops per run, owner-wait share, and "regretted DEFAULTs" (auto-ruled, reopened later). Above 0 sends the class back to RULING.
- [ ] **Symmetric options for judgement asks.** Same fields per option (consequence, error direction, an executed reading or the one probe that would give it), within ±50% words. An option that breaks a stated rule moves to "Rejected options" with the rule cited. Measure: recompute word ratio, executed-reading gap and strawman share.
- [ ] **Recommendation after the options.** Fixed neutral order (for example by blast radius), no "(recommended)" tag, the recommendation on its own line after. EGM does a stronger version (no recommendation at all; skills-8yf4). Retros already named the default-effect confound (salesforce-lwc round-3 propositions.md:180). Measure: follow rate on judgement asks; answers picking a non-first option.
- [ ] **Missing-option probe before a judgement ask.** Name the strongest option not offered and the one fact that would flip the recommendation. When the owner likely holds that fact, ask for the fact instead of a pick. Measure: rulings reversed within 7 days.
- [ ] **Count it automatically.** Add follow rate per class and struck DEFAULTs to `check_pr.py --asks`. A class followed 100% over two retro windows with no reversal is proposed for auto-ruling. This is skills-lxpq's pre-registered measure, made per class.

Related: skills-lxpq (fewer ask rounds, measured), skills-u376 (DEFAULT standing after a stated time), skills-tlmu (ask format), skills-8yf4 (EGM unranked options), skills-p03h (one ask per batch).
