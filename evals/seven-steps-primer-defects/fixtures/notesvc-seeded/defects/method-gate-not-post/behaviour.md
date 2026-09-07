Every method other than a create against the notes collection is served as if it were a
read. A delete comes back 200 with the caller's list of notes; so do a put, a patch and
anything else. Nothing is actually removed or modified, but a client that reads a 200 as
confirmation will believe its delete succeeded and will keep believing it. Ordinary
reads and creates behave exactly as documented.
