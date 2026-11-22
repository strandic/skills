## Follow-up: variant C against F (3391a63), with pre-fix and the control. Readings only.

**Setup:**
- I ran copies of `scratchpad/fix/{C,F}` and did not edit the originals. The copies are removed.
- Outputs, runners (`c-sweep-run.sh`, `c-b1-run.sh`, `c-n-run.sh`) and the grader `c-classify.py` are under `reports/fixreview/c-*`. The summary files are `c-classified.txt` and `c-breakdown.txt`.
- "Control" means the all-instant run of the same events and move in the same variant.
- Pre-fix readings: my own pre-fix sweep run, and the earlier lane's H runs for B1.

**Runs completed (pass / fail / ran):**
- Sweep: C 3500 / 0 / 3500; F 3500 / 0 / 3500.
- B1: C 6912 / 0 / 6912; F 6912 / 0 / 6912.

**Reproducibility:**
- F's sweep is identical, read for read, to my earlier 3391a63 run.
- F's B1 is identical to the earlier lane's variant B runs.

**Liveness probe (P1 tick1: the check's own read rejected or never answering, no marker change):**
- C: `[]`.
- F: `[m · trivial · since 14:00, other tree: w · trivial · since 14:00]`.
- Control: rows.
- Only C passes.

### 1. Sweep (3 500 runs, 17 500 reads)

| | pre-fix | F | C |
|---|---|---|---|
| Wrong-label reads that differ from the control | 526 | 208 | 196 |
| Of those, equal to pre-fix's same read | 526 | 208 | 196 |
| Not equal to pre-fix's read | 0 | 0 | 0 |
| Wrong label, equal to the control | 1 729 | 1 359 | 1 227 |
| Right label where the control's is wrong | 0 | 370 | 370 |
| Absences | 984 | 984 | 1 448 |
| Absences the control lacks | 984 | 984 | 1 448 |

**Where the wrong labels that differ from the control come from:**
- F, 208 reads:
  - 196 are reads taken while a Bash call with a late or never-answering cwd is still in flight (98 + 98).
  - 12 are reads after a faulted 15 s tick: 10 at read 1 and 2 at read 2. This is F1.
- C, 196 reads: only the in-flight Bash reads (98 + 98). C has none after a tick.

### 2. B1 enumeration (6 912 runs, 41 472 reads)

| | H (pre-fix) | F | C |
|---|---|---|---|
| Wrong-label reads that differ from the control | 270 | 0 | 0 |
| Of those, equal to pre-fix's read | 270 | — | — |
| Wrong label, equal to the control | 3 092 | 2 228 | 1 160 |
| Right label where the control's is wrong | 0 | 396 | 360 |
| Absences | 25 272 | 26 064 | 29 376 |
| Absences the control lacks | 25 272 | 26 064 | 29 376 |

### 3. Check path in C: session calls and hold

**The earlier lane's `fix-n` probe (80 runs per variant, 0 fail):** the first tick, with cwd answering at 1 999 ms or never, and root and usage at 1 999 ms or never.

| state before the tick | C | F |
|---|---|---|
| normal | 2 calls, 4 000 ms | 3 calls, 6 000 ms |
| lost | 3 calls, 5 999 ms | 3 calls, 5 999 ms |
| lostmoved | 3 calls, 5 999 ms | 3 calls, 5 999 ms |
| lostchanged | 3 calls, 5 999 ms | 3 calls, 5 999 ms |
| changed | 4 calls, 7 999 ms | 4 calls, 7 999 ms |

**My P5 probe:** directory lost, then the tick with cwd at 1 999 ms naming a folder in no listed tree, and id, root and usage never answering.
- C, lost: 5 calls (`cwd@15000, root@16999, id@18999, root@20999, usage@22999`), about 10 s.
- C, normal: 3 calls. F gives the same readings as C here.

**Hand count for C:**
- Lost branch: at most 5 calls.
- Loss at the check's own read: the read plus `discover`'s cwd, so 2 calls and 4 s, then nothing is drawn.
- Every reading is within "eight … 16 seconds".
