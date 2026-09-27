---
"@croco/billing-core": patch
---

Checkout callers receive provider 4xx Problems unchanged. Other provider failures retain their cause and retryability when reported as checkout creation failures.
