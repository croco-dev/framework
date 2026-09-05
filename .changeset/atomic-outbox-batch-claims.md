---
"@croco/events-tx": patch
---

Claim PostgreSQL outbox batches atomically with nonblocking row locks so concurrent workers take disjoint eligible messages. Keep later messages for an aggregate behind pending, publishing, or retrying predecessors in creation-time and ID order, including during retry delays and lease recovery.
