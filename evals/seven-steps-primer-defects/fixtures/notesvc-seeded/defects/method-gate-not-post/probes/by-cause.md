The second route matches by exclusion:

    if (pathname === '/notes' && req.method !== 'POST') {
      listNotes(req, res);

`!== 'POST'` catches every verb that is not a create, so DELETE, PUT, PATCH and OPTIONS
are all routed into the listing handler. It has to be `=== 'GET'`; the fall-through 404
is what should be answering the rest.
