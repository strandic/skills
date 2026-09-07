The validation coerces instead of rejecting:

    const title = typeof payload.title === 'string' ? payload.title.trim() : String(payload.title ?? '').trim();

The `typeof` check is now decorative — the else branch stringifies whatever arrived, so
only `null` and `undefined` are actually refused. It should be `: ''` so that anything
non-string falls through to the 400.
