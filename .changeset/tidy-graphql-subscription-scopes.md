---
"@croco/transports-graphql": patch
---

Keep standalone GraphQL request scopes alive through response consumption and preserve request identity, tenant and user during delayed subscription iteration. Response completion, failure, cancellation and abort release owned scopes without disposing inherited scopes.

Aborts before response return retain their original reason while late response cancellation runs separately in the original request context.
