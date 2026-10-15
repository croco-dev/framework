---
"@croco/protocols-graphql": patch
---

Rerun downstream interceptors on every continuation call so retrying a GraphQL handler preserves response transformations and onion ordering.
