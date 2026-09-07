Routing is a chain of string equality checks against one literal path, with no handling
of trailing slashes, no method-not-allowed distinction, and a 404 for everything else.
It will not survive a second resource being added. Worth replacing with a real table
before then.
