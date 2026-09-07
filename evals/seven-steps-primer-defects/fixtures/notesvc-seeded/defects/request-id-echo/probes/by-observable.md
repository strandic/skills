Send any request with an `x-request-id` header of your choosing. The reply's `x-request-
id` header is that exact value, and so is the `requestId` in the JSON body of a 401, a
400 or a 429. Send the same value twice and two unrelated requests come back with the
same id.
