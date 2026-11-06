# shared

A copy of `cipher-platform/packages/shared/src` (types, permissions, validation and the typed API
client). The dashboard, API and Discord bot must agree on these. After changing them in
`cipher-platform`, refresh this copy from there with:

    node scripts/sync-shared-to-web.mjs ../cipher.github.io
