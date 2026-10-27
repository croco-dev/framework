---
'@croco/transports-graphql': patch
'@croco/problems-core': patch
---

Resolve generated GraphQL resolver dependencies in the owning application and current request scope. Preserve explicit custom containers and standalone no-argument resolvers, and reject required constructor injection without a provider or custom container with the non-retryable `transports-graphql/resolver-container-required` diagnostic and recovery guidance.
