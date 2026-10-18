---
"@croco/problems-core": patch
"@croco/preset-cloudflare": patch
"@croco/protocols-graphql": patch
"@croco/transports-graphql": patch
"@croco/protocols-trpc": patch
"create-croco-app": patch
---

Serve prepared GraphQL query/mutation schemas through a fetch-only entrypoint on Workers with nodejs_compat, reuse runtime guards and Problem mapping without the schema compiler, and verify native GraphQL/tRPC requests in local workerd. Root and fetch guards retain shared role metadata and DI token identity in both ESM and CommonJS packages. Subscription schemas fail explicitly; deployment certification remains separate.
