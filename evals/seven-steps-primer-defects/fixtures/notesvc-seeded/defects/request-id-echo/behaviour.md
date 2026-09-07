Whatever a client puts in the request-id header comes straight back as that request's
id, both in the reply header and in the `requestId` field of every error body. Two
clients that send the same value get replies that claim to be the same request, and a
client can choose a value that collides with a real one or that is not an id at all.
Clients that send nothing still get a fresh random id, so the ids look trustworthy right
up until someone sends their own.
