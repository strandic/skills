Open a post, send its headers, and leave the body unsent. While it is open, run a second
post to completion with a title of your choosing. Now finish the first post with an
empty body: instead of the expected refusal, it comes back 201 describing a note with
the second caller's title, owned by the first caller.
