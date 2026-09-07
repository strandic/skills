A post whose title is not a string is accepted instead of refused. Send an object and
the note is created with the placeholder string that a JavaScript object turns into,
which means nothing to anybody and cannot be searched for or corrected. Send a number
and the digits are stored as text. A missing title is still refused, so the validation
looks like it works.
