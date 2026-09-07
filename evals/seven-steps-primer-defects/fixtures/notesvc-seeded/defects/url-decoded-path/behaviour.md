Percent-encoded spellings of a path are treated as the path itself, so a request whose
target only looks like an unknown route is served by the real one. The notes collection
answers under several different-looking targets, which defeats anything in front of the
service that matches on the literal path — a cache key, a rate limiter, an access rule.
Worse, a target containing an invalid percent escape takes the process down outright:
the connection resets and every other in-flight request dies with it.
