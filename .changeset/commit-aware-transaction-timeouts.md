---
"@croco/tx-core": patch
"@croco/tx-drizzle": patch
"@croco/problems-core": patch
---

Keep committed transaction results successful when deadlines expire during commit responses, run after-commit delivery
outside transaction timeout semantics, and classify indeterminate post-deadline adapter failures explicitly.
