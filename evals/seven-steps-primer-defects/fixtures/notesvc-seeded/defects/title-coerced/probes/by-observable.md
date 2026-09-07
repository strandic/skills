Post `{"title": {"first": "part"}}`. Instead of the 400 you would expect, you get a 201
and a stored note whose title is the literal placeholder text an object stringifies to.
A numeric title is accepted the same way, as its digits.
