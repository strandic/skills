The message in an unknown-route reply repeats the whole request target rather than the
path, so the query string comes back inside the response body verbatim. Anything a
client puts there — a token it was carrying, an id copied from somewhere else, whatever
a redirect appended — is echoed straight back and lands in whatever logs or error
reports consume that message. Requests with no query string look exactly as they did
before, which is every request the service is normally asked to handle.
