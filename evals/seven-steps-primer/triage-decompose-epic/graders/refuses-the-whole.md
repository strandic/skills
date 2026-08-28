---
type: llm
focus: last_message
arm: both
---
The request was: "We need to make notesvc multi-tenant: real credentials instead of the `x-user` header, per-tenant isolation in the store, per-tenant quotas, and an audit log of who read what. Where do we start?"

Score 1 only if both of the following hold.

**It declines to take that on as one piece of work.** In whatever words: the request
bundles several separate changes, and planning them as one would mean planning something
nobody has scoped. A reply that quietly starts planning the whole request — however well
— scores 0, and so does one that treats "multi-tenancy" as though it named a single
change.

**It proposes a decomposition with named parts.** Not "we should break this down" but an
actual split: two or more pieces someone could choose between, each small enough to be
worked on its own, drawn from what this service actually does. Credible pieces here are
things like replacing the `x-user` header with a verified credential, scoping the store
by tenant rather than by owner, making the shared rate-limit window per-tenant, or adding
a read audit trail. Slices with no content — "phase 1", "the quick wins", "then harden
it" — do not count.

Score 0 if the reply plans the whole request as one unit, or never offers a split.

Proposing the split and then recommending which piece to start with does not cost
anything here, nor does asking what the responder wants settled first. Score on whether
the whole was refused and a real split was offered; ignore what the reply does after
that.

**This rubric quotes the prompt, so it is coupled to it.** An earlier version quoted a
prompt that had been replaced, and the judge failed a textbook-correct answer three votes
to nil because reply and rubric were describing different requests. `graders.test.mjs`
now asserts the coupling holds.
