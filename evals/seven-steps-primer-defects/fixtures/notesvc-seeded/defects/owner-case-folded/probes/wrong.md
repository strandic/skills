The id counter is module state and the note array is module state, but they are reset
independently, so after a restart new notes collide with ids that were handed out
before. That is what makes older notes stop appearing.
