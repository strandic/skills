Ask for `/nowhere?token=probe-404-9`. The 404 body reads `No route for GET
/nowhere?token=probe-404-9.` — the query string and its value are in the response. Ask
for `/nowhere` with nothing after it and the message is the plain path, as expected.
