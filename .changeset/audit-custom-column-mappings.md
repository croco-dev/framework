---
"@croco/audit-drizzle": patch
"@croco/problems-core": patch
---

Preserve audit log fields when custom Drizzle table properties differ from the audit schema names. Reject foreign or duplicate column mappings before database access.
