# Attack lane report (plan step 2), saved by the orchestrator

Lane: plan-time attack lane, sketch.patch v1 on bb89183. Scripts and raw output beside this file (local only).

- Suite: sketch 59/61; base 55/55. Fails: the `--json` exact-shape test and the doc test naming every JSON key (doc not yet written).
- Oracle finding (A1): reading live transcripts twice let a session being written grow between runs (4223d73b, messages 31 vs 30). Line changed to read one frozen snapshot for both trees.
- A1: 10 of 10 sessions equal on 11 fields (turns, messages, lanes, 4 tokens, 4 lane tokens); parts per session 1–6.
- A2: 1463 sequences. Real shape (origin human): parts-sum mismatches 0; cut-count mismatches 0 vs an independent count; shared fields changed 0; lanes crossing 46. NOORIGIN variant (the test helper's shape, 0 such records in real data): cut-count mismatches 644 — the sketch cuts through classify's tag rule, the oracle requires an owner origin. Unit contexts (window, isSidechain, labels) not varied one at a time.
- A3: 190 day pairs, 475 session-windows, 1322 parts: 0 differences.
- A4: lane starting at a command's instant → that command's part; lane ending exactly at the next command → not crossing (strict `>`); 1 ms later → crossing. FINDING: two commands in one turn at one instant — the first command's part (only its command record) was dropped; part numbers skipped 2 and a typed command vanished from the text.
- A5: 1463 sequences, text and JSON, with and without --labels: label without --labels 0; SECRET / path / full id hits 0. On the new test fixtures: NOT RUN (not exported).
- A6: 20k commands + 20k lanes: base 4.35/2.54 s, sketch 3.60/3.66 s; RSS ×1.3–1.5. 200k records: ×~1.0 time, ×1.05 RSS. sessionLines copied a growing array per lane (quadratic); 20k lanes in one part: base 3.63 s, sketch 4.42 s.
- A7: sessions with fewer than 2 part lines print byte-identical to base; whole output minus `  # part` lines identical to base, with and without --labels.
- A8: added `sessions[].parts`, `lanes[].part`, `lanes[].crossesCommand`, `totals.lanesCrossingCommand`; dropped 0; changed 0. Ranges: 28 parts, part numbers 0–5, minutes 0.1–15792.9, turns 1–86, messages 1–781, lanes 0–138; numbering not always from 0. Part minutes sum below session minutes (d0d36858 3347.3 vs 3678.6).
- A9: cost bound applies (covered by A6); lanesCrossingCommand is 0 on real data (only synthetic tests bind); Partition needs the no-origin shape and same-instant commands; doc must name 4 keys and "four parts" clashes with "part". Expected values in the 6 new tests re-derived from the fixtures: match; line indices and the full lane line not shown independent. Checklist: "keep the per-session line as a total" has no test; no test for same-instant commands or a lane ending at a command.
- records() sorts stably (Array.prototype.sort, Node 24): commands in time order, binary search valid; equal instants → the last of them.
