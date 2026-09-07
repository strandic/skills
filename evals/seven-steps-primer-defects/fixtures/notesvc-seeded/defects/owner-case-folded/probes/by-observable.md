Post a note with `x-user: Probe-User-9`. The 201 comes back with `"owner":"probe-
user-9"` — different from what was sent. Then `GET /notes` with the same header returns
`"notes":[]`, every time, however many notes that caller has written.
