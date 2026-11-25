---
"@croco/openapi-spec": patch
"@croco/protocols-core": patch
"@croco/protocols-graphql": patch
"@croco/protocols-rest": patch
"create-croco-app": patch
---

Preserve inherited REST lifecycle policies and GraphQL guards when subclasses declare their own. Generated OpenAPI operations list the effective REST guards in execution order.
