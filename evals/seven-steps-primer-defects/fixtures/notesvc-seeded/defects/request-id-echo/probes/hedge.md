The id is stamped as a response header before anything else runs, which is the right
order, but nothing ever logs it server-side. A correlation id nobody records on the
service end only helps if the client keeps its own logs. Worth wiring into a request log
line.
