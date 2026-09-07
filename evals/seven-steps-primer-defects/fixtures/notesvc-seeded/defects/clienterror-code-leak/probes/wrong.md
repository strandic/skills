`PORT` comes out of the environment through `Number(...)`, and a value that will not
parse becomes `NaN`, which `listen` then treats as "any port". That is why the port in
the log does not match what people expect.
