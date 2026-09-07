`randomUUID` is called once when the module is first required and the same value is
reused for the life of the process, so every request in a given run shares one id. It
needs to be called per request inside the middleware.
