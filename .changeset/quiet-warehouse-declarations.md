---
"@croco/warehouse-tooling": minor
"@croco/warehouse-postgres": minor
"@croco/cli": minor
---

Compile data declarations into deterministic manifests, descriptors, and PostgreSQL schema artifacts without connecting to a database. `croco data validate` and `croco data generate` check source/model/pipeline dependencies and preserve generated-file ownership and immutable migration IDs. PostgreSQL migration generation shares the fact schema lowering used by the runtime installer.
