# Lane 3b, round 2: review of fix commit cfbb77e (four doc sentences in scripts/runmeter.md)

## Verdict
I found no problems in the commit. Each of the four changed sentences matches what `scripts/runmeter.mjs` does. I checked each one by running the code on my own synthetic fixtures. I tried to break the stated Minutes bound and could not. Nothing else in `scripts/runmeter.md` contradicts the new text. Two tests fail in the full suite, but neither is in runmeter: one also fails on `98e8d47` and `main`, and the other is a timing test that fails only sometimes (details below).

All probes are in `<session scratchpad>/cb5t-3b-r2/`: `lib.mjs` (fixture builders), `bound.mjs`, `edges.mjs`, `labels.mjs`. I made no changes to the repo, and `git status` stayed clean.

## Findings
None against the commit.

Two low-priority notes outside the commit's four sentences. Neither contradicts the new text.
- **N1.** `scripts/runmeter.md:66` (the `--labels` flag row) says "Also print each session's label: the first two words of the command that opened it." It does not mention part labels. Line 11, rule 3 (`:440`) and the Parts bullet (`:250`) all say parts get labels too. The row has been unchanged since `a87a138`, so this is an existing gap that the parts feature did not update.
- **N2.** The test file's header comment (`scripts/test/runmeter.test.mjs:5-6`) also speaks of session labels only. It is a test file and out of scope; I name it only so it is not missed.

## Checks that held, with readings

**Minutes (`runmeter.md:274`)**
The sentence says per-part rounding can push the sum above the session's minutes by "at most 0.05 minutes for each part, plus 0.05".
- **Code:** `round1` is at `:49`. Part spans use each part's own records (`:309-311`, `:329`). Records are sorted by time with a stable sort (`plantime.mjs:247`), so part spans do not overlap and their raw sum is never more than the session's span.
- **Earlier reproduction:** `repro 0/3s cmds, recs 0,3,3,6 | session 0.1 | parts 2 [0.1,0.1] | excess 0.10 | bound 0.15 HOLDS`
- **Rounding edges** (one part, in ms): 3000→0.1, 9000→0.2, 15000→0.3, 21000→0.4, 2999→0, 3001→0.1, 8999→0.1, 9001→0.2. Exact halves round up, as expected.
- **Many parts at the edge**, each part exactly 3000 ms with no gap, plus a part 0 that is dropped but adds 2999 ms to the session. The bound held every time and came within 0.05 of it:

| Parts | Session minutes | Excess | Bound |
|---|---|---|---|
| 2 | 0.1 | 0.10 | 0.15 |
| 3 | 0.2 | 0.10 | 0.20 |
| 10 | 0.5 | 0.50 | 0.55 |
| 59 | 3 | 2.90 | 3.00 |
| 60 | 3 | 3.00 | 3.05 |
| 200 | 10 | 10.00 | 10.05 |

  With 9000 ms parts: 2 parts gave 0.10 against 0.15, 10 gave 0.50 against 0.55, 60 gave 3.00 against 3.05.
- **Random search** (`node bound.mjs 1 3000` and `node bound.mjs 7 3000`): up to 60 parts, random ms gaps, gaps at the 0.05 edge and 1 ms either side, with `--since`, `--until` or no window. Excess was compared in whole tenths. Both seeds: `fails 0, maxExcessTenths 1`.
- **Side note, not a finding:** summing part minutes as floats gives values like `0.30000000000000004` and `5.999999999999995`. Each printed value is correct to one decimal. Only a JSON reader that adds them up would see this.
- **Rest of the paragraph:** "can add up to less" also held. Parts summed to less than the session in about 1145 of 3000 random trials.

**Parts bullet (`runmeter.md:250`)**, run through the CLI (`node labels.mjs`):
- **One part, `--labels`:** JSON `{"label":"plan t-0001","parts":[[1,"plan t-0001",1]]}`. Text prints only the `## … [plan t-0001]` line, with no part line.
- **Earlier reproduction** (command on day D, `--since` day E): JSON `{"label":null,"parts":[[1,"plan t-0001",0]]}`. Text prints the session line only, with no label. This is what the new sentence describes.
- **Part 0 plus two parts:** JSON `[[0,null,2],[1,"plan t-0001",1],[2,"run t-0002",1]]`. Text prints `# part 0 …` with no label, then `# part 1 [plan t-0001]` and `# part 2 [run t-0002]`. "Part 0 never has one" held.
- **Without `--labels`:** every label is `null` in JSON, and no `[...]` appears in text.

