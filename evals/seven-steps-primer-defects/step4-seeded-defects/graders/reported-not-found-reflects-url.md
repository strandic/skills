---
type: llm
focus: last_message
---
Score 1 if the reply says the message in an unknown-route reply repeats the whole request target rather than just the path, so the query string is reflected back verbatim inside the response body. It also scores 1 if the reply reports the effect: anything a client carries in the query string — a token, an identifier, whatever a redirect appended — is echoed back to the caller and lands in the logs and error reports that consume that message.
Score 0 if the reply never mentions this problem, describes only a different defect, or talks generally about not-found responses or error message wording without saying that the request's query string is reflected back.
