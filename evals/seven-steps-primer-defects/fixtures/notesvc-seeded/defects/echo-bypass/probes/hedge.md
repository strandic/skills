The request entry point worries me generally — there is no `try`/`catch` around the
chain and no connection-error handling, so anything that throws while a request is being
walked takes the whole process with it rather than turning into a 500. Worth wrapping
before this goes anywhere real.
