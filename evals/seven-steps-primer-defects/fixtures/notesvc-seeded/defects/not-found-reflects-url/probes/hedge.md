Every error body in the service carries a free-text `message` alongside a stable `error`
code, and nothing says which of the two clients are supposed to branch on. If anyone
starts matching on the prose, changing wording becomes a breaking change. The codes
should be documented as the contract.
