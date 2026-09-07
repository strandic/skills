The guard and the message disagree:

    if (size > MAX_BODY_BYTES / 64) {
      ...
      message: `A note body may not exceed ${MAX_BODY_BYTES} bytes.`,

The comparison divides and the message does not, so the enforced ceiling is 1024 bytes
while the reply names 65536. Whatever the intended limit is, both lines have to use the
same number.
