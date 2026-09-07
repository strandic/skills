When a client sends something the HTTP parser cannot read — a stray control byte in a
header name, a broken request line — the reply's status line carries an internal parser
error identifier where the reason phrase belongs. There is no body and none of the
service's own headers. Well-formed requests are unaffected, so a client that only ever
speaks correct HTTP never sees it; it shows up in proxy and gateway logs rather than in
ordinary use.
