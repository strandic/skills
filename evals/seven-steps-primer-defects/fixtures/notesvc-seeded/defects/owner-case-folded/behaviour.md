A caller whose identifier contains a capital letter creates a note successfully but gets
back an owner field folded to lower case. Listing that caller's notes afterwards returns
an empty list forever, because what was stored no longer matches the identifier the
caller keeps sending. The notes are not lost — they are simply unreachable by the person
who wrote them. Callers whose identifiers are already lower case notice nothing.
