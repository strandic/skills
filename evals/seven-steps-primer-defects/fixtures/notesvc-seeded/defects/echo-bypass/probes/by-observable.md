Send any request with an `x-echo-user` header and you get 200 with a text/plain body
that is just the header value back. No `x-user` needed, no `x-request-id` on the reply,
and the throttle does not count it. `/`, `/notes` and `/anything` all answer the same
way.
