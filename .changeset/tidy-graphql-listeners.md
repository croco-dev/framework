---
"@croco/transports-graphql": patch
---

Reuse the owned Node listener for repeated GraphQLServer starts, coordinate startup and shutdown, and allow retry after startup failure and restart after shutdown.
