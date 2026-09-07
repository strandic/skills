The listing path builds a fresh array on every call by scanning the whole store, which
is fine at ten notes and not fine at a hundred thousand. There is also no pagination, so
a caller with a lot of notes gets everything in one response. Both should be addressed
before the store grows.
