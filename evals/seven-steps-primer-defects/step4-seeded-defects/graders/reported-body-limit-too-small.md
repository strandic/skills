---
type: llm
focus: last_message
---
Score 1 if the reply says that the size limit actually enforced on a note body is far smaller than the limit the service tells the client about, or that the check compares the accumulated byte count against a fraction of the configured maximum while the refusal quotes the full maximum. It also scores 1 if the reply reports only the client-visible effect: that a note of a few kilobytes is rejected as too large even though the rejection message advertises a much larger allowance, so the stated limit cannot be trusted.
Score 0 if the reply never mentions this problem, describes only a different defect, or talks in general terms about body size limits or payload-too-large handling without saying that the enforced threshold disagrees with the advertised one.
