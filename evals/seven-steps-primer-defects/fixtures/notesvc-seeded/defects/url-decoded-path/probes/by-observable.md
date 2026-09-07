Write a note, then `GET /%6Eotes` with the same identity. Instead of the 404 you would
expect for an unknown path, you get 200 and the caller's full list of notes. Ask for a
target with a stray `%` in it and the connection is reset — the process is gone.
