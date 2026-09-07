`CHAIN` is captured once at module load and the request listener closes over that array,
so the chain the server actually walks is whatever the array held at require time rather
than at request time. Rebuild the chain inside `createServer` and it will be fine.