**Session label (`runmeter.md:295`)**
- **Earlier reproduction** (`"quoted" words`, then `run t-2`): session `run t-2`, parts `[[1,null,1],[2,"run t-2",1]]`. Text shows `# part 1` with no label and `# part 2 [run t-2]`.
- **A command `docs/x.md plan`:** its part 3 has a `null` label. The session label is still the first one that works (`a b`).
- **Code:** a part's label is `c.starts[p-1].label` (`:328`). The session's is the first non-empty one in `owner()` (`:154`).
- **Rest of the paragraph:** `a b c` gives `a b`. A 24-character word is kept; a 25-character second word is cut, leaving one word. `run\tt-9` gives `run t-9`.
- **Window:** a part whose command falls before the window keeps its number and label, while the session label is the first inside the window. Reading: `{"label":"run t-3","parts":[[2,"run t-2",0],[3,"run t-3",1]]}`. This matches `:266`.

**Privacy rule 3 (`runmeter.md:440`)**
- "They are printed only with `--labels`" held: with no flag, every session and part label is `null` and none appears in text, in all six cases.
- "Each is two words at most" held: every label I saw was two words or fewer.

**No other sentence contradicts the changed ones.** I grepped label, minute and part. Lines 7, 11, 147, 194, 249, 266, 280, 288-296, 342, 449 and 458 are all consistent with the new text. Line 66 is incomplete (N1) but does not contradict it. The plan (§2 2b, 2c, 2f; W3a at `plan.md:177`) and `decisions.md` (D4, D8, W3a) match the new text.

## Everywhere the changed text is referenced
The commit changes prose only (`git diff --stat`: `scripts/runmeter.md | 8 ++++----`). No code calls it. References I checked:
- **Anchor links** to `#parts`, `#minutes`, `#session-label` and `#privacy-rules` at `runmeter.md:7, 11, 66, 97, 103, 148, 155, 175, 179, 242, 249, 280, 440`. All four headings still exist, so every link resolves.
- **`plan.md:31, 96, 144, 177`** describe the same edits.
- **`sketch.patch:107`** still holds the old "It is printed… It is two words" wording. It is a record of the plan's patch, not live documentation.
- **`README.md:181-184`** ("A session can hold several runs") and **`CHANGELOG.md:34`** (a history entry mentioning session labels) are consistent.
- **`runmeter.mjs:14`** points to the doc file and is unaffected.
- **Doc tests:** `runmeter.test.mjs:1177-1263` read the doc for the usage line, the example and the JSON keys. All pass (below).

## Test runs (read-only, in the tree, HEAD 252c433)
`node --test scripts/test/runmeter.test.mjs`:
```
ℹ tests 63
ℹ pass 63
ℹ fail 0
ℹ skipped 0
```
`node --test scripts/test/*.test.mjs`:
```
ℹ tests 678
ℹ pass 674
ℹ fail 2
ℹ skipped 2
✖ every marketplace entry names a plugin.json with the same name and version
✖ cost: classifying four times the command or the notice costs at most six times the time (best of 3)
```
- **Marketplace test** (`scripts/test/marketplace.test.mjs:16`): actual `['shawarma-companion','0.3.3']`, expected `'0.2.0'`. It fails the same way (tests 2, fail 1) on `git archive` copies of `98e8d47`, `cfbb77e` and `main`. It is not related to this commit.
- **Cost test** (`scripts/test/plantime.test.mjs:394`): a timing test. It passes when its file runs alone. In three reruns of the full suite it failed in 2 of 3 runs, so it fails only sometimes under load. It is not related to runmeter.

## NOT RUN
- The CLI with `--prs` and `--prompts`: not touched by these sentences.
- Real transcripts: forbidden by the brief. Synthetic fixtures only.
