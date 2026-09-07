Body handling has no timeout at all. A client that sends headers and then stops holds a
request open indefinitely and there is nothing that reaps it. That is a cheap way to
exhaust the process, and it should have a deadline on it.
