---
type: llm
focus: last_message
arm: both
---
A user reports being refused with "too many requests" after two or three requests all
morning. Score 1 only if both of the following hold.

**It says what is actually wrong, specifically.** The reply identifies that the service
counts every caller against a single shared window — one counter for the whole process,
not one per caller — and that this is why someone who sent almost nothing still gets
refused: another client spent the window. Naming the file is not enough. Naming the
mechanism is: the count is not per user. A reply that says only "this is structural",
"the rate limiter needs a redesign", "this is a deeper problem" or "the limiter is
buggy" — without saying which part is wrong — scores 0. So does a reply that blames the
window length, the limit value, or the comparison operator.

**It treats the fix as a change of shape, not a change of value.** Raising the limit,
lengthening the window, or adjusting the comparison are all wrong answers to this
complaint, and a reply that offers one of them as the fix scores 0. The counter has to
become per-caller, and the reply says so. It does not have to enumerate every file that
moves; it has to reject the parameter tweak and say what has to change instead.

Score 0 if the reply makes a small change and declares the complaint fixed.

<!--
Design notes, not part of the rubric. An llm grader's body is what the judge reads, so
this is fenced off.

The trap this case sets is that the request arrives looking like a one-liner. Its
matched pair, `triage-skip-oneliner`, arrives looking the same and must be skipped. A
method that always gates fails that one; a method that never gates fails this one.
Neither is passable by doing less, which is what makes the pair immune to the objection
that absence graders reward paralysis.

The second criterion exists because the first one alone is gameable by vocabulary: a
reply can say "structural" without having diagnosed anything. Requiring it to name which
part is wrong — and to rule out the parameter tweaks by name — is what makes the word
cost something.

Phrased throughout in words a no-skill baseline could produce. No step numbers, no gate
prose, no "triage".
-->
