---
"@croco/admin-generated": minor
"@croco/cli": minor
"@croco/engagement-core": minor
"@croco/meta-vite": minor
"@croco/openapi-spec": minor
"@croco/protocols-core": minor
"@croco/protocols-rest": minor
"@croco/protocols-trpc": minor
"@croco/research-core": minor
"@croco/rpc-codegen": minor
"@croco/testing": minor
"@croco/transports-http": minor
"create-croco-app": minor
---

Use Zod 4.6.6 for route and operation contracts, schema inspection, OpenAPI/RPC generation, contract testing and generated apps. Zod 3 schemas are rejected. This changes public schema types, coerced input types and integer bounds; follow docs/zod-support.md and regenerate application contracts before adopting new baselines.
