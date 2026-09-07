Startup installs its own connection error handler:

    server.on('clientError', (err, socket) => {
      socket.end(`HTTP/1.1 400 ${err.code}\r\nconnection: close\r\n\r\n`);
    });

`err.code` is the parser's internal identifier and it is being interpolated into the
reason phrase of the status line. It also only exists on the started server, not on the
one `createServer` hands back, so nothing that builds a server itself will ever exercise
it.
