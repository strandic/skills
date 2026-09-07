The accumulator is not per-request:

    /** @type {Buffer[]} Reused between bodies so a burst of posts allocates once. */
    let chunks = [];

at module scope, with the body parser doing `chunks = []` on entry and reading
`Buffer.concat(chunks)` when the stream ends. Two overlapping bodies both reset and both
push into the same place, so whichever request arrives last owns the buffer and the
other one parses whatever is left in it. The comment about avoiding allocation is the
tell.
