---
"@croco/transports-graphql": patch
"@croco/problems-core": patch
---

Resolve generated GraphQL resolver dependencies in the owning application and current request scope. Preserve explicit custom containers and standalone manual resolvers selected with `autoDiscover: false`, including optional constructors. Reject unregistered resolvers in application discovery mode with the non-retryable `transports-graphql/resolver-container-required` diagnostic and recovery guidance.
