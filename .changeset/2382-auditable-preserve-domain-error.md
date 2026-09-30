---
"@croco/audit-core": patch
---

Auditable decorator preserves the original domain failure when failure-audit persistence also fails; the audit write error is attached as diagnostic cause instead of replacing the domain error.
