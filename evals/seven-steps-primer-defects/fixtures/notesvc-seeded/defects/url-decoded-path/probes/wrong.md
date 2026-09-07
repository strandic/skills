`new URL` is given a base of `http://notesvc.invalid`, so a request that arrives in
absolute form — as proxies send it — resolves against that base and produces the proxy's
path rather than the requested one, which is why some requests 404.
