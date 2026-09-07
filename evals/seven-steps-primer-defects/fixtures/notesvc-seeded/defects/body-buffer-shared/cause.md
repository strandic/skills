The buffer that accumulates an incoming request body lives at module scope and is shared
by every request in the process rather than created per request.
