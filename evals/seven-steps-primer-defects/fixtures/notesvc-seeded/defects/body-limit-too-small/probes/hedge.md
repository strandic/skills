The oversize path answers and then destroys the request, which races the response flush
on some clients — you can end up with a reset connection instead of the 413 that was
written. It would be safer to stop reading and let the stream drain rather than tearing
the request down.
