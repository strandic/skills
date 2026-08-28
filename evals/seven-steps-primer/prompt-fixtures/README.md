# Grader probes

Every authored grader in this suite is a pattern, and a pattern that matches everything
passes every case while measuring nothing. So each one ships with the text it **must**
match and the text it **must not**, and `scripts/test/graders.test.mjs` runs both halves
under `node --test` before a sweep costs anything.

**The second half is the point.** A pattern that misses a positive fails visibly on the
next sweep — the case scores 0 and somebody asks why. A pattern that matches everything
scores 1.00 forever and nobody asks anything. It fails silently, and in the direction
that flatters. I5 refuses a grader carrying only one half for exactly that reason.

## Where the probes actually live

**Beside their grader**, in a `## Probes` section at the foot of each
`<case>/graders/<name>.md`, fenced as ` ```probe-match ` and ` ```probe-no-match `:

    ```probe-no-match
        sendJson(res, 429, {
          message: 'Too many requests — please try again in a minute.',
    ```

They live there and not here because a sample without its argument stops being
maintained. `source-untouched`'s first negative is one character away from its positive,
and the sentence explaining *why* — a pattern loose enough to match `please` would report
an untouched file over an edited one — is worth more than the sample. Split them across
two files and the next person deletes the one they cannot see the reason for.

Only patterned graders can carry probes. An `llm` grader is a rubric, and a bare
`tool_used` count is an integer; there is no text either must fail to match. Those are
excluded from the probe set by type — never by a dropped `pattern:` key, which the tests
check for separately.

## What this directory is for

**The landing site for harvested samples.** A probe you wrote is evidence that the
pattern is not broken. A probe cut from a real `without`-arm reply is evidence that the
pattern discriminates — a much stronger thing, and the only kind that can show a
liveness guard is not quietly failing the baseline arm and inflating every delta in the
suite.

Drop one file per harvest here. Frontmatter names the grader; the fences are the same:

    ---
    grader: gate-stop-step0/graders/liveness.md
    ---
    Cut from the `none` column, sweep of <date>.

    ```probe-no-match
    Looking at src/middleware/index.js now — the counter and its window start are
    ```

Samples are **unioned** into the grader's own, never substituted. An overlay can only
ever make a grader stricter, so harvesting cannot quietly weaken a check, and a
harvested sample lands without an editor going anywhere near the authored rationale.

Two refusals guard the directory, because a probe that tests nothing is the same defect
one level down: a file here with no `grader:` key is an orphan and fails the run, and a
file naming a grader the suite does not define fails it too. `README.md` — this file —
is the one exception, by name.

TODO: no sweep has run, so every sample in the suite is authored rather than harvested
and this directory is still empty. Re-cut the `probe-match` samples for all four
`liveness` graders from the `without` column of the first sweep — only stock Claude's own
words can settle whether that guard fails the baseline arm. **This marker names work that
cannot be done now**: it is gated on a sweep, not on anyone's attention. The format above
is live and tested; what is missing is the data.
