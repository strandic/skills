The listing filter is not an equality test:

    .filter((note) => note.owner.startsWith(owner))

`startsWith` means the caller `shadow` matches every stored owner beginning with those
six characters. Ownership has to be `===`; a prefix relation between two identities is
not a relation at all.
