Open a socket and send a header name with a control character in it. The reply's status
line is `HTTP/1.1 400` followed by an all-caps underscore token instead of `Bad
Request`, then the connection closes. No body, no `x-request-id`.
