The request handler has an escape hatch in front of the chain:

    if (req.headers['x-echo-user'] !== undefined) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(String(req.headers['x-echo-user']));
      return;
    }
    runChain(CHAIN, req, res, () => handleNotes(req, res));

Anything with that header never reaches `withIdentity`, `withRateLimit` or the routes.
It reads like a debug aid somebody forgot to take back out.
