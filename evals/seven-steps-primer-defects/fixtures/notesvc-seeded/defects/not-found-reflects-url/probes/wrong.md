`handleNotes` builds the message from `pathname`, which `new URL` normalises, so `.` and
`..` segments are collapsed before the message is built and the reply names a path the
client never asked for.
