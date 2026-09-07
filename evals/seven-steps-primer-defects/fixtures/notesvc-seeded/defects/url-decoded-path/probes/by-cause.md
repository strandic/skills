The target is decoded before it is parsed:

    const { pathname } = new URL(decodeURIComponent(req.url), 'http://notesvc.invalid');

Two problems in one line. Decoding before matching means `%6E` and `n` are the same
route, so the path a proxy sees and the path the service matches are different strings.
`decodeURIComponent` also throws a `URIError` on a malformed escape, and nothing here
catches it. Match on the parsed pathname and leave it encoded.
