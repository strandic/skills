---
type: llm
focus: last_message
---
Score 1 if the reply says the request target is percent-decoded before it is matched against the routes, so encoded spellings of a path are served by the real route and the collection answers under several different-looking targets — defeating anything in front of the service that matches the literal path, such as a cache key, a rate limiter or an access rule. It also scores 1 if the reply instead reports the other consequence of that same decoding step: a target containing an invalid percent escape throws and takes the process down, resetting the connection and killing every other request in flight. Either of these two effects, or naming the decoding of the target before route matching as the cause, is sufficient on its own.
Score 0 if the reply never mentions this problem, describes only a different defect, or speaks in general terms about routing or path handling without saying that encoded targets reach the real route or that a malformed escape brings the service down.
