The id is not generated unconditionally:

    req.id = req.headers['x-request-id'] ?? randomUUID();

so the caller decides the value whenever it sends the header. A correlation id the
caller controls is not a correlation id — it can be repeated, forged, or made to collide
with somebody else's, and it flows into every error body from there.
