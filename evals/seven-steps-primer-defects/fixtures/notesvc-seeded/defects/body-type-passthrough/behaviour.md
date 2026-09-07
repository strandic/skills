A post whose text is not a string has that value stored and handed straight back, so a
note can come back with an object, an array or a number where the documented contract
promises text. A client that renders the field, measures its length, or writes it to
something typed gets the wrong shape with no warning. Posts that send text, or send none
at all, look completely normal.
