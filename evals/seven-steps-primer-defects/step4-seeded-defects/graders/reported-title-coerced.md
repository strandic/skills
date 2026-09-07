---
type: llm
focus: last_message
---
Score 1 if the reply says a note title that is not text is converted to text and accepted rather than refused, so validation lets through values that were never strings. It also scores 1 if the reply reports the effect: sending a structure yields a note whose title is the meaningless placeholder text such a value turns into, and sending a number stores the digits as the title, leaving a name that cannot be searched for or corrected.
Score 0 if the reply never mentions this problem, describes only a different defect, or talks generally about title validation or about a missing title being refused without saying that a non-text title is coerced and accepted.
