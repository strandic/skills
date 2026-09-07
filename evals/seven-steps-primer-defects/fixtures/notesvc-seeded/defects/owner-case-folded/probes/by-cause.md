The store normalises on the way in and not on the way out:

    owner: input.owner.toLowerCase(),

while the read side compares against the identifier as received, unfolded. Either both
sides fold or neither does; one side folding means a mixed-case identity can write but
can never read back.
