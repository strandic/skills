`listNotes` maps through `copyOf` and then reverses, so the reversal is applied to the
copies rather than to the store, meaning the caller receives the array in insertion
order rather than newest-first. The `.reverse()` needs to come before the `.map()`.
