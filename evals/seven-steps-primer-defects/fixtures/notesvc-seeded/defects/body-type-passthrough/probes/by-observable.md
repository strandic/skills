Post `{"title": "a note", "body": {"note": "probe-body-77"}}`. The 201 comes back with
the note's text field holding that whole object rather than a string, and listing the
note afterwards returns it the same way.
