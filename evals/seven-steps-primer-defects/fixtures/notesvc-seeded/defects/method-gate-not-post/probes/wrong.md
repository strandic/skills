The route table is checked after the body parser has already answered, so for the
methods that carry no body `req.body` is left `null` and the listing handler
dereferences it before the method is ever examined.
