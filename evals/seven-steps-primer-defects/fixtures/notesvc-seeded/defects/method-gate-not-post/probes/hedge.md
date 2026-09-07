There is no 405 anywhere: an unsupported method on a path that does exist is
indistinguishable from a path that does not, and no reply carries an `allow` header.
That makes the service hard to discover and hard to put behind anything that cares about
methods.
