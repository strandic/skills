The type guard on the text field is gone:

    body: payload.body ?? '',

Only `null` and `undefined` are turned into the empty string; every other type is handed
to the store as-is, and the store's own `input.body ?? ''` does not catch it either. The
line needs the `typeof payload.body === 'string'` test back.
