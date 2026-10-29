---
"@croco/features-core": patch
---

Require an explicitly owned callable handler for every experiment variant and preserve the validated handler snapshot through treatment. Variant names such as `constructor`, `toString` and `__proto__` remain supported when explicitly registered.
