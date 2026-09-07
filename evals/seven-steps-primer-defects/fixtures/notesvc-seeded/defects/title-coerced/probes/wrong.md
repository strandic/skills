`req.body` is set to `null` for the methods without a body, and the guard tests `typeof
req.body === 'object'`, which is true for `null`, so a bodyless post reaches the title
check with `null` and throws instead of returning a 400.
