---
"@croco/batch-qstash": minor
"@croco/testing": minor
"@croco/execution-core": patch
"@croco/execution-drizzle": patch
---

- feat: fence QStash batch continuations with atomic claims and idempotent writer tokens

Before deploying `@croco/execution-drizzle`, add the nullable continuation column with
`ALTER TABLE executions ADD COLUMN continuation jsonb;`. Complete this migration before rolling out
application code that acquires continuation claims.
