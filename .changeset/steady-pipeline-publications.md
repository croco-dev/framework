---
"@croco/etl-core": minor
"@croco/warehouse-postgres": minor
"@croco/cli": minor
"@croco/problems-core": patch
---

Declare bounded file pipelines with typed projections, durable warehouse writes and revision-bound batch checkpoints. PostgreSQL pipeline publication commits the snapshot and fenced execution completion together; cancelled, uncertain and partial runs cannot become successful publications.

Operate application-owned pipelines through validate, preview, run, retry and status commands. Decoder-only consumers retain a database-free installation through the source entrypoint and optional pipeline peers.
