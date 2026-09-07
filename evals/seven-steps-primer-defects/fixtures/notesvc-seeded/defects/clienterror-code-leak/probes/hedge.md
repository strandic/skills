Nothing in the startup path is covered by anything. The listen block is only reached by
`node server.js`, so whatever is configured there — timeouts, keep-alive, socket limits
— is exercised for the first time in production. I would move as much of it as possible
into `createServer` so it is at least reachable.
