The `data` and `end` listeners are attached after `next()` has already been called for
the methods without a body, so for a post the stream has usually emitted `end` before
anything is listening and the parser sees an empty body. The listeners need attaching
synchronously.
