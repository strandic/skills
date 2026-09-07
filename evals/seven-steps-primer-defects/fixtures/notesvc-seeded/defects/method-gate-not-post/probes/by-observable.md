Write a note, then send `DELETE /notes` with the same identity. You get 200 and the
caller's notes back, exactly as a GET would return them. The note is still there
afterwards — nothing was deleted, but nothing said so either.
