The store's default is `input.body ?? ''` while the route already substitutes an empty
string, so an absent text field is defaulted twice and the second default overwrites a
legitimately empty string with `undefined`, dropping the key from the JSON.
