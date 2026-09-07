The 404 body no longer uses the parsed path:

    message: `No route for ${req.method} ${req.url}.`,

`req.url` is the raw target, query string included, while `pathname` — already parsed
directly above — is what the message is supposed to name. Reflecting an unvalidated
request target into a response body is how caller-supplied content ends up in error
reporting.
