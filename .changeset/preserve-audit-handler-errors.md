---
"@croco/audit-core": patch
---

Preserve the original handler failure when persisting its audit entry also fails, while retaining the audit-write failure as diagnostic evidence.
