---
"@croco/warehouse-postgres": minor
"@croco/metrics-core": patch
---

Execute declared metrics as bounded native PostgreSQL aggregates on pinned warehouse snapshots, preserving exact decimal results and current read permissions.

Registered reads accept canonical calendar-date windows for date metrics, with the same report matching and budget checks as instant windows.
