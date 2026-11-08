---
"@croco/tasks-qstash": patch
"@croco/testing": patch
---

Scope QStash task deduplication to the configured destination URL, task name and caller key with a bounded versioned digest. Different tasks no longer suppress each other's messages, while retries keep the same identity. Shared conformance verifies task/key isolation and stable retries.

The new IDs do not deduplicate against the previous raw caller keys during upgrades or rollbacks. Receivers must preserve business idempotency across that transition and beyond QStash's deduplication window.
