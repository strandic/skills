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
