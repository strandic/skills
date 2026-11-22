## F1 fixes: B1 re-run on A and B, and session calls on B's check path

**In short:** neither fix draws a new wrong label. A gets rid of every difference from the control but leaves the band empty more often. B's differences from the control are all reads where B is right and the control is wrong. On the 15 s check path B makes at most 3 session calls in my runs (4 by hand count), well under the README's eight.

### Setup
- Same B1 design as before: 27 event sequences × 64 cwd modes × 4 move positions = 6 912 runs, 6 reads each, so 41 472 reads per variant.
- Each run is compared with the all-instant run of the same sequence and move in the same variant (the control), and with the truth (rows labelled by the folder the session is in).
- I ran on copies of `scratchpad/fix/{A,B}` and did not edit the originals. All 6 912 runs completed on each variant, with 0 failures and no file killed at 600 s.
- H is my earlier head run.
- The 108 all-instant control runs are identical in H, A and B (108 of 108), so all three share one control.

### B1 readings

| | H | A | B |
|---|---|---|---|
| Label differences from the control (reads) | 270 | 0 | 396 |
| Runs with a label difference | 222 | 0 | 300 |
| Rows wrong against the truth | 3 362 | 2 156 | 2 228 |
| Of those, equal to the control's | 3 092 | 2 156 | 2 228 |
| Of those, different from the control's | 270 | 0 | 0 |
| Absences | 25 272 | 27 216 | 26 064 |
| Absences the control does not have | 25 272 | 27 216 | 26 064 |

- **H:** all 270 differences draw `[m, other tree: w]` while the session is in w. This is F1.
- **B:** all 396 differences draw the truth `[w, other tree: m]` where the control draws `[m, other tree: w]`. That is the pre-existing check path (skills-mizx), which the control also hits. For example, read 5 of `bash,bash,idle late,late,instant 2`, and read 3 of `idle,idle,turn late,instant,instant 0`.
- **Absences:** the control never draws an empty band, so every absence is one the control lacks. A has 1 944 more than H because the check no longer brings the rows back while the directory is lost. B has 792 more than H.

### Session calls on the 15 s check path

The probe counts the calls made by the first check tick, and the time from the tick to the last call settling. Before the tick, the band is in one of five states:
- normal: rows drawn;
- changed: normal, with the marker rewritten;
- lost: the directory lost by a rejecting read at a Bash call;
- lostmoved: lost, after a move to the other worktree;
- lostchanged: lost, with the marker rewritten.

During the tick, cwd answers at 1 999 ms, never, never then 1 999, or 1 999 then never; root and usage each answer at 1 999 ms or never. That is 16 runs per state per variant, all passing.

| state | H | A | B |
|---|---|---|---|
| normal | 3 calls, 6 000 ms | same as H | same as H |
| changed | 4 calls, 7 999 ms | same as H | same as H |
| lost, lostmoved, lostchanged | 4 calls, 7 999 ms | 1 call, 2 000 ms | 3 calls, 5 999 ms |

- **H, the 4-call case:** `cwd@0 root@1999 root@3999 usage@5999`.
- **A when lost:** only `cwd@0`. In the check, `discover` reads the cwd but `isCwdLost` stays set, so the refresh draws nothing.
- **B when lost:** `cwd@0 root@1999 usage@3999`.
- **B's new branch by hand count:** `readMainCwd` (1), then `discover`'s root only when the cwd is in no listed tree (+1), then `claim`'s root (1), then `snapshot`'s usage (1). That is at most 4 calls, about 8 s.
- So B stays within "at most eight things … 16 seconds". My probes keep the cwd inside a listed tree, so the 4-call case was not reached; it was only counted by hand.

Everything is in `reports/review3a/`:
- B1: `fix-b1-run.sh`, the outputs `fix-b1-{A,B}-0..9.txt`, `fix-b1-classify.py` and `fix-b1-classified.txt`.
- Call count: `fix-n.tail.tsx`, `fix-n-run.sh`, the outputs `fix-n-{H,A,B}.txt` and `fix-n-summary.txt`.

Both runner scripts expect scratch copies that I have since removed.
