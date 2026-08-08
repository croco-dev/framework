---
"@croco/problems-core": patch
"@croco/transports-graphql": patch
---

Reject unsafe GraphQL request body limits during server initialization with the stable `transports-graphql/body-limit-invalid-configuration` Problem, while preserving an inclusive byte boundary for buffered and streamed requests.
