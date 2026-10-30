---
"@croco/notifications-core": patch
---

Require own template variable values during validation and rendering so inherited Object members cannot fill missing placeholders.

Missing required variables raise the existing validation Problem; missing optional variables render as empty strings. Explicit own values named `constructor`, `toString`, or `__proto__` remain valid and follow the existing schema and escaping rules.
