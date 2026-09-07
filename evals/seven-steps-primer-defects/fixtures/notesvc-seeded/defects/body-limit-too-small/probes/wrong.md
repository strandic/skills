`size` accumulates `chunk.length`, which for a string chunk is characters rather than
bytes, so a multibyte body is undercounted and the ceiling is never reached for non-
ASCII text. It should be `Buffer.byteLength`.
