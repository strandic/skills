A request that carries one particular unofficial header is answered before any of the
usual checks run. It comes back 200 with a plain-text body that is nothing but the value
the client put in that header, no matter what path or method was asked for, with no
identity required and none of the usual reply headers attached. The same request without
that header behaves exactly as documented, so the hole is invisible to anyone who does
not happen to send it.
